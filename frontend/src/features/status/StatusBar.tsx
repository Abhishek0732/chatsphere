import { useState } from 'react';
import { Play, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import { mediaSrc } from '@/utils/media';
import { useAuthStore } from '@/store/authStore';
import { useStatusFeed } from '@/hooks/useStatus';
import { AddStatusModal } from './AddStatusModal';
import { StatusViewer } from './StatusViewer';
import type { StatusItem, StatusUser, User } from '@/types';

interface TileProps {
  name: string;
  user?: User | null;
  preview?: StatusItem | null;
  unseen: boolean;
  onClick: () => void;
  addBadge?: boolean;
  onAdd?: () => void;
}

/** A tiny preview of the latest story content shown inside the ring. */
function StatusPreview({ item }: { item: StatusItem }) {
  if (item.type === 'IMAGE') {
    return (
      <img
        src={mediaSrc(item.mediaUrl)}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }
  if (item.type === 'VIDEO') {
    // Avoid a <video> element per row (heavy at scale) — a dark disc + play
    // glyph is enough to signal "video story".
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white">
        <Play className="h-4 w-4 fill-current" />
      </div>
    );
  }
  // TEXT
  return (
    <div
      className="flex h-full w-full items-center justify-center px-0.5 text-center"
      style={{ backgroundImage: item.bgColor ?? undefined }}
    >
      <span className="line-clamp-2 text-[7px] font-semibold leading-tight text-white">
        {item.caption}
      </span>
    </div>
  );
}

function StatusTile({ name, user, preview, unseen, onClick, addBadge, onAdd }: TileProps) {
  const hasItems = !!preview;
  return (
    <button onClick={onClick} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
      <div className="relative">
        <div
          className={cn(
            'rounded-full p-[2.5px] transition',
            !hasItems
              ? 'bg-transparent ring-2 ring-dashed ring-slate-300 dark:ring-slate-600'
              : unseen
                ? 'bg-brand-gradient'
                : 'bg-slate-300 dark:bg-slate-600',
          )}
        >
          <div className="rounded-full bg-white p-[2px] dark:bg-slate-900">
            {preview ? (
              <div className="h-12 w-12 overflow-hidden rounded-full">
                <StatusPreview item={preview} />
              </div>
            ) : (
              <Avatar name={user?.displayName ?? '?'} src={user?.avatarUrl} size="lg" />
            )}
          </div>
        </div>

        {/* Identity badge over another person's story preview. */}
        {preview && !addBadge && (
          <span className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] overflow-hidden rounded-full ring-2 ring-white dark:ring-slate-900">
            {user?.avatarUrl ? (
              <img
                src={mediaSrc(user.avatarUrl)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-brand-500 text-[8px] font-bold text-white">
                {initials(name)}
              </span>
            )}
          </span>
        )}

        {addBadge && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-white shadow ring-2 ring-white dark:ring-slate-900"
          >
            <Plus className="h-3 w-3" />
          </span>
        )}
      </div>
      <span className="max-w-[68px] truncate text-xs text-slate-600 dark:text-slate-300">
        {name}
      </span>
    </button>
  );
}

/** The most recent (last) item is the one WhatsApp previews on the ring. */
function latestItem(u: StatusUser): StatusItem | null {
  return u.items.length ? u.items[u.items.length - 1] : null;
}

export function StatusBar() {
  const me = useAuthStore((s) => s.user);
  const { data: feed } = useStatusFeed();
  const [addOpen, setAddOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState<number | null>(null);

  const users: StatusUser[] = feed ?? [];
  const mine = users.find((u) => u.me) ?? null;
  const others = users.filter((u) => !u.me);

  return (
    <div className="border-b border-white/40 px-3 py-3 dark:border-white/5">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        <StatusTile
          name={mine ? 'My status' : 'Add status'}
          user={me}
          preview={mine ? latestItem(mine) : null}
          unseen={mine ? !mine.allViewed : false}
          onClick={() => (mine ? setViewerStart(users.indexOf(mine)) : setAddOpen(true))}
          addBadge
          onAdd={() => setAddOpen(true)}
        />
        {others.map((u) => (
          <StatusTile
            key={u.user.id}
            name={u.user.displayName}
            user={u.user}
            preview={latestItem(u)}
            unseen={!u.allViewed}
            onClick={() => setViewerStart(users.indexOf(u))}
          />
        ))}
      </div>

      <AddStatusModal open={addOpen} onClose={() => setAddOpen(false)} />
      {viewerStart !== null && (
        <StatusViewer
          users={users}
          startUserIndex={viewerStart}
          onClose={() => setViewerStart(null)}
        />
      )}
    </div>
  );
}
