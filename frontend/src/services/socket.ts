import {
  Client,
  type IMessage,
  type IStompSocket,
  type StompSubscription,
} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { authAccessors } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { queryClient } from './queryClient';
import { queryKeys } from '@/api/queryKeys';
import {
  applyReadReceipt,
  bumpConversation,
  markMessageDeleted,
  upsertMessage,
} from './messageCache';
import { toast } from '@/store/toastStore';
import type {
  AppNotification,
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

class SocketService {
  private client: Client | null = null;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;

  /** Per-conversation topic subscriptions (typing + read). */
  private convSubs = new Map<number, StompSubscription[]>();

  private connected = false;

  /** Establish the STOMP-over-SockJS connection. Idempotent. */
  connect(): void {
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

    // Global presence topic.
    client.subscribe('/topic/presence', (frame: IMessage) => {
      const event = parse<PresenceEvent>(frame.body);
      if (event) useChatStore.getState().setPresence(event);
    });

    // Re-subscribe to whatever conversation is active.
    const active = useChatStore.getState().activeConversationId;
    if (active != null) this.watchConversation(active);

    this.startPresencePing();
  }

  private handleDisconnect(): void {
    this.connected = false;
    useChatStore.getState().setConnected(false);
    this.stopPresencePing();
    // Subscriptions are invalid after a socket close; drop refs so a fresh
    // connect re-subscribes cleanly.
    this.convSubs.clear();
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

  // -----------------------------------------------------------------------
  // Client -> server sends
  // -----------------------------------------------------------------------
  sendMessage(payload: ChatSendPayload): boolean {
    if (!this.client || !this.connected) return false;
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

    const activeId = useChatStore.getState().activeConversationId;
    const isActive = activeId === message.conversationId;
    // Increment unread only when it's not our own message and the thread
    // isn't currently open.
    bumpConversation(message, { incrementUnread: !isActive });

    // Ensure the conversation exists in the list; if unknown, refetch list.
    const list = queryClient.getQueryData(queryKeys.conversations) as
      | { id: number }[]
      | undefined;
    if (list && !list.some((c) => c.id === message.conversationId)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    }

    // Auto-mark read if the thread is open; the component-level effect will
    // also confirm via REST, but this keeps the socket read receipt prompt.
    if (isActive) {
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
    }

    const isContact =
      notification.type === 'CONTACT_REQUEST' || notification.type === 'CONTACT_ACCEPTED';
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
