import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { socketService } from '@/services/socket';
import { makeTempId } from '@/utils/id';
import { bumpConversation, markMessageFailed, upsertMessage } from '@/services/messageCache';
import type { Message, MessageType, ReplyPreview } from '@/types';

export interface OutgoingMessage {
  conversationId: number;
  content: string;
  type?: MessageType;
  attachmentUrl?: string;
  replyTo?: ReplyPreview | null;
}

/**
 * Optimistically appends a message to the cache with a tempId, then publishes
 * over the socket. The server echo (carrying the same tempId) reconciles it.
 */
export function useSendMessage() {
  const user = useAuthStore((s) => s.user);

  return useCallback(
    ({ conversationId, content, type = 'TEXT', attachmentUrl, replyTo }: OutgoingMessage) => {
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
      });

      if (!ok) {
        markMessageFailed(conversationId, tempId);
      }
    },
    [user],
  );
}
