import { api } from './client';

export interface PushKey {
  enabled: boolean;
  publicKey: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Is push switched on server-side, and what key do we subscribe with? */
export async function getPushKey(): Promise<PushKey> {
  const { data } = await api.get<PushKey>('/push/key');
  return data;
}

export async function subscribePush(payload: PushSubscriptionPayload): Promise<void> {
  await api.post('/push/subscribe', payload);
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await api.post('/push/unsubscribe', { endpoint, p256dh: '', auth: '' });
}

export interface PushTestResult {
  enabled: boolean;
  devices: number;
}

/** Fire a test notification to this user's own registered devices. */
export async function testPush(): Promise<PushTestResult> {
  const { data } = await api.post<PushTestResult>('/push/test');
  return data;
}
