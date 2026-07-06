import { api } from './client';
import type { CreateStatusPayload, StatusItem, StatusUser, StatusViewer } from '@/types';

export async function getStatusFeed(): Promise<StatusUser[]> {
  const { data } = await api.get<StatusUser[]>('/status');
  return data;
}

export async function createStatus(payload: CreateStatusPayload): Promise<StatusItem> {
  const { data } = await api.post<StatusItem>('/status', payload);
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
