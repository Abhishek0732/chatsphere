import { useState, type ReactNode } from 'react';
import { Bell, BellOff, Check, LogOut, Monitor, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  notificationPermission,
  requestNotificationPermission,
} from '@/utils/notifications';
import {
  useThemeStore,
  ACCENTS,
  WALLPAPERS,
  type Theme,
} from '@/store/themeStore';
import { useChatStore } from '@/store/chatStore';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';

const themeOptions: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
];

export function SettingsPanel() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  const wallpaper = useThemeStore((s) => s.wallpaper);
  const setWallpaper = useThemeStore((s) => s.setWallpaper);
  const connected = useChatStore((s) => s.connected);
  const user = useAuthStore((s) => s.user);
  const openViewer = useImageViewer((s) => s.open);
  const logout = useLogout();

  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const enableNotifications = async () => {
    setNotifPerm(await requestNotificationPermission());
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {user && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <Avatar
            name={user.displayName}
            src={user.avatarUrl}
            size="lg"
            onClick={() => openViewer(user.displayName, user.avatarUrl, { circle: true })}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName}</p>
            <p className="truncate text-sm text-slate-400">@{user.username}</p>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Appearance
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition',
                theme === opt.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Chat theme
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Your personal accent color and chat wallpaper.
        </p>

        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Accent color
        </p>
        <div className="mb-5 flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              onClick={() => setAccent(a.key)}
              title={a.label}
              aria-label={a.label}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 transition ring-offset-white dark:ring-offset-slate-900',
                accent === a.key ? 'ring-slate-900 dark:ring-white' : 'ring-transparent',
              )}
              style={{ backgroundColor: a.swatch }}
            >
              {accent === a.key && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>

        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Wallpaper
        </p>
        <div className="grid grid-cols-5 gap-2">
          {WALLPAPERS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWallpaper(w.key)}
              title={w.label}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] transition',
                wallpaper === w.key
                  ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
              )}
            >
              <span
                className="h-8 w-full rounded"
                style={{
                  backgroundColor: theme === 'dark' ? w.dark : w.light,
                  backgroundImage:
                    w.key === 'plain'
                      ? 'none'
                      : 'radial-gradient(rgb(0 0 0 / 0.08) 1px, transparent 1px)',
                  backgroundSize: '8px 8px',
                }}
              />
              {w.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Notifications
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <div className="flex items-center gap-2">
            {notifPerm === 'granted' ? (
              <Bell className="h-4 w-4 text-emerald-500" />
            ) : (
              <BellOff className="h-4 w-4 text-slate-400" />
            )}
            <span>
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
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Connection
        </h2>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          {connected ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span>Realtime connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-500" />
              <span>Reconnecting…</span>
            </>
          )}
        </div>
      </section>

      <section>
        <Button variant="danger" onClick={() => logout.mutate()} loading={logout.isPending}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </section>
    </div>
  );
}
