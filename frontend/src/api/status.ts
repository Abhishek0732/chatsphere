import { api } from './client';
import type {
  CreateStatusPayload,
  StatusItem,
  StatusPrivacy,
  StatusReplyPayload,
  StatusUser,
  StatusViewer,
} from '@/types';

export async function getStatusFeed(): Promise<StatusUser[]> {
  const { data } = await api.get<StatusUser[]>('/status');
  return data;
}

export async function createStatus(payload: CreateStatusPayload): Promise<StatusItem> {
  const { data } = await api.post<StatusItem>('/status', payload);
  return data;
}

/** Add a status I was @mentioned in to my own. */
export async function addStatusToMine(id: number): Promise<StatusItem> {
  const { data } = await api.post<StatusItem>(`/status/${id}/add`);
  return data;
}

export async function markStatusViewed(id: number): Promise<void> {
  await api.post(`/status/${id}/view`);
}

export async function getStatusViewers(id: number): Promise<StatusViewer[]> {
  const { data } = await api.get<StatusViewer[]>(`/status/${id}/views`);
  return data;
}

export async function deleteStatus(id: number): Promise<void> {
  await api.delete(`/status/${id}`);
}

export async function replyToStatus(id: number, payload: StatusReplyPayload): Promise<void> {
  await api.post(`/status/${id}/reply`, payload);
}

export async function getStatusPrivacy(): Promise<StatusPrivacy> {
  const { data } = await api.get<StatusPrivacy>('/status/privacy');
  return data;
}

export async function setStatusPrivacy(payload: StatusPrivacy): Promise<StatusPrivacy> {
  const { data } = await api.put<StatusPrivacy>('/status/privacy', payload);
  return data;
}
