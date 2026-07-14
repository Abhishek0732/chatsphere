import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { socketService } from '@/services/socket';
import { makeTempId } from '@/utils/id';
import { bumpConversation, upsertMessage } from '@/services/messageCache';
import { outboxAccessors } from '@/store/outboxStore';
import type { Message, MessageType, ReplyPreview } from '@/types';

export interface OutgoingMessage {
  conversationId: number;
  content: string;
  type?: MessageType;
  attachmentUrl?: string;
  replyTo?: ReplyPreview | null;
  /** Ids of the users @mentioned in the text (group chats). */
  mentions?: number[];
}

/**
 * Optimistically appends a message to the cache with a tempId, then publishes
 * over the socket. The server echo (carrying the same tempId) reconciles it.
 */
export function useSendMessage() {
  const user = useAuthStore((s) => s.user);

  return useCallback(
    ({ conversationId, content, type = 'TEXT', attachmentUrl, replyTo, mentions }: OutgoingMessage) => {
      if (!user) return;
      const trimmed = content.trim();
      if (!trimmed && !attachmentUrl) return;

      const tempId = makeTempId();
      const optimistic: Message = {
        id: -Date.now(), // temporary negative id, replaced on echo
        conversationId,
        senderId: user.id,
        senderName: user.displayName,
        content: trimmed,
        type,
        attachmentUrl,
        createdAt: new Date().toISOString(),
        status: 'SENT',
        tempId,
        replyTo: replyTo ?? null,
        mentions,
      };

      upsertMessage(optimistic);
      bumpConversation(optimistic, { incrementUnread: false });

      const ok = socketService.sendMessage({
        conversationId,
        content: trimmed,
        type,
        attachmentUrl,
        replyToId: replyTo?.id,
        tempId,
        mentions,
      });

      if (!ok) {
        // The socket is down (offline, or reconnecting). Park it in the outbox and
        // send it the moment we are back, rather than throwing away what the user
        // typed — losing a typed message is the one thing a chat app may not do.
        outboxAccessors.enqueue({
          tempId,
          conversationId,
          content: trimmed,
          type,
          attachmentUrl,
          replyToId: replyTo?.id,
          mentions,
          replyTo: replyTo ?? null,
          senderId: user.id,
          senderName: user.displayName,
          queuedAt: optimistic.createdAt,
        });
        upsertMessage({ ...optimistic, queued: true });
      }
    },
    [user],
  );
}
