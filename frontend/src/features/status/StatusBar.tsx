import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { useStatusFeed } from '@/hooks/useStatus';
import { AddStatusModal } from './AddStatusModal';
import { StatusViewer } from './StatusViewer';
import type { StatusUser, User } from '@/types';

interface TileProps {
  name: string;
  user?: User | null;
  hasItems: boolean;
  unseen: boolean;
  onClick: () => void;
  addBadge?: boolean;
  onAdd?: () => void;
}

function StatusTile({ name, user, hasItems, unseen, onClick, addBadge, onAdd }: TileProps) {
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
            <Avatar name={user?.displayName ?? '?'} src={user?.avatarUrl} size="lg" />
          </div>
        </div>
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
          hasItems={!!mine}
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
            hasItems
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
