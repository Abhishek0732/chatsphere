import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useUnreadNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
} from '@/hooks/useNotifications';
import { queryKeys } from '@/api/queryKeys';
import type { ConversationSummary } from '@/types';
import { formatListTimestamp } from '@/utils/format';
import { cn } from '@/utils/cn';

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const notifications = useUnreadNotifications();
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });

  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ left: r.right + 12, bottom: window.innerHeight - r.bottom });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={toggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', left: pos.left, bottom: pos.bottom }}
            className="z-[80] max-h-[70vh] w-80 max-w-[calc(100vw-5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl scrollbar-thin dark:border-white/10 dark:bg-[#16171d]"
          >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
            <span className="text-sm font-semibold">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
              >
                Mark all as read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  if (n.type === 'CONTACT_REQUEST' || n.type === 'CONTACT_ACCEPTED') {
                    navigate('/contacts');
                  } else if (n.conversationId) {
                    const list = qc.getQueryData<ConversationSummary[]>(queryKeys.conversations);
                    const key =
                      list?.find((c) => c.id === n.conversationId)?.publicId ??
                      String(n.conversationId);
                    navigate(`/chat/${key}`);
                  }
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800',
                  !n.read && 'bg-brand-50/50 dark:bg-brand-900/10',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {formatListTimestamp(n.createdAt)}
                  </span>
                </div>
                <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {n.body}
                </span>
              </button>
            ))
          )}
          </div>,
          document.body,
        )}
    </div>
  );
}
