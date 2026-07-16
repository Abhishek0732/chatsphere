import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Tracks which incoming media messages the user has "downloaded" (revealed).
 * messenger-style: received photos/videos stay hidden behind a download button
 * until the user taps it, and remain revealed afterwards (persisted).
 */
interface MediaRevealState {
  revealed: Record<number, true>;
  reveal: (messageId: number) => void;
  isRevealed: (messageId: number) => boolean;
}

export const useMediaRevealStore = create<MediaRevealState>()(
  persist(
    (set, get) => ({
      revealed: {},
      reveal: (messageId) =>
        set((s) => ({ revealed: { ...s.revealed, [messageId]: true } })),
      isRevealed: (messageId) => Boolean(get().revealed[messageId]),
    }),
    { name: 'chatsphere-media-revealed' },
  ),
);
