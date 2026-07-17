import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_RINGTONE } from '@/features/call/ringtone';

/**
 * The incoming-call ringtone the user picked. Persisted to localStorage, so it's
 * per device/browser — the closest thing to "my ringtone" the web allows (a page
 * can't read the phone's system ringtone).
 */
interface RingtoneState {
  ringtone: string;
  setRingtone: (id: string) => void;
}

export const useRingtoneStore = create<RingtoneState>()(
  persist(
    (set) => ({
      ringtone: DEFAULT_RINGTONE,
      setRingtone: (id) => set({ ringtone: id }),
    }),
    { name: 'chatsphere-ringtone', version: 1 },
  ),
);
