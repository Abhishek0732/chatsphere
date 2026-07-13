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

/** The short code behind my shareable invite link (/i/<code>). */
export interface InviteInfo {
  code: string;
}

export async function getMyInvite(): Promise<InviteInfo> {
  const { data } = await api.get<InviteInfo>('/users/me/invite');
  return data;
}

/** Issue a new invite code — any link already shared stops working. */
export async function rotateMyInvite(): Promise<InviteInfo> {
  const { data } = await api.post<InviteInfo>('/users/me/invite/rotate');
  return data;
}

/** Delete my account for good (password re-entry required). */
export async function deleteMyAccount(password: string): Promise<void> {
  await api.delete('/users/me', { data: { password } });
}

export async function getUser(id: number): Promise<User> {
  const { data } = await api.get<User>(`/users/${id}`);
  return data;
}
