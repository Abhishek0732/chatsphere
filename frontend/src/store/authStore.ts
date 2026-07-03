import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;

  login: (payload: { user: User; accessToken: string; refreshToken: string }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,

      login: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),

      isAuthenticated: () => Boolean(get().accessToken),
    }),
    {
      name: 'chatsphere-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);

// Mark hydration complete once persisted state has loaded. This runs AFTER the store
// is defined (no TDZ) and handles both synchronous (localStorage) and async storage:
// for sync storage `hasHydrated()` is already true here, so the flag flips immediately.
if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ hydrated: true });
} else {
  useAuthStore.persist.onFinishHydration(() => {
    useAuthStore.setState({ hydrated: true });
  });
}

/**
 * Non-hook accessors so plain modules (axios interceptor, socket service)
 * can read/write auth without React.
 */
export const authAccessors = {
  getUserId: () => useAuthStore.getState().user?.id ?? null,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (a: string, r: string) => useAuthStore.getState().setTokens(a, r),
  logout: () => useAuthStore.getState().logout(),
};
