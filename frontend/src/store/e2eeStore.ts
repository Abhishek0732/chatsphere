import { create } from 'zustand';

/**
 * Whether the encryption key is unlocked yet.
 *
 * Unlocking is asynchronous (fetch the wrapped key, run 250k PBKDF2 rounds), and the
 * thread renders long before it finishes. Without this signal the UI tried to decrypt
 * with no key, cached the failure, and showed "can't be read" FOREVER — on a fresh
 * device it looked exactly like the history had been lost. The thread now waits for
 * `ready` and decrypts the moment the key lands.
 */
interface E2eeState {
  ready: boolean;
  setReady: (ready: boolean) => void;
}

export const useE2eeStore = create<E2eeState>((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));

export const e2eeAccessors = {
  setReady: (ready: boolean) => useE2eeStore.getState().setReady(ready),
};
