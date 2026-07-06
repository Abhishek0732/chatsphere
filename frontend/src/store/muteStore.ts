import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MuteState {
  /** conversationId -> muted */
  muted: Record<number, boolean>;
  toggleMute: (conversationId: number) => void;
  isMuted: (conversationId: number) => boolean;
}

export const useMuteStore = create<MuteState>()(
  persist(
    (set, get) => ({
      muted: {},
      toggleMute: (conversationId) =>
        set((state) => ({
          muted: { ...state.muted, [conversationId]: !state.muted[conversationId] },
        })),
      isMuted: (conversationId) => Boolean(get().muted[conversationId]),
    }),
    { name: 'chatsphere-muted' },
  ),
);

/** Non-hook accessor for the socket layer. */
export const muteAccessors = {
  isMuted: (conversationId: number) => useMuteStore.getState().isMuted(conversationId),
};
