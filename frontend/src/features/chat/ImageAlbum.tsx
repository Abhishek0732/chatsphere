import { memo, useState } from 'react';
import { mediaSrc } from '@/utils/media';
import { ThumbImage } from '@/components/ui/ThumbImage';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format';
import { useImageViewer } from '@/store/imageViewerStore';
import { useMediaRevealStore } from '@/store/mediaRevealStore';
import { MessageStatusTicks } from './MessageStatusTicks';
import { MessageActionsMenu } from './MessageActionsMenu';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import type { Message } from '@/types';

const MAX_TILES = 4;

/**
 * A WhatsApp-style photo album: images sent together render as one grid bubble
 * (2 side-by-side, 3 as a hero + pair, 4+ as a 2×2 with a "+N" overlay on the
 * last tile) rather than one message per image. Tapping a tile opens it in the
 * viewer. Incoming media still respects the tap-to-reveal gate — as one unit.
 */
function ImageAlbumInner({
  messages,
  mine,
  showSender,
  avatarColumn,
  showAvatar,
  avatarUrl,
  onForward,
}: {
  messages: Message[];
  mine: boolean;
  showSender: boolean;
  avatarColumn?: boolean;
  showAvatar?: boolean;
  avatarUrl?: string;
  onForward?: (message: Message) => void;
}) {
  const openGallery = useImageViewer((s) => s.openGallery);
  // Select a boolean, not the whole map: subscribing to `s.revealed` re-rendered
  // every album in the thread whenever any one of them was revealed.
  const reveal = useMediaRevealStore((s) => s.reveal);
  const allRevealed = useMediaRevealStore((s) =>
    messages.every((m) => m.id <= 0 || Boolean(s.revealed[m.id])),
  );
  const galleryImages = messages.map((m) => ({ name: m.content || 'Photo', src: m.attachmentUrl }));

  const count = messages.length;
  const shown = messages.slice(0, MAX_TILES);
  const extra = count - MAX_TILES;
  const last = messages[count - 1];
  const caption = [...messages].reverse().find((m) => m.content?.trim())?.content ?? '';

  const [galleryOpen, setGalleryOpen] = useState(false);

  const gated = !mine && !allRevealed;
  const revealAll = () => messages.forEach((m) => m.id > 0 && reveal(m.id));

  const tile = (m: Message, i: number, className: string) => {
    // The last tile with a "+N" overlay opens the full album gallery.
    const isMoreTile = !gated && i === MAX_TILES - 1 && extra > 0;
    return (
      <div
        key={m.tempId ?? m.id}
        data-message-id={m.id}
        className={cn('group relative overflow-hidden bg-surface-container-high', className)}
      >
        <button
          type="button"
          onClick={() =>
            gated ? revealAll() : isMoreTile ? setGalleryOpen(true) : openGallery(galleryImages, i)
          }
          className="block h-full w-full"
        >
          <ThumbImage
            url={m.attachmentUrl}
            alt=""
            className={cn('h-full w-full object-cover', gated && 'scale-110 blur-xl')}
          />
          {isMoreTile && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
              +{extra}
            </span>
          )}
        </button>
        {/* Per-photo actions — reply to or delete a single image, not the whole album. */}
        {!gated && m.id > 0 && !m.deleted && (
          <MessageActionsMenu message={m} mine={mine} onForward={onForward} />
        )}
      </div>
    );
  };

  return (
    <div className={cn('cv-row flex w-full items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
      {avatarColumn &&
        !mine &&
        (showAvatar ? (
          <Avatar name={last.senderName} src={avatarUrl} size="sm" className="mb-1 h-8 w-8 shrink-0" />
        ) : (
          <div className="w-8 shrink-0" />
        ))}
      <div
        className={cn(
          'relative w-[min(75vw,18rem)] animate-pop-in overflow-hidden rounded-2xl shadow-lg',
          mine ? 'message-gradient-sent rounded-br-none' : 'message-received rounded-bl-none',
        )}
      >
        {showSender && !mine && (
          <p className="px-3 pt-2 text-xs font-semibold text-primary">{last.senderName}</p>
        )}

        <div className="grid grid-cols-2 gap-0.5 p-0.5">
          {count === 3 ? (
            <>
              {tile(shown[0], 0, 'col-span-2 h-36')}
              {tile(shown[1], 1, 'h-28')}
              {tile(shown[2], 2, 'h-28')}
            </>
          ) : (
            shown.map((m, i) => tile(m, i, 'aspect-square'))
          )}
        </div>

        {gated && (
          <button
            type="button"
            onClick={revealAll}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
          >
            View {count} photos
          </button>
        )}

        <div
          className={cn(
            'flex items-end gap-2 px-3 pb-1.5 pt-1',
            mine ? 'text-on-primary' : 'text-on-surface',
          )}
        >
          {caption && (
            <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{caption}</p>
          )}
          <span
            className={cn(
              'ml-auto flex shrink-0 items-center gap-1 text-[10px]',
              mine ? 'text-on-primary/80' : 'text-on-surface-variant',
            )}
          >
            {formatTime(last.createdAt)}
            {mine && !last.deleted && <MessageStatusTicks message={last} />}
          </span>
        </div>
      </div>

      {/* Full album gallery — browse every image when there are more than the grid shows. */}
      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={`${count} photos`} className="max-w-lg">
        <div className="-mx-1 max-h-[70vh] overflow-y-auto px-1 cs-scroll">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {messages.map((m, i) => (
              <div
                key={m.tempId ?? m.id}
                className="group relative aspect-square overflow-hidden rounded-lg glass-panel"
              >
                <button
                  type="button"
                  onClick={() => openGallery(galleryImages, i)}
                  className="block h-full w-full"
                >
                  <ThumbImage
                    url={m.attachmentUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                  />
                </button>
                {m.id > 0 && !m.deleted && (
                  <MessageActionsMenu
                    message={m}
                    mine={mine}
                    onForward={onForward}
                    onDismiss={() => setGalleryOpen(false)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Memoized: an unrelated thread re-render (typing/read events) must not
// re-render every album and its <img> subtrees.
export const ImageAlbum = memo(ImageAlbumInner);
