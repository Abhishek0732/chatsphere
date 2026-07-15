import { api } from './client';
import type { Message } from '@/types';

/**
 * Tell the server the recipient has opened a view-once message. The server deletes
 * the stored media, nulls the URL, and broadcasts the update. Returns the message
 * DTO (its media already gone) — the caller has the decrypted bytes in memory to
 * show one last time.
 */
export async function consumeViewOnce(conversationId: number, messageId: number): Promise<Message> {
  const { data } = await api.post<Message>(`/conversations/${conversationId}/messages/${messageId}/view-once`);
  return data;
}
