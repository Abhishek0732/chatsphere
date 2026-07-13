import { api } from './client';
import type { AddMembersResult, ConversationSummary, GroupDetail, GroupInvite } from '@/types';

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

/**
 * Add people to a group. Contacts join immediately; everyone else is only
 * invited — the result says which happened to whom.
 */
export async function addGroupMembers(id: number, userIds: number[]): Promise<AddMembersResult> {
  const { data } = await api.post<AddMembersResult>(`/groups/${id}/members`, { userIds });
  return data;
}

/** Group invites waiting on me. */
export async function getGroupInvites(): Promise<GroupInvite[]> {
  const { data } = await api.get<GroupInvite[]>('/groups/invites');
  return data;
}

export async function acceptGroupInvite(inviteId: number): Promise<ConversationSummary> {
  const { data } = await api.post<ConversationSummary>(`/groups/invites/${inviteId}/accept`);
  return data;
}

export async function declineGroupInvite(inviteId: number): Promise<void> {
  await api.post(`/groups/invites/${inviteId}/decline`);
}

export async function removeGroupMember(id: number, userId: number): Promise<void> {
  await api.delete(`/groups/${id}/members/${userId}`);
}

export async function setGroupMemberRole(
  id: number,
  userId: number,
  role: 'ADMIN' | 'MEMBER',
): Promise<void> {
  await api.put(`/groups/${id}/members/${userId}/role`, { role });
}
