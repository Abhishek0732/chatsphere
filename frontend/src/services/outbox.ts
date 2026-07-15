import { socketService } from '@/services/socket';
import { outboxAccessors, type OutboxItem } from '@/store/outboxStore';
import { upsertMessage } from '@/services/messageCache';
import type { Message } from '@/types';

/**
 * Flushing the outbox.
 *
 * Anything that could not be sent (socket down) is parked in the outbox and
 * replayed here, oldest first, as soon as the connection is back. The server echo
 * reconciles each one by its tempId — the same mechanism that already reconciles
 * an ordinary optimistic send — so a message queued an hour ago lands exactly like
 * one typed just now.
 */

/** Rebuild the optimistic bubble for a queued message (used after a reload). */
export function outboxItemToMessage(item: OutboxItem): Message {
  return {
    id: -Date.parse(item.queuedAt) || -Date.now(),
    conversationId: item.conversationId,
    senderId: item.senderId,
    senderName: item.senderName,
    content: item.content,
    type: item.type,
    attachmentUrl: item.attachmentUrl,
    createdAt: item.queuedAt,
    status: 'SENT',
    tempId: item.tempId,
    replyTo: item.replyTo ?? null,
    mentions: item.mentions,
    encrypted: item.encrypted,
    viewOnce: item.viewOnce,
    queued: true,
  };
}

/**
 * Messages that have been flushed and are waiting to be echoed back.
 *
 * We wait for each echo before sending the next, because the server does NOT
 * guarantee ordering within a burst: its WebSocket inbound channel is a thread
 * pool, so two frames sent back-to-back on one connection can be persisted
 * concurrently and land in the wrong order. Firing a queued backlog all at once
 * therefore SHUFFLED the user's messages. One at a time, each confirmed, keeps the
 * conversation in the order it was typed.
 */
const pendingEchoes = new Map<string, () => void>();

/** Called by the socket when an echo arrives, to release the next queued message. */
export function ackOutboxEcho(tempId: string | undefined): void {
  if (!tempId) return;
  const resolve = pendingEchoes.get(tempId);
  if (resolve) {
    pendingEchoes.delete(tempId);
    resolve();
  }
}

/** Wait for this message's echo — but never hang the queue on a lost one. */
function waitForEcho(tempId: string, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingEchoes.delete(tempId);
      resolve();
    }, timeoutMs);
    pendingEchoes.set(tempId, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

let flushing = false;

/** Send everything queued, oldest first. Anything not sent stays queued. */
export async function flushOutbox(): Promise<void> {
  if (flushing || !socketService.canSend()) return;
  flushing = true;
  try {
    // Re-read the queue each pass, so a message typed DURING the flush goes out
    // after the backlog rather than jumping ahead of it.
    for (;;) {
      const items = [...outboxAccessors.all()].sort(
        (a, b) => Date.parse(a.queuedAt) - Date.parse(b.queuedAt),
      );
      const item = items[0];
      if (!item) break;
      if (!socketService.canSend()) break; // went offline again mid-flush

      const ok = socketService.sendMessage({
        conversationId: item.conversationId,
        content: item.content,
        type: item.type,
        attachmentUrl: item.attachmentUrl,
        replyToId: item.replyToId,
        tempId: item.tempId,
        mentions: item.mentions,
        encrypted: item.encrypted,
        viewOnce: item.viewOnce,
      });
      // Only drop it once the socket has actually accepted the frame. If the
      // connection died again, it stays queued for the next reconnect.
      if (!ok) break;

      outboxAccessors.remove(item.tempId);
      // On its way — drop the "waiting" clock. The echo (same tempId) replaces
      // this optimistic row with the real message.
      upsertMessage({ ...outboxItemToMessage(item), queued: false });

      await waitForEcho(item.tempId);
    }
  } finally {
    flushing = false;
  }
}
