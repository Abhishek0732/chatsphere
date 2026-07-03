import axios from 'axios';
import { api, API_BASE_URL } from './client';
import type { AuthResponse, LoginPayload, RegisterPayload } from '@/types';

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  // Use a bare client so a possibly-expired access token doesn't trigger the
  // refresh interceptor during teardown.
  await axios.post(
    `${API_BASE_URL}/auth/logout`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );
}
