import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { socketService } from '@/services/socket';
import { forgetEncryption, setupEncryption } from '@/services/e2ee';
import { queryClient } from '@/services/queryClient';
import { toast } from '@/store/toastStore';
import { pendingQrPath } from '@/pages/AddByQrPage';
import type { LoginPayload, RegisterPayload } from '@/types';

/** After auth, resume a pending QR add, else go home. (AddByQrPage clears the key.) */
function postAuthDestination(): string {
  return pendingQrPath() ?? '/';
}

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (data, payload) => {
      login({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      socketService.connect();
      // Unlock the encryption key. Login is the ONLY moment we hold the password,
      // and the password is the only thing that can unwrap the private key — the
      // server stores it wrapped and cannot open it.
      void setupEncryption(data.user.id, payload.password)
        .then((result) => {
          if (result === 'rotated') {
            // The password was reset at some point, so the old private key is gone
            // for good and the messages encrypted to it cannot be recovered. Say so
            // rather than leaving the user staring at unreadable chats.
            toast({
              title: 'New encryption key created',
              description:
                'Your password was reset, so older encrypted messages can no longer be read.',
              variant: 'info',
            });
          }
        })
        .catch(() => undefined);
      navigate(postAuthDestination(), { replace: true });
    },
    onError: () => {
      toast({ title: 'Login failed', description: 'Check your credentials.', variant: 'error' });
    },
  });
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (data, payload) => {
      login({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      socketService.connect();
      void setupEncryption(data.user.id, payload.password).catch(() => undefined);
      navigate(postAuthDestination(), { replace: true });
    },
    onError: () => {
      toast({
        title: 'Registration failed',
        description: 'That username or email may already be taken.',
        variant: 'error',
      });
    },
  });
}

export function useLogout() {
  const doLogout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      const token = useAuthStore.getState().refreshToken;
      if (token) {
        try {
          await authApi.logout(token);
        } catch {
          // Ignore server errors on logout; we clear locally regardless.
        }
      }
    },
    onSettled: () => {
      socketService.disconnect();
      // Wipe the private key from this device. Leaving it behind would let the next
      // person to use this browser read the previous user's encrypted chats.
      void forgetEncryption();
      doLogout();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}
