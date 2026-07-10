import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Link as LinkIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useImageViewer } from '@/store/imageViewerStore';
import { getConversationMedia, type MediaKind } from '@/api/conversations';
import { mediaSrc } from '@/utils/media';
import { downloadFile } from '@/utils/download';
import { fileNameFromUrl } from '@/utils/format';
import { ConversationMediaSection } from './ConversationMediaSection';
import type { MediaItem } from '@/types';

const URL_RE = /(https?:\/\/[^\s]+)/i;
const linkOf = (m: MediaItem) => m.content?.match(URL_RE)?.[1] ?? m.content ?? '';

/**
 * Compact preview for the info panels: a few recent images, plus short lists of
 * shared links and docs (so a chat with links/docs doesn't look empty). "See
 * more" opens the full, paginated Media / Links / Docs gallery on whichever tab
 * has content.
 */
export function ConversationMediaPreview({ conversationId }: { conversationId: number }) {
  const openGallery = useImageViewer((s) => s.openGallery);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const { data: media = [] } = useQuery({
    queryKey: ['conversationMedia', conversationId, 'media', 'preview'],
    queryFn: () => getConversationMedia(conversationId, 'media', undefined, 6),
  });
  const { data: links = [] } = useQuery({
    queryKey: ['conversationMedia', conversationId, 'links', 'preview'],
    queryFn: () => getConversationMedia(conversationId, 'links', undefined, 3),
  });
  const { data: docs = [] } = useQuery({
    queryKey: ['conversationMedia', conversationId, 'docs', 'preview'],
    queryFn: () => getConversationMedia(conversationId, 'docs', undefined, 3),
  });

  const empty = media.length === 0 && links.length === 0 && docs.length === 0;
  const initialTab: MediaKind = media.length ? 'media' : links.length ? 'links' : 'docs';

  const openDoc = (m: MediaItem) => void downloadFile(m.attachmentUrl!, fileNameFromUrl(m.attachmentUrl));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-on-surface">Media, Links and Docs</h4>
        <button onClick={() => setGalleryOpen(true)} className="text-sm text-primary hover:underline">
          See more
        </button>
      </div>

      {empty ? (
        <p className="rounded-xl glass-panel px-3 py-4 text-center text-sm text-on-surface-variant">
          Shared media appears here
        </p>
      ) : (
        <div className="space-y-3">
          {media.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {media.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    openGallery(
                      media.map((x) => ({ name: x.content || 'Photo', src: x.attachmentUrl })),
                      i,
                    )
                  }
                  className="aspect-square overflow-hidden rounded-lg glass-panel"
                >
                  <img
                    src={mediaSrc(m.attachmentUrl)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                  />
                </button>
              ))}
            </div>
          )}

          {links.length > 0 && (
            <div className="space-y-1.5">
              {links.map((m) => (
                <a
                  key={m.id}
                  href={linkOf(m)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg glass-panel p-2 transition hover:bg-white/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <LinkIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">{linkOf(m)}</span>
                </a>
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div className="space-y-1.5">
              {docs.map((m) => (
                <button
                  key={m.id}
                  onClick={() => openDoc(m)}
                  className="flex w-full items-center gap-2.5 rounded-lg glass-panel p-2 text-left transition hover:bg-white/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                    {fileNameFromUrl(m.attachmentUrl)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)} title="Shared media" className="max-w-lg">
        <ConversationMediaSection conversationId={conversationId} initialTab={initialTab} />
      </Modal>
    </div>
  );
}
