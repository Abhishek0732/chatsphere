import { api } from './client';
import { getDeviceId } from '@/utils/deviceId';
import type { ActiveCallDto, CallHistoryItem, CallTokenDto } from '@/types';

/** Register this browser as a device so the backend knows where to ring. */
export async function registerDevice(): Promise<void> {
  await api.post('/calls/devices', { deviceUid: getDeviceId(), platform: 'WEB' });
}

/** The user's current live call (204 -> null) — used to resume after a reload. */
export async function getActiveCall(): Promise<ActiveCallDto | null> {
  const res = await api.get<ActiveCallDto>('/calls/active');
  return res.status === 204 ? null : res.data;
}

export async function getCallHistory(): Promise<CallHistoryItem[]> {
  const { data } = await api.get<CallHistoryItem[]>('/calls');
  return data;
}

export async function getMissedCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/calls/missed/count');
  return data.count;
}

/** Mint this participant's LiveKit token + ICE servers to join the media room. */
export async function getCallToken(callId: string): Promise<CallTokenDto> {
  const { data } = await api.get<CallTokenDto>(`/calls/${callId}/token`);
  return data;
}
