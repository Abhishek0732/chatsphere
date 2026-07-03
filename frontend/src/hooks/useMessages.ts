import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMessages } from '@/api/conversations';
import { queryKeys } from '@/api/queryKeys';
import { prependMessages } from '@/services/messageCache';
import type { Message } from '@/types';

const PAGE_SIZE = 30;

/**
 * Loads the newest page of messages for a conversation into a flat cache
 * (newest last). The WebSocket service appends live messages to the same
 * cache entry, and `loadOlder` prepends older pages.
 */
export function useMessages(conversationId: number | null) {
  const query = useQuery({
    queryKey: conversationId != null ? queryKeys.messages(conversationId) : ['messages', 'none'],
    queryFn: () => getMessages({ conversationId: conversationId as number, limit: PAGE_SIZE }),
    enabled: conversationId != null,
    // Live updates arrive over WS; don't clobber the cache on refocus.
    staleTime: Infinity,
  });

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadOlder = useCallback(async () => {
    if (conversationId == null || loadingOlder || !hasMore) return;
    const current = query.data ?? [];
    const oldest = current.find((m) => !m.tempId);
    if (!oldest) return;

    setLoadingOlder(true);
    try {
      const older = await getMessages({
        conversationId,
        before: oldest.id,
        limit: PAGE_SIZE,
      });
      if (older.length < PAGE_SIZE) setHasMore(false);
      prependMessages(conversationId, older);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, query.data]);

  const messages: Message[] = query.data ?? [];

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    loadOlder,
    loadingOlder,
    hasMore,
  };
}
