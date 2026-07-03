import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  clearConversation,
  getConversations,
  getOrCreateDirect,
  markConversationRead,
} from '@/api/conversations';
import { queryKeys } from '@/api/queryKeys';
import { clearConversationMessages, clearUnread } from '@/services/messageCache';
import type { ConversationSummary } from '@/types';

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: getConversations,
  });
}

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
