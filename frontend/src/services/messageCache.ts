import { queryClient } from './queryClient';
import { queryKeys } from '@/api/queryKeys';
import type { ConversationSummary, Message, MessageStatus } from '@/types';

/** Read the currently-cached message list for a conversation. */
export function getCachedMessages(conversationId: number): Message[] | undefined {
  return queryClient.getQueryData<Message[]>(queryKeys.messages(conversationId));
}

/** Append or reconcile a message into the cached list (newest last). */
export function upsertMessage(message: Message): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(message.conversationId), (prev) => {
    const list = prev ?? [];

    // Reconcile optimistic message by tempId.
    if (message.tempId) {
      const idx = list.findIndex((m) => m.tempId && m.tempId === message.tempId);
      if (idx !== -1) {
        const next = list.slice();
        next[idx] = { ...message };
        return next;
      }
    }

    // De-dupe by server id (e.g. echoed to sender via topic + queue).
    if (list.some((m) => m.id === message.id && !m.tempId)) {
      return list;
    }

    return [...list, message];
  });
}

/** Replace an existing message in place (edit / pin / reaction updates). */
export function replaceMessage(message: Message): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(message.conversationId), (prev) => {
    if (!prev) return prev;
    const idx = prev.findIndex((m) => m.id === message.id);
    if (idx === -1) return prev;
    const next = prev.slice();
    next[idx] = { ...prev[idx], ...message };
    return next;
  });
}

/** Prepend a page of older messages (used by "load older"). */
export function prependMessages(conversationId: number, older: Message[]): void {
  if (older.length === 0) return;
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), (prev) => {
    const list = prev ?? [];
    const existingIds = new Set(list.map((m) => m.id));
    const deduped = older.filter((m) => !existingIds.has(m.id));
    return [...deduped, ...list];
  });
}

/** Mark a message as failed to send. */
export function markMessageFailed(conversationId: number, tempId: string): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), (prev) =>
    (prev ?? []).map((m) => (m.tempId === tempId ? { ...m, failed: true } : m)),
  );
}

/** Mark a message as deleted ("This message was deleted") in the cache. */
export function markMessageDeleted(conversationId: number, messageId: number): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), (prev) =>
    (prev ?? []).map((m) =>
      m.id === messageId
        ? { ...m, deleted: true, content: '', attachmentUrl: undefined, type: 'TEXT' }
        : m,
    ),
  );
}

/**
 * "Delete for me": remove a message from the thread entirely (not a tombstone —
 * it just vanishes for this user). If it was the conversation's list preview,
 * fall back to the newest remaining cached message so the sidebar stays in sync.
 */
export function removeMessageLocally(conversationId: number, messageId: number): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), (prev) =>
    (prev ?? []).filter((m) => m.id !== messageId),
  );
  const remaining = queryClient.getQueryData<Message[]>(queryKeys.messages(conversationId));
  queryClient.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) =>
    (prev ?? []).map((c) => {
      if (c.id !== conversationId || c.lastMessage?.id !== messageId) return c;
      const newest = remaining && remaining.length ? remaining[remaining.length - 1] : null;
      return { ...c, lastMessage: newest };
    }),
  );
}

/** Update statuses of messages up to and including `messageId` for a conversation. */
export function applyReadReceipt(conversationId: number, messageId: number): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), (prev) => {
    if (!prev) return prev;
    // Only rebuild the array (and re-render the thread) if something actually
    // changes — read receipts fire often and most are no-ops.
    let changed = false;
    const next = prev.map((m) => {
      if (m.id <= messageId && m.status !== 'READ') {
        changed = true;
        return { ...m, status: 'READ' as MessageStatus };
      }
      return m;
    });
    return changed ? next : prev;
  });
}

/** Update the conversation list when a message arrives / is sent. */
export function bumpConversation(message: Message, opts: { incrementUnread: boolean }): void {
  queryClient.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) => {
    if (!prev) return prev;
    const idx = prev.findIndex((c) => c.id === message.conversationId);
    if (idx === -1) {
      // Unknown conversation -> trigger a refetch elsewhere.
      return prev;
    }
    const conv = prev[idx];
    const updated: ConversationSummary = {
      ...conv,
      lastMessage: message,
      updatedAt: message.createdAt,
      unreadCount: opts.incrementUnread ? conv.unreadCount + 1 : conv.unreadCount,
    };
    const rest = prev.filter((_, i) => i !== idx);
    return [updated, ...rest];
  });
}

/** Empty a conversation's messages for me, keeping it in the list ("clear chat"). */
export function clearConversationMessages(conversationId: number): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(conversationId), []);
  queryClient.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) =>
    (prev ?? []).map((c) =>
      c.id === conversationId ? { ...c, lastMessage: null, unreadCount: 0 } : c,
    ),
  );
}

/** Drop a conversation from the list entirely ("delete chat") and forget its messages. */
export function removeConversation(conversationId: number): void {
  queryClient.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) =>
    (prev ?? []).filter((c) => c.id !== conversationId),
  );
  queryClient.removeQueries({ queryKey: queryKeys.messages(conversationId) });
}

/** Reset unread count for a conversation (after opening / read). */
export function clearUnread(conversationId: number): void {
  queryClient.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) =>
    (prev ?? []).map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
  );
}
