import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, ChevronRight, LogOut, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { notificationPermission, requestNotificationPermission } from '@/utils/notifications';
import { useChatStore } from '@/store/chatStore';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { Avatar } from '@/components/ui/Avatar';
import { AppearanceStudio } from './AppearanceStudio';

/** A premium glass section card with an icon-chip heading. */
function Card({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-elevated dark:border-white/10 dark:bg-[#111a2b]">
      <div className="mb-4 flex items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
            {icon}
          </span>
        )}
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function SettingsPanel() {
  const connected = useChatStore((s) => s.connected);
  const user = useAuthStore((s) => s.user);
  const openViewer = useImageViewer((s) => s.open);
  const logout = useLogout();

  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const enableNotifications = async () => {
    setNotifPerm(await requestNotificationPermission());
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 p-4 sm:p-6">
      <h1 className="px-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        Settings
      </h1>

      {/* Account card → quick link to full profile */}
      {user && (
        <Link
          to="/profile"
          className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-elevated transition hover:border-brand-300 dark:border-white/10 dark:bg-[#111a2b] dark:hover:border-brand-500/40"
        >
          <Avatar
            name={user.displayName}
            src={user.avatarUrl}
            size="lg"
            className="ring-2 ring-brand-500/30"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openViewer(user.displayName, user.avatarUrl, { circle: true });
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-50">
              {user.displayName}
            </p>
            <p className="truncate text-sm text-slate-400">@{user.username}</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
            Edit
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {/* Appearance customization studio */}
      <AppearanceStudio />

      {/* Notifications */}
      <Card icon={<Bell className="h-4 w-4" />} title="Notifications">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            {notifPerm === 'granted' ? (
              <Bell className="h-4 w-4 shrink-0 text-brand-500" />
            ) : (
              <BellOff className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            <span className="text-slate-600 dark:text-slate-300">
              {notifPerm === 'granted'
                ? 'Desktop notifications are on'
                : notifPerm === 'denied'
                  ? 'Blocked — enable them in your browser settings'
                  : notifPerm === 'unsupported'
                    ? 'Not supported on this browser'
                    : 'Get notified of new messages when the app is in the background'}
            </span>
          </div>
          {notifPerm === 'default' && (
            <Button size="sm" variant="secondary" onClick={enableNotifications}>
              Enable
            </Button>
          )}
        </div>
      </Card>

      {/* Connection */}
      <Card icon={connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />} title="Connection">
        <div className="flex items-center gap-2.5 text-sm">
          {connected ? (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500 shadow-[0_0_0_3px] shadow-brand-500/20" />
              <span className="text-slate-600 dark:text-slate-300">Realtime connected</span>
            </>
          ) : (
            <>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
              <span className="text-slate-600 dark:text-slate-300">Reconnecting…</span>
            </>
          )}
        </div>
      </Card>

      <Button
        variant="danger"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
        className="w-full sm:w-auto"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
