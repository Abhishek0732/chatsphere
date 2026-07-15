import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Which contacts I've verified the security code (safety number) with.
 *
 * We store the exact safety number that was verified, NOT just a boolean — so if
 * either party's identity key later changes (a reset, a reinstall, or a real
 * attack), the number no longer matches and the contact silently drops back to
 * "not verified". A checkmark must never outlive the key it vouches for.
 */
interface VerifiedState {
  /** peerUserId -> the 60-digit safety number that was confirmed. */
  verified: Record<number, string>;
  markVerified: (peerId: number, safetyNumber: string) => void;
  clearVerified: (peerId: number) => void;
  isVerified: (peerId: number, currentSafetyNumber: string | null) => boolean;
}

export const useVerifiedStore = create<VerifiedState>()(
  persist(
    (set, get) => ({
      verified: {},
      markVerified: (peerId, safetyNumber) =>
        set((s) => ({ verified: { ...s.verified, [peerId]: safetyNumber } })),
      clearVerified: (peerId) =>
        set((s) => {
          const next = { ...s.verified };
          delete next[peerId];
          return { verified: next };
        }),
      isVerified: (peerId, currentSafetyNumber) =>
        currentSafetyNumber != null && get().verified[peerId] === currentSafetyNumber,
    }),
    { name: 'chatsphere-verified' },
  ),
);
