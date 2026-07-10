import { useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileText, Link as LinkIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useImageViewer } from '@/store/imageViewerStore';
import { getConversationMedia, type MediaKind } from '@/api/conversations';
import { mediaSrc } from '@/utils/media';
import { downloadFile } from '@/utils/download';
import { fileNameFromUrl } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { MediaItem } from '@/types';

const PAGE = 30;
const URL_RE = /(https?:\/\/[^\s]+)/i;

/**
 * Shared "Media, Links and Docs" browser for a conversation — cursor-paginated
 * with infinite scroll so it stays cheap as media grows. Rendered inline (no
 * nested modal) so it can drop into either the direct-chat info panel or the
 * group info modal, giving groups the same media view as one-to-one chats.
 */
export function ConversationMediaSection({ conversationId }: { conversationId: number }) {
  const openViewer = useImageViewer((s) => s.open);
  const [tab, setTab] = useState<MediaKind>('media');
  const scrollRef = useRef<HTMLDivElement>(null);

  const gallery = useInfiniteQuery({
    queryKey: ['conversationMedia', conversationId, tab, 'section'],
    queryFn: ({ pageParam }) => getConversationMedia(conversationId, tab, pageParam, PAGE),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].id : undefined),
  });
  const items = gallery.data?.pages.flat() ?? [];

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !gallery.hasNextPage || gallery.isFetchingNextPage) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) gallery.fetchNextPage();
  };

  const openDoc = (m: MediaItem) => void downloadFile(m.attachmentUrl!, fileNameFromUrl(m.attachmentUrl));
  const linkOf = (m: MediaItem) => m.content?.match(URL_RE)?.[1] ?? m.content ?? '';

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl bg-white/5 p-1">
        {(['media', 'docs', 'links'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-sm font-medium capitalize transition',
              tab === k ? 'bg-white/10 text-on-surface' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="-mx-1 max-h-[45vh] overflow-y-auto px-1 cs-scroll">
        {gallery.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">No {tab} shared yet.</p>
        ) : tab === 'media' ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => openViewer(m.content || 'Photo', m.attachmentUrl)}
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
        ) : tab === 'docs' ? (
          <div className="space-y-2">
            {items.map((m) => (
              <button
                key={m.id}
                onClick={() => openDoc(m)}
                className="flex w-full items-center gap-3 rounded-xl glass-panel p-3 text-left transition hover:bg-white/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{fileNameFromUrl(m.attachmentUrl)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((m) => (
              <a
                key={m.id}
                href={linkOf(m)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 rounded-xl glass-panel p-3 transition hover:bg-white/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LinkIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-primary">{linkOf(m)}</span>
              </a>
            ))}
          </div>
        )}
        {gallery.isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Spinner className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
