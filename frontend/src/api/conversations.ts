import { api } from './client';
import type { ConversationSummary, ExportMessage, Message } from '@/types';

/** Fetch the full transcript for a chat export (oldest first). */
export async function exportChat(conversationId: number): Promise<ExportMessage[]> {
  const { data } = await api.get<ExportMessage[]>(`/conversations/${conversationId}/export`);
  return data;
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummary[]>('/conversations');
  return data;
}

export async function getOrCreateDirect(targetUserId: number): Promise<ConversationSummary> {
  const { data } = await api.post<ConversationSummary>('/conversations/direct', {
    targetUserId,
  });
  return data;
}

export interface GetMessagesParams {
  conversationId: number;
  before?: string | number;
  limit?: number;
}

export async function getMessages({
  conversationId,
  before,
  limit = 30,
}: GetMessagesParams): Promise<Message[]> {
  const { data } = await api.get<Message[]>(`/conversations/${conversationId}/messages`, {
    params: { before, limit },
  });
  return data;
}

export async function markConversationRead(conversationId: number): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`);
}

/** Group conversations shared with the other person in a direct chat. */
export async function getCommonGroups(conversationId: number): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummary[]>(
    `/conversations/${conversationId}/common-groups`,
  );
  return data;
}

/** Clear a conversation's messages for the current user (keeps it in the list). */
export async function clearConversation(conversationId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}/messages`);
}
