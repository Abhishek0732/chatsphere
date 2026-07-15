import { api } from './client';

export interface ReportPayload {
  reason: string;
  details?: string;
  messageId?: number;
}

/** Report a user for abuse. Fire-and-forget: the server records it for review. */
export async function reportUser(userId: number, payload: ReportPayload): Promise<void> {
  await api.post(`/reports/${userId}`, payload);
}
