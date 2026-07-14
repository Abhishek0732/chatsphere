import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  clearConversation,
  getCommonGroups,
  getConversations,
  getOrCreateDirect,
  markConversationRead,
} from '@/api/conversations';
import { queryKeys } from '@/api/queryKeys';
import { clearConversationMessages, clearUnread } from '@/services/messageCache';
import { useDecryptedPreviews } from '@/hooks/useDecrypted';
import type { ConversationSummary } from '@/types';

export function useConversations() {
  const query = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: getConversations,
  });

  // The last-message preview of an encrypted chat is ciphertext as far as the server
  // is concerned — it cannot build the preview for us any more, which is the whole
  // point. So decrypt the previews here, where the keys are.
  const data = useDecryptedPreviews(query.data ?? EMPTY);
  return { ...query, data: query.data ? data : query.data };
}

/** Stable reference, so the decrypt hook doesn't re-run on every render. */
const EMPTY: ConversationSummary[] = [];

export function useConversation(conversationId: number | null) {
  const { data } = useConversations();
  return data?.find((c) => c.id === conversationId) ?? null;
}

/** Open (or create) a 1:1 conversation with a user, then navigate to it. */
export function useOpenDirect() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (targetUserId: number) => getOrCreateDirect(targetUserId),
    onSuccess: (conversation: ConversationSummary) => {
      qc.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) => {
        const list = prev ?? [];
        if (list.some((c) => c.id === conversation.id)) return list;
        return [conversation, ...list];
      });
      navigate(`/chat/${conversation.publicId}`);
    },
  });
}

export function useCommonGroups(conversationId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['common-groups', conversationId],
    queryFn: () => getCommonGroups(conversationId as number),
    enabled: enabled && conversationId != null,
  });
}

export function useMarkRead() {
  return useMutation({
    mutationFn: (conversationId: number) => markConversationRead(conversationId),
    onSuccess: (_data, conversationId) => {
      clearUnread(conversationId);
    },
  });
}

/** Clear a conversation's messages for the current user (keeps it in the list). */
export function useClearChat() {
  return useMutation({
    mutationFn: (conversationId: number) => clearConversation(conversationId),
    onSuccess: (_data, conversationId) => {
      clearConversationMessages(conversationId);
    },
  });
}
