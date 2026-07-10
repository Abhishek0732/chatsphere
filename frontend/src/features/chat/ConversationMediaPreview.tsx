import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { useImageViewer } from '@/store/imageViewerStore';
import { getConversationMedia } from '@/api/conversations';
import { mediaSrc } from '@/utils/media';
import { ConversationMediaSection } from './ConversationMediaSection';
import type { MediaItem } from '@/types';

const PREVIEW = 6;

/**
 * Compact media block for the info panels: a few recent images with a "See more"
 * button that opens the full Media / Links / Docs gallery in a modal. Keeps the
 * panels short (the full, paginated browser only mounts when opened) and gives
 * the group info the same media UX as a one-to-one chat.
 */
export function ConversationMediaPreview({ conversationId }: { conversationId: number }) {
  const openGallery = useImageViewer((s) => s.openGallery);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const { data: preview = [] } = useQuery({
    queryKey: ['conversationMedia', conversationId, 'media', 'preview'],
    queryFn: () => getConversationMedia(conversationId, 'media', undefined, PREVIEW),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-on-surface">Media, Links and Docs</h4>
        <button onClick={() => setGalleryOpen(true)} className="text-sm text-primary hover:underline">
          See more
        </button>
      </div>

      {preview.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {preview.map((m: MediaItem, i: number) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                openGallery(
                  preview.map((x) => ({ name: x.content || 'Photo', src: x.attachmentUrl })),
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
      ) : (
        <p className="rounded-xl glass-panel px-3 py-4 text-center text-sm text-on-surface-variant">
          Shared media appears here
        </p>
      )}

      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)} title="Shared media" className="max-w-lg">
        <ConversationMediaSection conversationId={conversationId} />
      </Modal>
    </div>
  );
}
