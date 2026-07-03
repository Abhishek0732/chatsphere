import { api } from './client';
import type { ConversationSummary, GroupDetail } from '@/types';

export interface CreateGroupPayload {
  name: string;
  memberIds: number[];
  avatarUrl?: string;
}

export async function createGroup(payload: CreateGroupPayload): Promise<ConversationSummary> {
  const { data } = await api.post<ConversationSummary>('/groups', payload);
  return data;
}

export async function getGroup(id: number): Promise<GroupDetail> {
  const { data } = await api.get<GroupDetail>(`/groups/${id}`);
  return data;
}

export async function updateGroup(
  id: number,
  payload: { name: string; avatarUrl?: string },
): Promise<void> {
  await api.put(`/groups/${id}`, payload);
}

export async function addGroupMembers(id: number, userIds: number[]): Promise<void> {
  await api.post(`/groups/${id}/members`, { userIds });
}

export async function removeGroupMember(id: number, userId: number): Promise<void> {
  await api.delete(`/groups/${id}/members/${userId}`);
}
