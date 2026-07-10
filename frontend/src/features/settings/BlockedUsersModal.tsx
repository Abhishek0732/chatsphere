import { Ban } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useBlockedUsers, useUnblockUser } from '@/hooks/useBlocks';

export function BlockedUsersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: blocked, isLoading } = useBlockedUsers();
  const unblock = useUnblockUser();

  return (
    <Modal open={open} onClose={onClose} title="Blocked contacts">
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (blocked ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-on-surface-variant">
            <Ban className="h-7 w-7" />
          </span>
          <p className="text-sm text-on-surface-variant">
            You haven't blocked anyone. Blocked contacts can't message or call you.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {(blocked ?? []).map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-3">
              <Avatar name={u.displayName} src={u.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-surface">{u.displayName}</p>
                <p className="truncate text-xs text-on-surface-variant">@{u.username}</p>
              </div>
              <button
                type="button"
                onClick={() => unblock.mutate(u)}
                disabled={unblock.isPending}
                className="shrink-0 rounded-full glass-panel px-4 py-1.5 text-sm font-medium text-primary transition hover:bg-white/5 disabled:opacity-60"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
