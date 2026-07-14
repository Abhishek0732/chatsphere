import {
  Client,
  type IMessage,
  type IStompSocket,
  type StompSubscription,
} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { authAccessors } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { ackOutboxEcho, flushOutbox } from '@/services/outbox';
import { queryClient } from './queryClient';
import { queryKeys } from '@/api/queryKeys';
import {
  applyReadReceipt,
  bumpConversation,
  markMessageDeleted,
  replaceMessage,
  upsertMessage,
} from './messageCache';
import { toast } from '@/store/toastStore';
import { clearMessageNotifications, notifyMessage } from '@/utils/notifications';
import { muteAccessors } from '@/store/muteStore';
import { useCallStore } from '@/store/callStore';
import { mediaService } from '@/features/call/mediaService';
import type {
  AppNotification,
  CallInvitePayload,
  CallSignal,
  CallType,
  ChatSendPayload,
  Message,
  MessageDeletedEvent,
  PresenceEvent,
  ReadEvent,
  TypingEvent,
} from '@/types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:8080/ws';
const PRESENCE_PING_MS = 25_000;

type SafeParse<T> = T | null;
function parse<T>(body: string): SafeParse<T> {
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/**
 * Resolve a numeric conversation id to its opaque public id for URLs, using the
 * cached conversation list. Falls back to the numeric id (ChatPage canonicalises
 * it) if the conversation isn't cached yet.
 */
function chatKeyFor(conversationId: number): string {
  const list = queryClient.getQueryData<{ id: number; publicId: string }[]>(
    queryKeys.conversations,
  );
  return list?.find((c) => c.id === conversationId)?.publicId ?? String(conversationId);
}

/** Short one-line preview of a message for notification bodies. */
function messagePreview(m: Message): string {
  if (m.type === 'IMAGE') return m.content ? `📷 ${m.content}` : '📷 Photo';
  if (m.type === 'FILE') return m.content ? `📎 ${m.content}` : '📎 Attachment';
  return m.content || 'New message';
}

/** Cached conversation name + type, for building notification titles. */
function conversationMeta(id: number): { name: string; type: string } | undefined {
  const list = queryClient.getQueryData<{ id: number; name: string; type: string }[]>(
    queryKeys.conversations,
  );
  return list?.find((c) => c.id === id);
}

class SocketService {
  private client: Client | null = null;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;

  /** Per-conversation topic subscriptions (typing + read) for the OPEN thread. */
  private convSubs = new Map<number, StompSubscription[]>();

  /** Typing subscriptions for EVERY conversation in the list, so the sidebar
   *  can show a live "typing…" hint even when the thread isn't open. */
  private typingSubs = new Map<number, StompSubscription>();
  /** Last set of conversation ids to watch typing for (replayed on reconnect). */
  private watchedTypingIds: number[] = [];

  private connected = false;
  private networkBound = false;

  /**
   * The browser knows it is offline long before the socket does.
   *
   * STOMP only learns the connection is dead when a close/heartbeat-timeout fires,
   * which can be many seconds after the network actually went. In that window
   * `connected` was still true, so messages were published into a dead socket:
   * they were not queued (we thought we had sent them), and they leaked out in
   * whatever order the reconnect happened to flush them. Trusting the browser's
   * own online/offline signal closes that window.
   */
  private bindNetworkEvents(): void {
    if (this.networkBound || typeof window === 'undefined') return;
    this.networkBound = true;

    window.addEventListener('offline', () => {
      this.connected = false;
      useChatStore.getState().setConnected(false);
    });
    window.addEventListener('online', () => {
      // stompjs reconnects on its own schedule; nudge it so the outbox drains
      // promptly rather than up to reconnectDelay later.
      if (this.client && !this.connected) this.client.activate();
    });
  }

  /** True only when we can actually put a frame on the wire right now. */
  canSend(): boolean {
    const browserOnline = typeof navigator === 'undefined' || navigator.onLine;
    return this.connected && browserOnline;
  }

  /** Establish the STOMP-over-SockJS connection. Idempotent. */
  connect(): void {
    this.bindNetworkEvents();
    if (this.client) return;
    const token = authAccessors.getAccessToken();
    if (!token) return;

    this.client = new Client({
      // SockJS handles the transport; STOMP rides on top. SockJS is
      // structurally compatible with the socket interface STOMP expects.
      webSocketFactory: () => new SockJS(WS_URL) as unknown as IStompSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 4000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => this.handleConnect(),
      onDisconnect: () => this.handleDisconnect(),
      onStompError: (frame) => {
        // eslint-disable-next-line no-console
        console.error('[socket] STOMP error', frame.headers['message'], frame.body);
      },
      onWebSocketClose: () => this.handleDisconnect(),
    });

    this.client.activate();
  }

  /** Tear down the connection (e.g. on logout). */
  disconnect(): void {
    this.stopPresencePing();
    this.convSubs.forEach((subs) => subs.forEach((s) => s.unsubscribe()));
    this.convSubs.clear();
    this.typingSubs.forEach((sub) => sub.unsubscribe());
    this.typingSubs.clear();
    this.watchedTypingIds = [];
    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }
    this.connected = false;
    useChatStore.getState().setConnected(false);
  }

  /** Reconnect using a freshly-refreshed token. */
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------
  private handleConnect(): void {
    this.connected = true;
    useChatStore.getState().setConnected(true);

    const client = this.client;
    if (!client) return;

    // Anything typed while we were offline is waiting in the outbox — send it now,
    // oldest first. Deferred a tick so the subscriptions below are in place first
    // (otherwise the server's echo could arrive before we are listening for it).
    setTimeout(() => void flushOutbox(), 0);

    // Personal message queue.
    client.subscribe('/user/queue/messages', (frame: IMessage) => {
      const message = parse<Message>(frame.body);
      if (message) this.onIncomingMessage(message);
    });

    // Personal notifications.
    client.subscribe('/user/queue/notifications', (frame: IMessage) => {
      const notification = parse<AppNotification>(frame.body);
      if (notification) this.onNotification(notification);
    });

    // Message deletions (soft delete broadcast to all members).
    client.subscribe('/user/queue/message-deleted', (frame: IMessage) => {
      const event = parse<MessageDeletedEvent>(frame.body);
      if (event) markMessageDeleted(event.conversationId, event.messageId);
    });

    // In-place message updates (edit / pin / reaction).
    client.subscribe('/user/queue/message-updated', (frame: IMessage) => {
      const message = parse<Message>(frame.body);
      if (message) replaceMessage(message);
    });

    // Presence for the people I can actually see (contacts + conversation
    // partners). This was a GLOBAL topic every client subscribed to: one user
    // coming online published a frame to all 100k clients, so a reconnect storm
    // was quadratic. Now the server sends it only to the audience that cares.
    client.subscribe('/user/queue/presence', (frame: IMessage) => {
      const event = parse<PresenceEvent>(frame.body);
      if (event) useChatStore.getState().setPresence(event);
    });

    // Personal call-signaling queue.
    client.subscribe('/user/queue/call', (frame: IMessage) => {
      const signal = parse<CallSignal>(frame.body);
      if (signal) this.onCallSignal(signal);
    });

    // Re-subscribe to whatever conversation is active.
    const active = useChatStore.getState().activeConversationId;
    if (active != null) this.watchConversation(active);

    // Re-open typing subscriptions for all listed conversations (subs were
    // invalidated by the disconnect; the map was cleared).
    if (this.watchedTypingIds.length) this.syncTypingSubs(this.watchedTypingIds);

    this.startPresencePing();
  }

  private handleDisconnect(): void {
    this.connected = false;
    useChatStore.getState().setConnected(false);
    this.stopPresencePing();
    // Subscriptions are invalid after a socket close; drop refs so a fresh
    // connect re-subscribes cleanly.
    this.convSubs.clear();
    this.typingSubs.clear();
  }

  // -----------------------------------------------------------------------
  // Per-conversation topic management
  // -----------------------------------------------------------------------
  /** Subscribe to typing + read topics for a conversation. */
  watchConversation(conversationId: number): void {
    const client = this.client;
    if (!client || !this.connected) return;
    if (this.convSubs.has(conversationId)) return;

    const typingSub = client.subscribe(
      `/topic/conversations/${conversationId}/typing`,
      (frame: IMessage) => {
        const event = parse<TypingEvent>(frame.body);
        if (!event) return;
        const me = useChatStore.getState();
        // Ignore our own typing echoes.
        // (self filtering happens in the component using current user id)
        me.setTyping(
          event.conversationId,
          { userId: event.userId, userName: event.userName },
          event.typing,
        );
      },
    );

    const readSub = client.subscribe(
      `/topic/conversations/${conversationId}/read`,
      (frame: IMessage) => {
        const event = parse<ReadEvent>(frame.body);
        // Only turn our own messages blue when the OTHER participant reads them.
        // Ignore our own read events (opening a chat marks the latest message read,
        // which would otherwise instantly blue-tick messages we just sent).
        if (event && event.userId !== authAccessors.getUserId()) {
          applyReadReceipt(event.conversationId, event.messageId);
        }
      },
    );

    this.convSubs.set(conversationId, [typingSub, readSub]);
  }

  /** Unsubscribe from a conversation's topics. */
  unwatchConversation(conversationId: number): void {
    const subs = this.convSubs.get(conversationId);
    if (subs) {
      subs.forEach((s) => s.unsubscribe());
      this.convSubs.delete(conversationId);
    }
  }

  /**
   * Keep a typing subscription open for every conversation in the list so the
   * sidebar shows a live "typing…" hint. Idempotent: subscribes ids that are
   * new and drops ones no longer present. Replayed automatically on reconnect.
   */
  syncTypingSubs(ids: number[]): void {
    this.watchedTypingIds = ids;
    const client = this.client;
    if (!client || !this.connected) return;

    const wanted = new Set(ids);
    // Drop subscriptions for conversations that left the list.
    for (const [id, sub] of this.typingSubs) {
      if (!wanted.has(id)) {
        sub.unsubscribe();
        this.typingSubs.delete(id);
      }
    }
    // Add subscriptions for new conversations.
    for (const id of ids) {
      if (this.typingSubs.has(id)) continue;
      const sub = client.subscribe(
        `/topic/conversations/${id}/typing`,
        (frame: IMessage) => {
          const event = parse<TypingEvent>(frame.body);
          if (!event) return;
          useChatStore
            .getState()
            .setTyping(
              event.conversationId,
              { userId: event.userId, userName: event.userName },
              event.typing,
            );
        },
      );
      this.typingSubs.set(id, sub);
    }
  }

  // -----------------------------------------------------------------------
  // Client -> server sends
  // -----------------------------------------------------------------------
  sendMessage(payload: ChatSendPayload): boolean {
    // canSend(), not connected: the socket can still claim to be up for several
    // seconds after the network has gone. Returning false here is what puts the
    // message safely in the outbox instead of into a dead socket.
    if (!this.client || !this.canSend()) return false;
    this.client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(payload),
    });
    return true;
  }

  sendTyping(conversationId: number, typing: boolean): void {
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ conversationId, typing }),
    });
  }

  sendRead(conversationId: number, messageId: number): void {
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/chat.read',
      body: JSON.stringify({ conversationId, messageId }),
    });
  }

  deleteMessage(conversationId: number, messageId: number): boolean {
    if (!this.client || !this.connected) return false;
    this.client.publish({
      destination: '/app/chat.delete',
      body: JSON.stringify({ conversationId, messageId }),
    });
    return true;
  }

  reactToMessage(conversationId: number, messageId: number, emoji: string): void {
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/chat.react',
      body: JSON.stringify({ conversationId, messageId, emoji }),
    });
  }

  pinMessage(conversationId: number, messageId: number, pinned: boolean): void {
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/chat.pin',
      body: JSON.stringify({ conversationId, messageId, pinned }),
    });
  }

  editMessage(conversationId: number, messageId: number, content: string): void {
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/chat.edit',
      body: JSON.stringify({ conversationId, messageId, content }),
    });
  }

  // -----------------------------------------------------------------------
  // Call signaling (Phase 1: no media — proves invite -> ring -> accept -> end)
  // -----------------------------------------------------------------------

  /** Place an outgoing call. Generates the id up front so cancel works instantly. */
  startCall(
    peer: { id: number; name: string; avatarUrl?: string },
    type: CallType = 'VOICE',
    conversationId?: number,
  ): void {
    if (!this.client || !this.connected) {
      toast({ title: 'Not connected — try again in a moment', variant: 'error' });
      return;
    }
    const callId = crypto.randomUUID();
    useCallStore.getState().setCall({ callId, type, phase: 'outgoing', outgoing: true, peer });
    const payload: CallInvitePayload = { callId, calleeId: peer.id, type, conversationId };
    this.client.publish({ destination: '/app/call.invite', body: JSON.stringify(payload) });
  }

  answerCall(): void {
    const call = useCallStore.getState().call;
    if (!call || !this.client || !this.connected) return;
    this.client.publish({ destination: '/app/call.accept', body: JSON.stringify({ callId: call.callId }) });
  }

  declineCall(): void {
    const call = useCallStore.getState().call;
    if (call && this.client && this.connected) {
      this.client.publish({ destination: '/app/call.decline', body: JSON.stringify({ callId: call.callId }) });
    }
    useCallStore.getState().clear();
  }

  /** Cancel (while ringing) or hang up (while active). Server echo confirms. */
  hangUp(): void {
    const call = useCallStore.getState().call;
    if (!call) return;
    if (this.client && this.connected) {
      const destination = call.phase === 'outgoing' ? '/app/call.cancel' : '/app/call.end';
      this.client.publish({ destination, body: JSON.stringify({ callId: call.callId }) });
    }
    // Optimistically show the ended screen; the CALL_ENDED echo is idempotent.
    useCallStore.getState().patchCall({
      phase: 'ended',
      endedLabel: call.phase === 'outgoing' ? 'Call cancelled' : 'Call ended',
    });
  }

  /** Relay a native-WebRTC SDP/ICE frame to the peer via the server. */
  sendRtcSignal(callId: string, kind: 'offer' | 'answer' | 'ice', sdp?: string, candidate?: string): void {
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({ callId, kind, sdp, candidate }),
    });
  }

  private onCallSignal(signal: CallSignal): void {
    // WebRTC negotiation frames are pure media plumbing — hand straight to the
    // peer connection without touching call state.
    if (signal.type.startsWith('WEBRTC_')) {
      void mediaService.onSignal(signal);
      return;
    }

    const store = useCallStore.getState();
    const current = store.call;

    switch (signal.type) {
      case 'INCOMING_CALL':
        // Already busy locally — ignore (the server also guards with a busy-lock).
        if (current && current.phase !== 'ended') return;
        if (!signal.callId) return;
        store.setCall({
          callId: signal.callId,
          type: signal.callType,
          phase: 'incoming',
          outgoing: false,
          peer: {
            id: signal.callerId,
            name: signal.callerName ?? 'Unknown',
            avatarUrl: signal.callerAvatarUrl,
          },
        });
        break;
      case 'CALL_RINGING':
        if (current?.outgoing) {
          store.patchCall({ callId: signal.callId ?? current.callId, phase: 'outgoing' });
        }
        break;
      case 'CALL_ACCEPTED':
        if (current) store.patchCall({ phase: 'active', answeredAt: Date.now() });
        break;
      case 'CALL_DECLINED':
        this.endCall('Call declined');
        break;
      case 'CALL_CANCELLED':
        this.endCall('Call cancelled');
        break;
      case 'CALL_ENDED':
        this.endCall('Call ended', signal.durationSeconds ?? undefined);
        break;
      case 'CALL_MISSED':
        this.endCall(current?.outgoing ? 'No answer' : 'Missed call');
        break;
      case 'CALL_BUSY':
        this.endCall('Busy');
        break;
      case 'CALL_UNAVAILABLE':
        this.endCall(signal.reason === 'offline' ? 'Unavailable' : 'Unavailable');
        break;
      case 'CALL_TAKEN':
        // Answered on another device.
        store.clear();
        break;
      case 'CALL_FAILED':
        this.endCall('Call failed');
        break;
      default:
        break;
    }
  }

  private endCall(label: string, durationSeconds?: number): void {
    const store = useCallStore.getState();
    if (!store.call) return;
    store.patchCall({ phase: 'ended', endedLabel: label, durationSeconds });
    // The call just landed in history — refresh the Calls tab if it's open.
    void queryClient.invalidateQueries({ queryKey: queryKeys.calls });
  }

  private ping(): void {
    if (!this.client || !this.connected) return;
    this.client.publish({ destination: '/app/presence.ping', body: '{}' });
  }

  private startPresencePing(): void {
    this.stopPresencePing();
    this.ping();
    this.presenceTimer = setInterval(() => this.ping(), PRESENCE_PING_MS);
  }

  private stopPresencePing(): void {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Incoming dispatch
  // -----------------------------------------------------------------------
  private onIncomingMessage(message: Message): void {
    upsertMessage(message);

    // If this is the echo of something we flushed from the outbox, release the
    // next queued message — they go one at a time so the order is preserved.
    ackOutboxEcho(message.tempId);

    const activeId = useChatStore.getState().activeConversationId;
    const isActive = activeId === message.conversationId;
    const isOwn = message.senderId === authAccessors.getUserId();
    // Increment unread only when it's not our own message (e.g. the echo of a
    // message we sent or forwarded) and the thread isn't currently open.
    bumpConversation(message, { incrementUnread: !isOwn && !isActive });

    // Ensure the conversation exists in the list; if unknown, refetch list.
    const list = queryClient.getQueryData(queryKeys.conversations) as
      | { id: number }[]
      | undefined;
    if (list && !list.some((c) => c.id === message.conversationId)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    }

    // Desktop notification when someone else messages us and the app isn't in
    // the foreground (backgrounded tab / another window). In-app toasts cover
    // the focused case, so we only fire the OS notification when hidden.
    // Multiple messages accumulate into one WhatsApp-style stacked notification.
    if (
      !isOwn &&
      typeof document !== 'undefined' &&
      document.hidden &&
      !muteAccessors.isMuted(message.conversationId)
    ) {
      const meta = conversationMeta(message.conversationId);
      const isGroup = meta?.type === 'GROUP';
      const preview = messagePreview(message);
      notifyMessage({
        conversationId: message.conversationId,
        // Direct: title is the sender. Group: title is the group, each line
        // is prefixed with who sent it.
        title: isGroup ? meta?.name || 'Group' : message.senderName || 'New message',
        line: isGroup ? `${message.senderName}: ${preview}` : preview,
        path: `/chat/${chatKeyFor(message.conversationId)}`,
      });
    }

    // Auto-mark read if the thread is open; the component-level effect will
    // also confirm via REST, but this keeps the socket read receipt prompt.
    if (isActive) {
      clearMessageNotifications(message.conversationId);
      this.sendRead(message.conversationId, message.id);
    }
  }

  private onNotification(notification: AppNotification): void {
    queryClient.setQueryData<AppNotification[]>(queryKeys.notifications, (prev) => {
      const list = prev ?? [];
      if (list.some((n) => n.id === notification.id)) return list;
      return [notification, ...list];
    });

    // Contact invitations update the Contacts page in realtime.
    if (notification.type === 'CONTACT_REQUEST') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests });
    } else if (notification.type === 'CONTACT_ACCEPTED') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contactRequestsOutgoing });
      // The direct conversation is created on accept — pull it into the chat list.
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    } else if (notification.type === 'GROUP_INVITE') {
      // Someone who isn't my contact wants to add me to a group: it waits for me.
      void queryClient.invalidateQueries({ queryKey: queryKeys.groupInvites });
    } else if (notification.type === 'GROUP') {
      // Added to a group / someone joined — refresh the chat list.
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    }

    const isContact =
      notification.type === 'CONTACT_REQUEST' ||
      notification.type === 'CONTACT_ACCEPTED' ||
      notification.type === 'GROUP_INVITE';
    toast({
      title: notification.title,
      description: notification.body,
      variant: 'info',
      href: isContact
        ? '/contacts'
        : notification.conversationId
          ? `/chat/${chatKeyFor(notification.conversationId)}`
          : undefined,
    });
  }
}

/** Singleton instance. */
export const socketService = new SocketService();

// Expose the socket for debugging / scripted call testing from the console.
(globalThis as unknown as { __socket?: SocketService }).__socket = socketService;
