import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Spinner, FullPageSpinner } from '@/components/ui/Spinner';
import { useMessages } from '@/hooks/useMessages';
import { useConversation, useMarkRead } from '@/hooks/useConversations';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { socketService } from '@/services/socket';
import { formatDayDivider } from '@/utils/format';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { ForwardModal } from './ForwardModal';
import { GroupInfoModal } from '@/features/groups/GroupInfoModal';
import type { Message } from '@/types';

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function MessageThread({ conversationId }: { conversationId: number }) {
  const conversation = useConversation(conversationId);
  const myId = useAuthStore((s) => s.user?.id);
  const setActive = useChatStore((s) => s.setActiveConversation);
  const clearTyping = useChatStore((s) => s.clearTyping);
  const { messages, isLoading, loadOlder, loadingOlder, hasMore } = useMessages(conversationId);
  const markRead = useMarkRead();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);

  // Track whether the user is pinned to the bottom so live messages autoscroll
  // without yanking them away while reading history.
  const pinnedToBottom = useRef(true);

  // Activate conversation + subscribe to its topics.
  useEffect(() => {
    setActive(conversationId);
    socketService.watchConversation(conversationId);
    return () => {
      socketService.unwatchConversation(conversationId);
      clearTyping(conversationId);
      setActive(null);
    };
  }, [conversationId, setActive, clearTyping]);

  // Mark the conversation read on open and whenever new messages land.
  const lastMessageId = messages.length ? messages[messages.length - 1].id : 0;
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

  // Auto-scroll to bottom on new messages when pinned.
  useLayoutEffect(() => {
    if (pinnedToBottom.current) scrollToBottom();
  }, [lastMessageId, isLoading]);

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
    <div className="flex h-full flex-col">
      <ChatHeader
        conversation={conversation}
        onOpenInfo={conversation.type === 'GROUP' ? () => setGroupInfoOpen(true) : undefined}
      />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="chat-bg flex-1 space-y-1 overflow-y-auto px-4 py-4 scrollbar-thin"
      >
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <Spinner className="h-4 w-4" />
          </div>
        )}

        {isLoading ? (
          <FullPageSpinner />
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((message: Message, idx) => {
            const prev = messages[idx - 1];
            const showDivider = !prev || !sameDay(prev.createdAt, message.createdAt);
            const mine = message.senderId === myId;
            const showSender =
              conversation.type === 'GROUP' &&
              !mine &&
              (!prev || prev.senderId !== message.senderId);
            return (
              <Fragment key={message.tempId ?? message.id}>
                {showDivider && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-slate-500 shadow-sm dark:bg-slate-800/80 dark:text-slate-400">
                      {formatDayDivider(message.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={message}
                  mine={mine}
                  showSender={showSender}
                  onForward={setForwardMsg}
                />
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <TypingIndicator conversationId={conversationId} />
      <MessageInput conversationId={conversationId} />

      {conversation.type === 'GROUP' && (
        <GroupInfoModal
          open={groupInfoOpen}
          onClose={() => setGroupInfoOpen(false)}
          groupId={conversationId}
        />
      )}

      <ForwardModal message={forwardMsg} onClose={() => setForwardMsg(null)} />
    </div>
  );
}
