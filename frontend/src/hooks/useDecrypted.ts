import { useEffect, useMemo } from 'react';
import { decryptFrom } from '@/services/e2ee';
import { useDecryptedStore } from '@/store/decryptedStore';
import { directPeerId } from '@/utils/conversation';
import { useAuthStore } from '@/store/authStore';
import { useE2eeStore } from '@/store/e2eeStore';
import type { ConversationSummary, Message } from '@/types';

/** Shown when a message cannot be decrypted (a key we no longer have). */
export const UNREADABLE = '🔒 Message can’t be read on this device';

/** The key a decrypted message is cached under: its tempId until the echo, then its id. */
function cacheKey(m: Message): string {
  return m.tempId ?? String(m.id);
}

/**
 * Decrypt a thread for display.
 *
 * The server hands us ciphertext — it has nothing else. Decryption happens here, in
 * the browser, with the conversation key, and the results are cached so the thread
 * does not re-decrypt on every render. A message we cannot read (encrypted to a key
 * that has since been replaced) shows a plain notice rather than gibberish.
 */
export function useDecryptedMessages(messages: Message[], conversationId: number | null): Message[] {
  const myId = useAuthStore((s) => s.user?.id);
  const byKey = useDecryptedStore((s) => s.byKey);
  const putMany = useDecryptedStore((s) => s.putMany);
  // Unlocking the key is async (a fetch plus 250k PBKDF2 rounds) and the thread
  // renders first. Decrypting before the key is there would fail, and that failure
  // would be CACHED — on a fresh device the history would look permanently lost.
  const ready = useE2eeStore((s) => s.ready);

  const peerId = conversationId != null && myId != null ? directPeerId(conversationId, myId) : null;

  // Anything encrypted that we have not decrypted yet.
  const pending = useMemo(
    () =>
      messages.filter(
        (m) => m.encrypted && m.content && !(cacheKey(m) in byKey) && !m.deleted,
      ),
    [messages, byKey],
  );

  useEffect(() => {
    if (!ready || peerId == null || pending.length === 0) return;
    let cancelled = false;

    void (async () => {
      const results = await Promise.all(
        pending.map(async (m): Promise<[string, string | null]> => {
          const plain = await decryptFrom(peerId, m.content).catch(() => null);
          return [cacheKey(m), plain];
        }),
      );
      if (!cancelled) putMany(results);
    })();

    return () => {
      cancelled = true;
    };
  }, [pending, peerId, putMany, ready]);

  return useMemo(
    () =>
      messages.map((m) => {
        if (!m.encrypted || m.deleted) return m;
        const plain = byKey[cacheKey(m)];
        if (plain === undefined) return { ...m, content: '' }; // still decrypting
        return { ...m, content: plain ?? UNREADABLE };
      }),
    [messages, byKey],
  );
}

/**
 * Decrypt the last-message previews in the chat list.
 *
 * Without this the sidebar would show ciphertext next to every encrypted chat — the
 * server cannot build that preview for us any more, and that is the point.
 */
export function useDecryptedPreviews(conversations: ConversationSummary[]): ConversationSummary[] {
  const myId = useAuthStore((s) => s.user?.id);
  const byKey = useDecryptedStore((s) => s.byKey);
  const putMany = useDecryptedStore((s) => s.putMany);
  const ready = useE2eeStore((s) => s.ready);

  const encryptedPreviews = useMemo(
    () =>
      conversations.filter(
        (c) =>
          c.type === 'DIRECT' &&
          c.lastMessage?.encrypted &&
          c.lastMessage.content &&
          !(String(c.lastMessage.id) in byKey),
      ),
    [conversations, byKey],
  );

  useEffect(() => {
    if (!ready || myId == null || encryptedPreviews.length === 0) return;
    let cancelled = false;

    void (async () => {
      const results = await Promise.all(
        encryptedPreviews.map(async (c): Promise<[string, string | null]> => {
          const peerId = c.members?.find((m) => m.id !== myId)?.id;
          const last = c.lastMessage!;
          if (peerId == null) return [String(last.id), null];
          const plain = await decryptFrom(peerId, last.content).catch(() => null);
          return [String(last.id), plain];
        }),
      );
      if (!cancelled) putMany(results);
    })();

    return () => {
      cancelled = true;
    };
  }, [encryptedPreviews, myId, putMany, ready]);

  return useMemo(
    () =>
      conversations.map((c) => {
        const last = c.lastMessage;
        if (!last?.encrypted || !last.content) return c;
        const plain = byKey[String(last.id)];
        return {
          ...c,
          lastMessage: {
            ...last,
            content: plain === undefined ? '' : (plain ?? '🔒 Encrypted message'),
          },
        };
      }),
    [conversations, byKey],
  );
}
