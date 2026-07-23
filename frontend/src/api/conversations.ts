import { api } from './client';
import type {
  ConversationSummary,
  ExportMessage,
  MediaItem,
  Message,
  MessageInfo,
} from '@/types';

export type MediaKind = 'media' | 'docs' | 'links';

/** A page of shared media/docs/links in a conversation, newest first (cursor: before). */
export async function getConversationMedia(
  conversationId: number,
  kind: MediaKind = 'media',
  before?: number,
  limit = 30,
): Promise<MediaItem[]> {
  const { data } = await api.get<MediaItem[]>(`/conversations/${conversationId}/media`, {
    params: { kind, before, limit },
  });
  return data;
}

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

/** Who has seen one of my messages ("Message info"). Sender-only, group chats. */
export async function getMessageInfo(
  conversationId: number,
  messageId: number,
): Promise<MessageInfo> {
  const { data } = await api.get<MessageInfo>(
    `/conversations/${conversationId}/messages/${messageId}/info`,
  );
  return data;
}

/** Clear a conversation's messages for the current user (keeps it in the list). */
export async function clearConversation(conversationId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}/messages`);
}

/**
 * Delete a whole conversation from the list. forEveryone=false ("delete for me")
 * hides it only for the caller — it reappears if the other person messages again.
 * forEveryone=true also removes it from the other participant's list.
 */
export async function deleteConversation(
  conversationId: number,
  forEveryone: boolean,
): Promise<void> {
  await api.delete(`/conversations/${conversationId}`, { params: { forEveryone } });
}

/**
 * "Delete for me" a single message — hides it from my view only (the other
 * person keeps it). "Delete for everyone" goes over the socket instead.
 */
export async function hideMessage(conversationId: number, messageId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
}

/** Set (ttlSeconds) or clear (null) the disappearing-messages timer. */
export async function setDisappearing(
  conversationId: number,
  ttlSeconds: number | null,
): Promise<void> {
  await api.post(`/conversations/${conversationId}/disappearing`, { ttlSeconds });
}

/**
 * Everything that arrived while we were offline: messages across all my
 * conversations with id greater than the watermark, oldest-first. The reconnect
 * catch-up that online-only live delivery cannot provide.
 */
export async function syncSince(since: number, limit = 500): Promise<Message[]> {
  const { data } = await api.get<Message[]>('/sync', { params: { since, limit } });
  return data;
}
