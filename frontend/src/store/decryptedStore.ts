import { create } from 'zustand';

/**
 * Plaintext we have decrypted this session, keyed by message id (or tempId, for a
 * message of our own that has not been echoed back yet).
 *
 * Decryption is asynchronous, but rendering is not — so results are cached here and
 * the thread re-renders as they land. Nothing is persisted: plaintext never touches
 * disk, and a reload simply decrypts again from the key on this device.
 */

interface DecryptedState {
  byKey: Record<string, string | null>; // null = we tried and could not read it
  put: (key: string, plaintext: string | null) => void;
  putMany: (entries: Array<[string, string | null]>) => void;
}

export const useDecryptedStore = create<DecryptedState>((set) => ({
  byKey: {},
  put: (key, plaintext) => set((s) => ({ byKey: { ...s.byKey, [key]: plaintext } })),
  putMany: (entries) =>
    set((s) => {
      if (entries.length === 0) return s;
      const next = { ...s.byKey };
      for (const [k, v] of entries) next[k] = v;
      return { byKey: next };
    }),
}));

export const decryptedAccessors = {
  /** Remember the plaintext of a message we just sent, so it renders instantly. */
  put: (key: string, plaintext: string | null) => useDecryptedStore.getState().put(key, plaintext),
  get: (key: string) => useDecryptedStore.getState().byKey[key],
};
