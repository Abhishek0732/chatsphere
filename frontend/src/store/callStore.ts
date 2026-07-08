import { create } from 'zustand';
import type { ActiveCall } from '@/types';

/**
 * Holds the single on-screen call (Phase 1 is 1:1, one call at a time). Pure
 * state + setters; orchestration (publishing signals, ringtone) lives in the
 * socket service and the CallManager component.
 */
interface CallState {
  call: ActiveCall | null;
  /** Local UI toggles — cosmetic until media lands in Phase 2. */
  muted: boolean;
  speaker: boolean;

  setCall: (call: ActiveCall | null) => void;
  patchCall: (patch: Partial<ActiveCall>) => void;
  clear: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

export const useCallStore = create<CallState>()((set) => ({
  call: null,
  muted: false,
  speaker: false,

  setCall: (call) => set({ call, muted: false, speaker: false }),
  patchCall: (patch) =>
    set((s) => (s.call ? { call: { ...s.call, ...patch } } : {})),
  clear: () => set({ call: null, muted: false, speaker: false }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleSpeaker: () => set((s) => ({ speaker: !s.speaker })),
}));

/** Non-hook accessors for plain modules (the socket service). */
export const callAccessors = {
  getCall: () => useCallStore.getState().call,
  setCall: (c: ActiveCall | null) => useCallStore.getState().setCall(c),
  patch: (p: Partial<ActiveCall>) => useCallStore.getState().patchCall(p),
  clear: () => useCallStore.getState().clear(),
};
