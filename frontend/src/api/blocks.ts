import { api } from './client';
import type { User } from '@/types';

/** Users I have blocked. */
export async function getBlockedUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/blocks');
  return data;
}

export async function blockUser(userId: number): Promise<void> {
  await api.post(`/blocks/${userId}`);
}

export async function unblockUser(userId: number): Promise<void> {
  await api.delete(`/blocks/${userId}`);
}
