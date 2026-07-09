import { api } from './client';
import { getDeviceId } from '@/utils/deviceId';
import type { ActiveCallDto, CallHistoryItem, IceConfig } from '@/types';

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

/** Fetch the ICE servers (STUN + TURN) for the native P2P WebRTC connection. */
export async function getIceServers(): Promise<IceConfig> {
  const { data } = await api.get<IceConfig>('/calls/ice-servers');
  return data;
}
