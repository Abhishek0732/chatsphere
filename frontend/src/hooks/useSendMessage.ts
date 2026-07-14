import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { socketService } from '@/services/socket';
import { makeTempId } from '@/utils/id';
import { bumpConversation, upsertMessage } from '@/services/messageCache';
import { outboxAccessors } from '@/store/outboxStore';
import { decryptedAccessors } from '@/store/decryptedStore';
import { encryptFor } from '@/services/e2ee';
import { directPeerId } from '@/utils/conversation';
import type { Message, MessageType, ReplyPreview } from '@/types';

export interface OutgoingMessage {
  conversationId: number;
  content: string;
  type?: MessageType;
  attachmentUrl?: string;
  /** Real filename/type of an attachment — sealed INSIDE the message when encrypted. */
  attachmentName?: string;
  attachmentMime?: string;
  replyTo?: ReplyPreview | null;
  /** Ids of the users @mentioned in the text (group chats). */
  mentions?: number[];
}

/**
 * Optimistically appends a message to the cache with a tempId, then publishes
 * over the socket. The server echo (carrying the same tempId) reconciles it.
 *
 * In a DIRECT chat the text is encrypted first, so what leaves the browser — and
 * what the server stores — is ciphertext. The bubble on screen still shows what you
 * typed: the plaintext is remembered locally, keyed by the message's tempId.
 */
export function useSendMessage() {
  const user = useAuthStore((s) => s.user);

  return useCallback(
    async ({
      conversationId,
      content,
      type = 'TEXT',
      attachmentUrl,
      attachmentName,
      attachmentMime,
      replyTo,
      mentions,
    }: OutgoingMessage) => {
      if (!user) return;
      const trimmed = content.trim();
      if (!trimmed && !attachmentUrl) return;

      const tempId = makeTempId();

      // Encrypt, if this is a direct chat and the other person has a key. If they
      // do not (an older account, or a browser without WebCrypto), we send in the
      // clear rather than sending them something they could never read.
      const peerId = directPeerId(conversationId, user.id);
      let wireContent = trimmed;
      let encrypted = false;
      if (peerId != null && (trimmed || attachmentUrl)) {
        // For an attachment, the body carries the caption AND the real filename and
        // mime type. They must not travel in the clear: the object in storage is
        // random bytes under a random key precisely so nothing about the file leaks,
        // and "salary-2026.pdf" in a URL would give the whole game away.
        const payload = attachmentUrl
          ? JSON.stringify({ c: trimmed, n: attachmentName ?? '', m: attachmentMime ?? '' })
          : trimmed;
        const sealed = await encryptFor(peerId, payload).catch(() => null);
        if (sealed) {
          wireContent = sealed;
          encrypted = true;
          // Show what they typed, not the ciphertext the echo will bring back.
          decryptedAccessors.put(tempId, payload);
        }
      }

      const optimistic: Message = {
        id: -Date.now(), // temporary negative id, replaced on echo
        conversationId,
        senderId: user.id,
        senderName: user.displayName,
        content: trimmed, // local bubble: always the plaintext
        type,
        attachmentUrl,
        createdAt: new Date().toISOString(),
        status: 'SENT',
        tempId,
        replyTo: replyTo ?? null,
        mentions,
        encrypted,
        attachmentName,
        attachmentMime,
      };

      upsertMessage(optimistic);
      bumpConversation(optimistic, { incrementUnread: false });

      const ok = socketService.sendMessage({
        conversationId,
        content: wireContent,
        type,
        attachmentUrl,
        replyToId: replyTo?.id,
        tempId,
        mentions,
        encrypted,
      });

      if (!ok) {
        // The socket is down (offline, or reconnecting). Park it in the outbox and
        // send it the moment we are back, rather than throwing away what the user
        // typed — losing a typed message is the one thing a chat app may not do.
        // Note it is queued ALREADY ENCRYPTED: the plaintext is never written to disk.
        outboxAccessors.enqueue({
          tempId,
          conversationId,
          content: wireContent,
          type,
          attachmentUrl,
          replyToId: replyTo?.id,
          mentions,
          replyTo: replyTo ?? null,
          senderId: user.id,
          senderName: user.displayName,
          queuedAt: optimistic.createdAt,
          encrypted,
        });
        upsertMessage({ ...optimistic, queued: true });
      }
    },
    [user],
  );
}
