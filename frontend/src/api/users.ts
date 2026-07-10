import { api } from './client';
import type { User } from '@/types';

export interface UpdateProfilePayload {
  displayName?: string;
  about?: string;
  avatarUrl?: string;
  protectAvatar?: boolean;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/users/me');
  return data;
}

export async function updateMe(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await api.put<User>('/users/me', payload);
  return data;
}

export async function searchUsers(search: string): Promise<User[]> {
  const { data } = await api.get<User[]>('/users', { params: { search } });
  return data;
}

export interface QrInfo {
  token: string;
  /** What the QR image encodes (e.g. "chatsphere:add:<token>"). */
  payload: string;
}

/** The current user's "add me" QR payload. */
export async function getMyQr(): Promise<QrInfo> {
  const { data } = await api.get<QrInfo>('/users/me/qr');
  return data;
}

/** Rotate the QR token, invalidating any previously shared code. */
export async function rotateMyQr(): Promise<QrInfo> {
  const { data } = await api.post<QrInfo>('/users/me/qr/rotate');
  return data;
}

export async function getUser(id: number): Promise<User> {
  const { data } = await api.get<User>(`/users/${id}`);
  return data;
}
