import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/api/queryKeys';
import type { ConversationSummary } from '@/types';

/** The cached conversation list — the client's own map of who is who. */
function conversations(): ConversationSummary[] {
  return queryClient.getQueryData<ConversationSummary[]>(queryKeys.conversations) ?? [];
}

export function findConversation(conversationId: number): ConversationSummary | undefined {
  return conversations().find((c) => c.id === conversationId);
}

/**
 * The OTHER person in a direct chat, or null for a group (or a conversation we
 * have not loaded). This is what encryption is keyed on: a direct chat has exactly
 * one counterpart, and their public key is what we encrypt to.
 */
export function directPeerId(conversationId: number, myUserId: number): number | null {
  const conv = findConversation(conversationId);
  if (!conv || conv.type !== 'DIRECT') return null;
  const peer = conv.members?.find((m) => m.id !== myUserId);
  return peer?.id ?? null;
}
