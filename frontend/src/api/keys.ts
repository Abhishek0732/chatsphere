import { api } from './client';

export interface MyKeys {
  publicKey: string | null;
  encPrivateKey: string | null;
  encKeySalt: string | null;
  encKeyIv: string | null;
  keyVersion: number;
}

export interface PeerKey {
  userId: number;
  publicKey: string | null;
  keyVersion: number;
}

export interface PublishKeysPayload {
  publicKey: string;
  encPrivateKey: string;
  encKeySalt: string;
  encKeyIv: string;
  /** True only when the KEY PAIR is new, not when it is re-wrapped under a new password. */
  rotated: boolean;
}

export async function getMyKeys(): Promise<MyKeys> {
  const { data } = await api.get<MyKeys>('/keys/me');
  return data;
}

export async function publishKeys(payload: PublishKeysPayload): Promise<void> {
  await api.post('/keys', payload);
}

export async function getPeerKey(userId: number): Promise<PeerKey> {
  const { data } = await api.get<PeerKey>(`/keys/${userId}`);
  return data;
}
