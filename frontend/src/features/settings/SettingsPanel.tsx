import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Check,
  ChevronRight,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
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
  { value: 'light', label: 'Light', icon: <Sun className="h-5 w-5" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-5 w-5" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-5 w-5" /> },
];

/** A premium glass section card with an icon-chip heading. */
function Card({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-elevated backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      {title && (
        <div className="mb-4 flex items-center gap-2.5">
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
              {icon}
            </span>
          )}
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

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
    <div className="mx-auto w-full max-w-xl space-y-5 p-4 sm:p-6">
      <h1 className="px-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        Settings
      </h1>

      {/* Account card → quick link to full profile */}
      {user && (
        <Link
          to="/profile"
          className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-white/50 bg-white/70 p-4 shadow-elevated backdrop-blur-xl transition hover:bg-white/90 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
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

      {/* Appearance */}
      <Card icon={<Sun className="h-4 w-4" />} title="Appearance" subtitle="Light, dark, or follow your system">
        <div className="grid grid-cols-3 gap-2.5">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-3.5 text-sm font-medium transition',
                theme === opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-500/10 dark:text-brand-300'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5',
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Chat theme */}
      <Card
        icon={<Palette className="h-4 w-4" />}
        title="Chat theme"
        subtitle="Your accent color and chat wallpaper"
      >
        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Accent color</p>
        <div className="mb-5 flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              onClick={() => setAccent(a.key)}
              title={a.label}
              aria-label={a.label}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 transition ring-offset-white hover:scale-110 dark:ring-offset-slate-900',
                accent === a.key ? 'ring-slate-900 dark:ring-white' : 'ring-transparent',
              )}
              style={{ backgroundColor: a.swatch }}
            >
              {accent === a.key && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>

        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Wallpaper</p>
        <div className="grid grid-cols-5 gap-2">
          {WALLPAPERS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWallpaper(w.key)}
              title={w.label}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[11px] transition',
                wallpaper === w.key
                  ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5',
              )}
            >
              <span
                className="h-8 w-full rounded-lg"
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
      </Card>

      {/* Notifications */}
      <Card icon={<Bell className="h-4 w-4" />} title="Notifications">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            {notifPerm === 'granted' ? (
              <Bell className="h-4 w-4 shrink-0 text-emerald-500" />
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
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20" />
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
