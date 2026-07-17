import { useEffect, useMemo } from 'react';
import { decryptFrom } from '@/services/e2ee';
import { useDecryptedStore } from '@/store/decryptedStore';
import { directPeerId } from '@/utils/conversation';
import { useAuthStore } from '@/store/authStore';
import { useE2eeStore } from '@/store/e2eeStore';
import type { ConversationSummary, Message, MessageType, ReplyPreview } from '@/types';

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

  // Every ciphertext still awaiting decryption: a message's own body, plus the
  // quoted body of any encrypted reply preview. A reply quotes a message in this
  // same conversation, so its ciphertext decrypts under the same key — and it is
  // cached under the ORIGINAL message's id, which is exactly `reply.id`. That both
  // de-dupes it against the quoted message's own decryption and lets the quote
  // resolve even when the original isn't currently loaded in the thread.
  const pending = useMemo(() => {
    const items: Array<{ key: string; ct: string }> = [];
    const seen = new Set<string>();
    const add = (key: string, ct: string | null | undefined) => {
      if (!ct || seen.has(key) || key in byKey) return;
      seen.add(key);
      items.push({ key, ct });
    };
    for (const m of messages) {
      if (m.deleted) continue;
      if (m.encrypted) add(cacheKey(m), m.content);
      if (m.replyTo?.encrypted) add(String(m.replyTo.id), m.replyTo.content);
    }
    return items;
  }, [messages, byKey]);

  useEffect(() => {
    if (!ready || peerId == null || pending.length === 0) return;
    let cancelled = false;

    void (async () => {
      const results = await Promise.all(
        pending.map(async ({ key, ct }): Promise<[string, string | null]> => {
          const plain = await decryptFrom(peerId, ct).catch(() => null);
          return [key, plain];
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
        const replyTo = decryptReply(m.replyTo, byKey);
        if (!m.encrypted || m.deleted) return replyTo === m.replyTo ? m : { ...m, replyTo };
        const plain = byKey[cacheKey(m)];
        if (plain === undefined) return { ...m, content: '', replyTo }; // still decrypting
        if (plain === null) return { ...m, content: UNREADABLE, replyTo };

        // An attachment's body carries the caption plus the real filename and mime
        // type — none of which exist anywhere outside this ciphertext, because the
        // object in storage is random bytes under a random key.
        if (m.type !== 'TEXT' && m.attachmentUrl) {
          const meta = parseAttachmentBody(plain);
          if (meta) {
            return {
              ...m,
              content: meta.c ?? '',
              attachmentName: meta.n || m.attachmentName,
              attachmentMime: meta.m || m.attachmentMime,
              replyTo,
            };
          }
        }
        return { ...m, content: plain, replyTo };
      }),
    [messages, byKey],
  );
}

/**
 * Resolve an encrypted reply preview to readable text. The server can't read the
 * quoted message, so it hands us the ciphertext (flagged `encrypted`) exactly as it
 * sits in storage; we decrypt it here and build the same one-line label the sender
 * saw. A locally-captured reply (no `encrypted` flag) already holds plaintext and is
 * returned untouched, so the `===` identity check upstream stays a no-op for it.
 */
function decryptReply(
  reply: ReplyPreview | null | undefined,
  byKey: Record<string, string | null>,
): ReplyPreview | null | undefined {
  if (!reply?.encrypted || !reply.content) return reply;
  const plain = byKey[String(reply.id)];
  const content =
    plain === undefined ? '' : plain === null ? UNREADABLE : replyPreviewText(reply.type, plain);
  return { ...reply, content, encrypted: false };
}

/** Build a reply quote's one line from decrypted plaintext, mirroring the sender's. */
function replyPreviewText(type: MessageType, plain: string): string {
  if (type === 'TEXT') return plain;
  const meta = parseAttachmentBody(plain);
  const caption = meta?.c?.trim();
  if (type === 'IMAGE') return caption ? `📷 ${caption}` : '📷 Photo';
  const mime = meta?.m ?? '';
  if (mime.startsWith('audio/')) return caption ? `🎤 ${caption}` : '🎤 Voice message';
  if (mime.startsWith('video/')) return caption ? `🎥 ${caption}` : '🎥 Video';
  return `📎 ${meta?.n || 'Attachment'}`;
}

/** `{c: caption, n: name, m: mime}` — the sealed metadata of an encrypted attachment. */
function parseAttachmentBody(plain: string): { c?: string; n?: string; m?: string } | null {
  if (!plain.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(plain) as { c?: string; n?: string; m?: string };
    return parsed && typeof parsed === 'object' && ('n' in parsed || 'c' in parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
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
            content:
              plain === undefined ? '' : plain === null ? '🔒 Encrypted message' : preview(last, plain),
          },
        };
      }),
    [conversations, byKey],
  );
}

/**
 * One line for the sidebar. An attachment's decrypted body is JSON (caption + real
 * filename), so show the caption — or a "📷 Photo" style label — rather than dumping
 * the raw JSON into the chat list.
 */
function preview(last: Message, plain: string): string {
  if (last.type === 'TEXT' || !last.attachmentUrl) return plain;
  const meta = parseAttachmentBody(plain);
  const caption = meta?.c || '';
  if (caption) return caption;
  return last.type === 'IMAGE' ? '📷 Photo' : `📎 ${meta?.n || 'Attachment'}`;
}
