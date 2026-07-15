import { syncSince } from '@/api/conversations';
import { authAccessors } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { queryClient } from './queryClient';
import { queryKeys } from '@/api/queryKeys';
import { bumpConversation, upsertMessage } from './messageCache';
import type { ConversationSummary, Message } from '@/types';

/**
 * Reconnect catch-up. Live delivery only reaches CONNECTED members, so a message
 * that arrives during a disconnect is in the database but was never pushed. On
 * every (re)connect we ask the server for everything past the highest id we can
 * prove we already hold, and merge it. Message ids are globally monotonic, so a
 * single watermark is a correct cursor for the whole account.
 */

let watermark = 0;

/** Record that a message with this id has been seen (advances the cursor). */
export function noteSeen(id: number): void {
  if (id > watermark) watermark = id;
}

/** Forget the cursor on logout / account switch so a new user starts clean. */
export function resetSync(): void {
  watermark = 0;
}

/** The highest id we can prove the client already has (in-memory + list cache). */
function currentSince(): number {
  let since = watermark;
  const list = queryClient.getQueryData<ConversationSummary[]>(queryKeys.conversations);
  if (list) {
    for (const c of list) {
      const id = c.lastMessage?.id ?? 0;
      if (id > since) since = id;
    }
  }
  return since;
}

/**
 * Pull everything missed while the socket was down and merge it. Idempotent —
 * upsert de-dupes by id, so re-running is harmless. A failure is non-fatal:
 * live delivery resumes regardless, and the next reconnect tries again.
 */
export async function runCatchUpSync(): Promise<void> {
  const since = currentSince();
  if (since <= 0) return; // nothing known yet — a fresh page load already has current state
  let missed: Message[];
  try {
    missed = await syncSince(since);
  } catch {
    return;
  }
  if (!missed.length) return;

  const myId = authAccessors.getUserId();
  const activeId = useChatStore.getState().activeConversationId;
  for (const m of missed) {
    upsertMessage(m);
    const isOwn = m.senderId === myId;
    const isActive = m.conversationId === activeId;
    // Catch-up deliberately does NOT fire OS notifications — reconnecting must not
    // dump a burst of alerts for messages the user is about to simply scroll to.
    bumpConversation(m, { incrementUnread: !isOwn && !isActive });
    noteSeen(m.id);
  }
}
