import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMessages } from '@/api/conversations';
import { queryKeys } from '@/api/queryKeys';
import { prependMessages } from '@/services/messageCache';
import { useOutboxStore } from '@/store/outboxStore';
import { useDecryptedMessages } from '@/hooks/useDecrypted';
import { outboxItemToMessage } from '@/services/outbox';
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

  // Messages typed while offline live in the outbox, NOT in the query cache — if
  // they were written into the cache, a conversation whose history had not been
  // fetched yet would look like it contained only them (the cache would be
  // non-empty, so the fetch would never run). They are appended here instead, so
  // after a reload the user still sees what they typed, waiting to go out.
  const queued = useOutboxStore((s) => s.items);
  const messages: Message[] = useMemo(() => {
    const fetched = query.data ?? [];
    if (conversationId == null || queued.length === 0) return fetched;
    const known = new Set(fetched.map((m) => m.tempId).filter(Boolean));
    const pending = queued
      .filter((i) => i.conversationId === conversationId && !known.has(i.tempId))
      .map(outboxItemToMessage);
    return pending.length ? [...fetched, ...pending] : fetched;
  }, [query.data, queued, conversationId]);

  // Direct chats are end-to-end encrypted: the server only ever had ciphertext, so
  // the thread is decrypted here, in the browser, before anything renders it.
  const decrypted = useDecryptedMessages(messages, conversationId);

  return {
    messages: decrypted,
    isLoading: query.isLoading,
    isError: query.isError,
    loadOlder,
    loadingOlder,
    hasMore,
  };
}
