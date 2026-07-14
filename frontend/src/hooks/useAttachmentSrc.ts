import { useEffect, useState } from 'react';
import { decryptAttachment } from '@/services/e2ee';
import { useE2eeStore } from '@/store/e2eeStore';
import { useAuthStore } from '@/store/authStore';
import { directPeerId } from '@/utils/conversation';
import { mediaSrc } from '@/utils/media';
import type { Message } from '@/types';

/**
 * The URL to actually render for a message's attachment.
 *
 * A plain attachment is just its URL. An ENCRYPTED one cannot be handed to an
 * `<img src>` at all — the object in storage is `iv || ciphertext`, so the browser
 * would render nothing. It has to be fetched, decrypted here, and turned into a
 * blob: URL. That work is cached per URL in the e2ee service, so a photo is not
 * re-downloaded and re-decrypted on every render.
 *
 * Returns `{ src: null, loading: true }` while it decrypts, and `{ src: null,
 * loading: false }` if it cannot be read — the caller shows a placeholder rather
 * than a broken image.
 */
export function useAttachmentSrc(message: Message): { src: string | null; loading: boolean } {
  const myId = useAuthStore((s) => s.user?.id);
  const ready = useE2eeStore((s) => s.ready);
  const url = message.attachmentUrl;
  const encrypted = !!message.encrypted && !!url;

  const [state, setState] = useState<{ src: string | null; loading: boolean }>(() =>
    encrypted ? { src: null, loading: true } : { src: url ? mediaSrc(url) : null, loading: false },
  );

  useEffect(() => {
    if (!url) {
      setState({ src: null, loading: false });
      return;
    }
    if (!encrypted) {
      setState({ src: mediaSrc(url), loading: false });
      return;
    }
    // Wait for the key: decrypting before it is unlocked would just fail.
    if (!ready || myId == null) {
      setState({ src: null, loading: true });
      return;
    }
    const peerId = directPeerId(message.conversationId, myId);
    if (peerId == null) {
      setState({ src: null, loading: false });
      return;
    }

    let live = true;
    setState({ src: null, loading: true });
    void decryptAttachment(peerId, mediaSrc(url), message.attachmentMime)
      .then((objectUrl) => {
        if (live) setState({ src: objectUrl, loading: false });
      })
      .catch(() => {
        if (live) setState({ src: null, loading: false });
      });

    return () => {
      live = false;
    };
  }, [url, encrypted, ready, myId, message.conversationId, message.attachmentMime]);

  return state;
}

/**
 * The same thing for a LIST of messages (an album, the shared-media grid).
 *
 * Returns messageId -> renderable src. Encrypted ones are fetched and decrypted
 * (cached, so this is cheap after the first time); plain ones pass straight
 * through. Anything that cannot be read maps to null and the caller shows a
 * placeholder — never a broken image.
 */
export function useAttachmentSrcs(messages: Message[]): Record<number, string | null> {
  const myId = useAuthStore((s) => s.user?.id);
  const ready = useE2eeStore((s) => s.ready);
  const [srcs, setSrcs] = useState<Record<number, string | null>>({});

  // A stable key, so the effect does not re-run on every render of the same list.
  const signature = messages
    .map((m) => `${m.id}:${m.encrypted ? 1 : 0}:${m.attachmentUrl ?? ''}`)
    .join('|');

  useEffect(() => {
    let live = true;
    const withAttachments = messages.filter((m) => m.attachmentUrl);
    if (withAttachments.length === 0) return;

    void (async () => {
      const entries = await Promise.all(
        withAttachments.map(async (m): Promise<[number, string | null]> => {
          const url = m.attachmentUrl as string;
          if (!m.encrypted) return [m.id, mediaSrc(url)];
          if (!ready || myId == null) return [m.id, null];
          const peerId = directPeerId(m.conversationId, myId);
          if (peerId == null) return [m.id, null];
          const decrypted = await decryptAttachment(peerId, mediaSrc(url), m.attachmentMime).catch(
            () => null,
          );
          return [m.id, decrypted];
        }),
      );
      if (live) setSrcs(Object.fromEntries(entries));
    })();

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ready, myId]);

  return srcs;
}
