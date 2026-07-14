import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MessageType, ReplyPreview } from '@/types';

/**
 * The outbox: messages typed while the socket was down.
 *
 * Sending used to be all-or-nothing — if the socket was not connected the message
 * was marked FAILED on the spot and that was the end of it. On a flaky connection
 * (a train, a lift, a laptop waking up) that means the app loses what you typed,
 * which is the one thing a chat app may never do.
 *
 * Now an unsendable message is parked here instead, survives a reload (it is
 * persisted), and is flushed in order the moment the socket comes back.
 */

export interface OutboxItem {
  tempId: string;
  conversationId: number;
  content: string;
  type: MessageType;
  attachmentUrl?: string;
  replyToId?: number;
  mentions?: number[];
  /** For rebuilding the optimistic bubble after a reload. */
  replyTo?: ReplyPreview | null;
  senderId: number;
  senderName: string;
  queuedAt: string;
  /** Queued messages are stored ALREADY ENCRYPTED — plaintext never touches disk. */
  encrypted?: boolean;
}

interface OutboxState {
  items: OutboxItem[];
  enqueue: (item: OutboxItem) => void;
  remove: (tempId: string) => void;
  forConversation: (conversationId: number) => OutboxItem[];
}

/** A stuck queue must not grow without bound (offline for a week, still typing). */
const MAX_QUEUED = 200;

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      items: [],
      enqueue: (item) =>
        set((s) => ({
          items: [...s.items.filter((i) => i.tempId !== item.tempId), item].slice(-MAX_QUEUED),
        })),
      remove: (tempId) => set((s) => ({ items: s.items.filter((i) => i.tempId !== tempId) })),
      forConversation: (conversationId) =>
        get().items.filter((i) => i.conversationId === conversationId),
    }),
    { name: 'chatsphere-outbox' },
  ),
);

/** Non-hook access, for the socket and the send path (which are not components). */
export const outboxAccessors = {
  enqueue: (item: OutboxItem) => useOutboxStore.getState().enqueue(item),
  remove: (tempId: string) => useOutboxStore.getState().remove(tempId),
  all: () => useOutboxStore.getState().items,
  size: () => useOutboxStore.getState().items.length,
};
