import { useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Ban,
  Bell,
  BellOff,
  ChevronRight,
  FileText,
  Link as LinkIcon,
  Search,
  Star,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useMuteStore } from '@/store/muteStore';
import { useBlockUser, useIsBlocked, useUnblockUser } from '@/hooks/useBlocks';
import { useImageViewer } from '@/store/imageViewerStore';
import { getConversationMedia, type MediaKind } from '@/api/conversations';
import { mediaSrc } from '@/utils/media';
import { downloadFile } from '@/utils/download';
import { fileNameFromUrl } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import type { ConversationSummary, MediaItem, User } from '@/types';

const PAGE = 30;
const URL_RE = /(https?:\/\/[^\s]+)/i;

function Action({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-1.5">
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full glass-panel transition-all group-hover:bg-primary group-hover:text-on-primary',
          active && 'bg-primary text-on-primary',
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
    </button>
  );
}

function ImageThumb({ item, openViewer }: { item: MediaItem; openViewer: (name: string, src?: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => openViewer(item.content || 'Photo', item.attachmentUrl)}
      className="aspect-square overflow-hidden rounded-lg glass-panel"
    >
      <img
        src={mediaSrc(item.attachmentUrl)}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
      />
    </button>
  );
}

export function ContactInfoPanel({
  conversation,
  other,
  onClose,
}: {
  conversation: ConversationSummary;
  other?: User;
  onClose: () => void;
}) {
  const openViewer = useImageViewer((s) => s.open);
  const muted = useMuteStore((s) => s.muted[conversation.id]);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const blocked = useIsBlocked(other?.id);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [tab, setTab] = useState<MediaKind>('media');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lightweight preview — just the first few images (paginated on the server).
  const { data: preview = [] } = useQuery({
    queryKey: ['conversationMedia', conversation.id, 'media', 'preview'],
    queryFn: () => getConversationMedia(conversation.id, 'media', undefined, 6),
  });

  // Full gallery for the active tab — cursor-paginated + infinite scroll, only
  // fetched while the gallery is open (keeps it cheap as media grows).
  const gallery = useInfiniteQuery({
    queryKey: ['conversationMedia', conversation.id, tab, 'all'],
    queryFn: ({ pageParam }) => getConversationMedia(conversation.id, tab, pageParam, PAGE),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].id : undefined),
    enabled: galleryOpen,
  });
  const items = gallery.data?.pages.flat() ?? [];

  const onGalleryScroll = () => {
    const el = scrollRef.current;
    if (!el || !gallery.hasNextPage || gallery.isFetchingNextPage) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) gallery.fetchNextPage();
  };

  const openMedia = (m: MediaItem) => openViewer(m.content || 'Photo', m.attachmentUrl);
  const openDoc = (m: MediaItem) => void downloadFile(m.attachmentUrl!, fileNameFromUrl(m.attachmentUrl));
  const linkOf = (m: MediaItem) => (m.content?.match(URL_RE)?.[1] ?? m.content ?? '');

  const subtitle = other?.about || (other?.username ? `@${other.username}` : `${conversation.members.length} members`);

  return (
    <aside className="fixed inset-0 z-40 flex h-full w-full shrink-0 flex-col overflow-y-auto border-white/5 bg-surface-container-lowest cs-scroll lg:static lg:z-auto lg:w-80 lg:border-l">
      <div className="flex justify-end p-3">
        <button onClick={onClose} className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface" aria-label="Close info">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center gap-4 px-5 pb-2 text-center">
        <button onClick={() => openViewer(conversation.name, conversation.avatarUrl, { circle: true, protected: !!other?.protectAvatar })}>
          <Avatar name={conversation.name} src={conversation.avatarUrl} guarded={!!other?.protectAvatar} className="h-28 w-28 border-4 border-primary/20 p-1 text-3xl shadow-2xl" />
        </button>
        <div>
          <h3 className="text-2xl font-bold leading-tight text-on-surface">{conversation.name}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
        </div>
        <div className="flex gap-6 pt-1">
          <Action icon={<UserIcon className="h-5 w-5" />} label="Profile" onClick={() => openViewer(conversation.name, conversation.avatarUrl, { circle: true })} />
          <Action icon={muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />} label={muted ? 'Unmute' : 'Mute'} active={muted} onClick={() => toggleMute(conversation.id)} />
          <Action icon={<Search className="h-5 w-5" />} label="Search" onClick={() => toast({ title: 'In-chat search coming soon', variant: 'info' })} />
        </div>
      </div>

      {/* Media preview */}
      <div className="space-y-3 px-5 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-on-surface">Media, Links and Docs</h4>
          <button onClick={() => { setTab('media'); setGalleryOpen(true); }} className="text-sm text-primary hover:underline">
            See all
          </button>
        </div>
        {preview.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {preview.map((m) => <ImageThumb key={m.id} item={m} openViewer={openViewer} />)}
          </div>
        ) : (
          <p className="rounded-xl glass-panel px-3 py-4 text-center text-sm text-on-surface-variant">Shared media appears here</p>
        )}
      </div>

      {/* Options */}
      <div className="mt-auto space-y-2 px-5 pb-6">
        <button className="flex w-full items-center justify-between rounded-xl glass-panel p-3.5 text-left transition hover:bg-white/5">
          <span className="flex items-center gap-3"><Star className="h-5 w-5 text-on-surface-variant" /><span className="text-base text-on-surface">Starred Messages</span></span>
          <ChevronRight className="h-5 w-5 text-on-surface-variant" />
        </button>
        {other && (
          <button onClick={() => (blocked ? unblockUser.mutate(other) : blockUser.mutate(other))} className="flex w-full items-center gap-3 rounded-xl glass-panel p-3.5 text-left transition hover:bg-white/5">
            <Ban className="h-5 w-5 text-error" />
            <span className="text-base text-error">{blocked ? `Unblock ${other.displayName}` : 'Block Contact'}</span>
          </button>
        )}
      </div>

      {/* Tabbed gallery */}
      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)} title="Shared media" className="max-w-lg">
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

        <div ref={scrollRef} onScroll={onGalleryScroll} className="-mx-1 max-h-[65vh] overflow-y-auto px-1 cs-scroll">
          {gallery.isLoading ? (
            <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">No {tab} shared yet.</p>
          ) : tab === 'media' ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((m) => <ImageThumb key={m.id} item={m} openViewer={openViewer} />)}
            </div>
          ) : tab === 'docs' ? (
            <div className="space-y-2">
              {items.map((m) => (
                <button key={m.id} onClick={() => openDoc(m)} className="flex w-full items-center gap-3 rounded-xl glass-panel p-3 text-left transition hover:bg-white/5">
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
                <a key={m.id} href={linkOf(m)} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 rounded-xl glass-panel p-3 transition hover:bg-white/5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LinkIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">{linkOf(m)}</span>
                </a>
              ))}
            </div>
          )}
          {gallery.isFetchingNextPage && (
            <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
          )}
        </div>
      </Modal>
    </aside>
  );
}
