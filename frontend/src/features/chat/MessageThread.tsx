import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Pin, PinOff } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { EncryptionNotice } from './EncryptionNotice';
import { SkeletonThread } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useMessages } from '@/hooks/useMessages';
import { useConversation, useMarkRead } from '@/hooks/useConversations';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { socketService } from '@/services/socket';
import { clearMessageNotifications } from '@/utils/notifications';
import { formatDayDivider } from '@/utils/format';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInfoModal } from './MessageInfoModal';
import { mentionNamesOf } from './MessageText';
import { ImageAlbum } from './ImageAlbum';
import { ContactInfoPanel } from './ContactInfoPanel';
import { MessageInput } from './MessageInput';
import { ForwardModal } from './ForwardModal';
import { TypingBubble } from './TypingBubble';
import { GroupInfoModal } from '@/features/groups/GroupInfoModal';
import { useGroup } from '@/hooks/useGroups';
import { useIsBlocked } from '@/hooks/useBlocks';
import { otherMember } from './utils';
import { isExpired } from '@/utils/disappearing';
import type { Message } from '@/types';

// Stable empty reference so a zustand selector doesn't return a fresh [] each
// render (which would loop under useSyncExternalStore).
const NO_TYPERS: { userId: number; userName: string }[] = [];

/** Stable empty list for direct chats (no @mentions there). */
const NO_MENTION_NAMES: string[] = [];

function pinnedPreview(m: Message): string {
  if (m.type === 'IMAGE') return m.content ? `📷 ${m.content}` : '📷 Photo';
  if (m.type === 'FILE') return m.content ? `📎 ${m.content}` : '📎 Attachment';
  return m.content || '';
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** Max gap between images still considered "sent together" (one album). */
const ALBUM_WINDOW_MS = 60_000;

/** A plain photo eligible to join a WhatsApp-style album (no reply/reaction/status). */
function albumable(m: Message): boolean {
  return (
    m.type === 'IMAGE' &&
    !!m.attachmentUrl &&
    !m.deleted &&
    !m.replyTo &&
    !m.statusRef &&
    (m.reactions?.length ?? 0) === 0
  );
}

type Row =
  | { kind: 'single'; message: Message }
  | { kind: 'album'; key: string; messages: Message[] };

/** Fold runs of same-sender images sent close together into single album rows. */
function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (albumable(m)) {
      const group: Message[] = [m];
      let j = i + 1;
      while (
        j < messages.length &&
        albumable(messages[j]) &&
        messages[j].senderId === m.senderId &&
        new Date(messages[j].createdAt).getTime() -
          new Date(messages[j - 1].createdAt).getTime() <=
          ALBUM_WINDOW_MS
      ) {
        group.push(messages[j]);
        j++;
      }
      if (group.length >= 2) {
        rows.push({
          kind: 'album',
          key: `album-${group[0].tempId ?? group[0].id}`,
          messages: group,
        });
        i = j - 1;
        continue;
      }
    }
    rows.push({ kind: 'single', message: m });
  }
  return rows;
}

export function MessageThread({ conversationId }: { conversationId: number }) {
  const conversation = useConversation(conversationId);
  const myId = useAuthStore((s) => s.user?.id);
  const myName = useAuthStore((s) => s.user?.displayName);
  const setActive = useChatStore((s) => s.setActiveConversation);
  const clearTyping = useChatStore((s) => s.clearTyping);
  const { messages, isLoading, loadOlder, loadingOlder, hasMore } = useMessages(conversationId);
  // Disappearing messages: hide anything past its timer the moment it expires,
  // before the server sweep hard-deletes it. Re-check on a slow ticker, but only
  // while this conversation actually has a timer (no wasted interval otherwise).
  const [nowTick, setNowTick] = useState(0);
  const ttl = conversation?.disappearingTtlSeconds ?? null;
  useEffect(() => {
    if (!ttl) return;
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [ttl]);
  const visibleMessages = useMemo(
    () => messages.filter((m) => !isExpired(m.expiresAt)),
    [messages, nowTick],
  );
  const rows = useMemo(() => buildRows(visibleMessages), [visibleMessages]);
  const isGroup = conversation?.type === 'GROUP';
  // The chat LIST no longer ships group rosters (a 500-member group has no
  // business in a list of 350 chats). The thread fetches the roster it needs —
  // one cached request per group opened.
  const { data: group } = useGroup(isGroup ? conversationId : null);
  const groupMembers = useMemo(() => (group?.members ?? []).map((m) => m.user), [group?.members]);
  const people = isGroup ? groupMembers : (conversation?.members ?? []);
  const avatarBySender = useMemo(
    () => new Map(people.map((m) => [m.id, m.avatarUrl])),
    [people],
  );
  // Names an @mention can spell here — memoized so memoized bubbles keep their props.
  const mentionNames = useMemo(
    () => (isGroup ? mentionNamesOf(groupMembers.map((m) => m.displayName)) : NO_MENTION_NAMES),
    [isGroup, groupMembers],
  );
  const markRead = useMarkRead();

  // Who (other than me) is typing in this conversation right now.
  const other = conversation ? otherMember(conversation, myId) : undefined;
  const blocked = useIsBlocked(other?.id);
  const typers = useChatStore((s) => s.typing[conversationId] ?? NO_TYPERS);
  const otherTypers = typers.filter((t) => t.userId !== myId);
  // Hide a blocked user's typing indicator from the blocker (WhatsApp-style).
  const someoneTyping = otherTypers.length > 0 && !blocked;
  const pinnedMessages = useMemo(
    () => visibleMessages.filter((m) => m.pinned && !m.deleted),
    [visibleMessages],
  );
  const typingLabel =
    conversation?.type === 'GROUP' && otherTypers.length > 0
      ? otherTypers.length === 1
        ? otherTypers[0].userName
        : `${otherTypers.map((t) => t.userName).join(', ')}`
      : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<Message | null>(null);

  // Jump to the original of a reply. Read hasMore/loadOlder through refs so the
  // callback stays stable (memoized bubbles mustn't re-render on every change).
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadOlderRef = useRef(loadOlder);
  loadOlderRef.current = loadOlder;
  const jumpToMessage = useCallback(async (id: number) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pinnedToBottom.current = false;
        el.classList.add('reply-flash');
        window.setTimeout(() => el.classList.remove('reply-flash'), 1300);
        return;
      }
      // Not rendered yet — pull in older pages and retry.
      if (!hasMoreRef.current) break;
      await loadOlderRef.current();
    }
  }, []);

  // Track whether the user is pinned to the bottom so live messages autoscroll
  // without yanking them away while reading history.
  const pinnedToBottom = useRef(true);

  // Activate conversation + subscribe to its topics.
  useEffect(() => {
    setActive(conversationId);
    clearMessageNotifications(conversationId);
    socketService.watchConversation(conversationId);
    return () => {
      socketService.unwatchConversation(conversationId);
      clearTyping(conversationId);
      setActive(null);
    };
  }, [conversationId, setActive, clearTyping]);

  // Mark the conversation read on open and whenever new messages land.
  const lastMessageId = visibleMessages.length ? visibleMessages[visibleMessages.length - 1].id : 0;
  useEffect(() => {
    if (!conversationId) return;
    markRead.mutate(conversationId);
    const last = messages.filter((m) => m.id > 0).at(-1);
    if (last) socketService.sendRead(conversationId, last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, lastMessageId]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Auto-scroll to bottom on new messages, and when the typing bubble appears,
  // as long as the user is pinned to the bottom.
  useLayoutEffect(() => {
    if (pinnedToBottom.current) scrollToBottom();
  }, [lastMessageId, isLoading, someoneTyping]);

  // On first load / conversation switch, always land at the newest message.
  // A delayed pass catches late layout (e.g. images) that grows the scroll height.
  useEffect(() => {
    if (isLoading || messages.length === 0) return;
    pinnedToBottom.current = true;
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isLoading]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore && !loadingOlder) {
      const prevHeight = el.scrollHeight;
      void loadOlder().then(() => {
        // Preserve scroll position after prepending older messages.
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Conversation not found.
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex h-full min-w-0 flex-1 flex-col">
      <ChatHeader
        conversation={conversation}
        onOpenInfo={conversation.type === 'GROUP' ? () => setGroupInfoOpen(true) : undefined}
        onToggleInfo={
          conversation.type === 'DIRECT' ? () => setInfoOpen((o) => !o) : undefined
        }
        infoActive={infoOpen}
      />

      {pinnedMessages.length > 0 && (
        <button
          type="button"
          onClick={() =>
            pinnedMessages.length > 1
              ? setPinnedOpen(true)
              : jumpToMessage(pinnedMessages[0].id)
          }
          className="flex w-full items-center gap-2 border-b border-white/40 bg-white/70 px-4 py-2 text-left backdrop-blur-md transition hover:bg-white/90 dark:border-white/5 dark:bg-slate-900/70 dark:hover:bg-slate-900/90"
        >
          <Pin className="h-4 w-4 shrink-0 text-brand-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              Pinned{pinnedMessages.length > 1 ? ` · ${pinnedMessages.length}` : ''}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {pinnedPreview(pinnedMessages[pinnedMessages.length - 1])}
            </p>
          </div>
          {pinnedMessages.length > 1 && (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-1 overflow-y-auto bg-surface px-4 py-4 cs-scroll"
      >
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <Spinner className="h-4 w-4" />
          </div>
        )}

        {/* Say plainly, at the top of the thread, that this chat is encrypted — the
            padlock by the name is too easy to miss for something people are meant to
            be able to trust. Renders only when it is actually true. */}
        {!isLoading && conversation.type === 'DIRECT' && (
          <EncryptionNotice peerId={otherMember(conversation, myId)?.id} />
        )}

        {isLoading ? (
          <SkeletonThread />
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            No messages yet. Say hello!
          </div>
        ) : (
          rows.map((row, idx) => {
            const first = row.kind === 'album' ? row.messages[0] : row.message;
            const prevRow = rows[idx - 1];
            const prevLast = prevRow
              ? prevRow.kind === 'album'
                ? prevRow.messages[prevRow.messages.length - 1]
                : prevRow.message
              : undefined;
            const showDivider = !prevLast || !sameDay(prevLast.createdAt, first.createdAt);
            const mine = first.senderId === myId;
            const showSender =
              conversation.type === 'GROUP' &&
              !mine &&
              (!prevLast || prevLast.senderId !== first.senderId);
            const nextRow = rows[idx + 1];
            const nextFirst = nextRow
              ? nextRow.kind === 'album'
                ? nextRow.messages[0]
                : nextRow.message
              : undefined;
            const showAvatar = !mine && (!nextFirst || nextFirst.senderId !== first.senderId);
            const avatarUrl = avatarBySender.get(first.senderId) ?? undefined;
            return (
              <Fragment key={row.kind === 'album' ? row.key : (row.message.tempId ?? row.message.id)}>
                {showDivider && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full border border-white/10 bg-white/70 px-3 py-1 text-[11px] font-medium tracking-wide text-slate-500 backdrop-blur-md dark:bg-white/[0.06] dark:text-slate-300">
                      {formatDayDivider(first.createdAt)}
                    </span>
                  </div>
                )}
                {row.kind === 'album' ? (
                  <ImageAlbum
                    messages={row.messages}
                    mine={mine}
                    showSender={showSender}
                    avatarColumn={conversation.type === 'GROUP'}
                    showAvatar={showAvatar}
                    avatarUrl={avatarUrl}
                    onForward={setForwardMsg}
                  />
                ) : (
                  <MessageBubble
                    message={row.message}
                    mine={mine}
                    showSender={showSender}
                    avatarColumn={conversation.type === 'GROUP'}
                    showAvatar={showAvatar}
                    avatarUrl={avatarUrl}
                    onForward={setForwardMsg}
                    onJumpTo={jumpToMessage}
                    mentionNames={mentionNames}
                    myName={myName}
                    onShowInfo={isGroup ? setInfoMsg : undefined}
                  />
                )}
              </Fragment>
            );
          })
        )}
        {someoneTyping && <TypingBubble label={typingLabel} />}
        <div ref={bottomRef} />
      </div>

      {other?.deleted ? (
        // Their account is gone: the history stays readable, but there is nobody
        // left to receive a reply, so don't offer a composer that can only fail.
        <div className="shrink-0 border-t border-white/5 bg-surface px-4 py-4 text-center">
          <p className="text-sm text-on-surface-variant">
            This account has been deleted. You can no longer send messages here.
          </p>
        </div>
      ) : (
        <MessageInput conversationId={conversationId} />
      )}
      </div>

      {infoOpen && conversation.type === 'DIRECT' && (
        <ContactInfoPanel
          conversation={conversation}
          other={other}
          onClose={() => setInfoOpen(false)}
        />
      )}

      {conversation.type === 'GROUP' && (
        <GroupInfoModal
          open={groupInfoOpen}
          onClose={() => setGroupInfoOpen(false)}
          groupId={conversationId}
        />
      )}

      <ForwardModal message={forwardMsg} onClose={() => setForwardMsg(null)} />

      <MessageInfoModal message={infoMsg} onClose={() => setInfoMsg(null)} />

      <Modal open={pinnedOpen} onClose={() => setPinnedOpen(false)} title={`Pinned messages · ${pinnedMessages.length}`}>
        <ul className="divide-y divide-white/5">
          {pinnedMessages.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setPinnedOpen(false);
                  jumpToMessage(m.id);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-primary">{m.senderName}</p>
                <p className="truncate text-sm text-on-surface-variant">
                  {pinnedPreview(m) || 'Message'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => socketService.pinMessage(m.conversationId, m.id, false)}
                className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface"
                aria-label="Unpin"
              >
                <PinOff className="h-4 w-4" /> Unpin
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
