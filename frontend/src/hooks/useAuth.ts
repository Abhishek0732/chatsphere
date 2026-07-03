import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { socketService } from '@/services/socket';
import { queryClient } from '@/services/queryClient';
import { toast } from '@/store/toastStore';
import type { LoginPayload, RegisterPayload } from '@/types';

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (data) => {
      login({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      socketService.connect();
      navigate('/', { replace: true });
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
    onSuccess: (data) => {
      login({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      socketService.connect();
      navigate('/', { replace: true });
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
      doLogout();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}
