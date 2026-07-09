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

export async function getUser(id: number): Promise<User> {
  const { data } = await api.get<User>(`/users/${id}`);
  return data;
}
