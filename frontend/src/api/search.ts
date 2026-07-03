import { api } from './client';
import type { Message, User } from '@/types';

export async function searchMessages(q: string): Promise<Message[]> {
  const { data } = await api.get<Message[]>('/search/messages', { params: { q } });
  return data;
}

export async function searchUsersGlobal(q: string): Promise<User[]> {
  const { data } = await api.get<User[]>('/search/users', { params: { q } });
  return data;
}
