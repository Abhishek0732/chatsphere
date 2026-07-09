import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Camera,
  Check,
  ChevronRight,
  Download,
  LogOut,
  Palette,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { notificationPermission, requestNotificationPermission } from '@/utils/notifications';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { useUpdateProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { AppearanceStudio } from './AppearanceStudio';

type SettingKey = 'appearance' | 'privacy' | 'notifications';

/** A tappable settings entry: icon chip + title + subtitle, opens a modal. */
function SettingRow({
  icon,
  title,
  subtitle,
  onClick,
  right,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  right?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
        {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
      </div>
      {right ?? <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
    </button>
  );
}

export function SettingsPanel() {
  const user = useAuthStore((s) => s.user);
  const openViewer = useImageViewer((s) => s.open);
  const logout = useLogout();
  const updateProfile = useUpdateProfile();

  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const [openModal, setOpenModal] = useState<SettingKey | null>(null);
  const close = () => setOpenModal(null);

  const enableNotifications = async () => {
    setNotifPerm(await requestNotificationPermission());
  };

  const protectAvatar = !!user?.protectAvatar;
  const toggleProtect = () => updateProfile.mutate({ protectAvatar: !protectAvatar });

  const notifSubtitle =
    notifPerm === 'granted'
      ? 'On'
      : notifPerm === 'denied'
        ? 'Blocked in browser'
        : notifPerm === 'unsupported'
          ? 'Not supported'
          : 'Off';

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6">
      <h1 className="px-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        Settings
      </h1>

      {/* Account card → quick link to full profile */}
      {user && (
        <Link
          to="/profile"
          className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-elevated transition hover:border-brand-300 dark:border-white/10 dark:bg-[#111a2b] dark:hover:border-brand-500/40"
        >
          {/* Your own photo — never protected against yourself. */}
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

      {/* Settings entries — each opens its own modal */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-elevated dark:border-white/10 dark:bg-[#111a2b]">
        <div className="divide-y divide-slate-200/60 dark:divide-white/5">
          <SettingRow
            icon={<Palette className="h-4 w-4" />}
            title="Appearance"
            subtitle="Theme, accent, wallpaper, text size"
            onClick={() => setOpenModal('appearance')}
          />
          <SettingRow
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Privacy"
            subtitle="Protect your profile photo"
            onClick={() => setOpenModal('privacy')}
          />
          <SettingRow
            icon={notifPerm === 'granted' ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            title="Notifications"
            subtitle={notifSubtitle}
            onClick={() => setOpenModal('notifications')}
          />
        </div>
      </div>

      <Button
        variant="danger"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
        className="w-full sm:w-auto"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <Modal open={openModal === 'appearance'} onClose={close} title="Appearance" className="max-w-lg">
        <div className="-mx-1 max-h-[70vh] overflow-y-auto px-1 scrollbar-thin">
          <AppearanceStudio />
        </div>
      </Modal>

      <Modal open={openModal === 'privacy'} onClose={close} title="Privacy" className="max-w-md">
        <div className="space-y-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-brand-500/30">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-50">
                Profile photo protection
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose who can save or capture your picture.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-slate-800 dark:text-slate-100">
                Protect my profile photo
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Applies to everyone but you</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={protectAvatar}
              aria-label="Protect my profile photo"
              disabled={updateProfile.isPending}
              onClick={toggleProtect}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60',
                protectAvatar ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                  protectAvatar ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          </div>

          <div className="space-y-3">
            <Feature icon={<Download className="h-4 w-4" />} title="No downloads" desc="Others can't save your photo" />
            <Feature icon={<Camera className="h-4 w-4" />} title="Screenshot blur" desc="Blurs on capture attempts" />
            <Feature icon={<Check className="h-4 w-4" />} title="You keep access" desc="Download your own anytime" />
          </div>
        </div>
      </Modal>

      <Modal open={openModal === 'notifications'} onClose={close} title="Notifications" className="max-w-md">
        <div className="space-y-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-brand-500/30">
              <Bell className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-50">Push notifications</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Get alerted to new messages when the app is in the background.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  notifPerm === 'granted' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
                )}
              />
              <span className="text-slate-600 dark:text-slate-300">
                {notifPerm === 'granted'
                  ? 'Desktop notifications are on'
                  : notifPerm === 'denied'
                    ? 'Blocked — enable them in your browser settings'
                    : notifPerm === 'unsupported'
                      ? 'Not supported on this browser'
                      : 'Turn on to get notified while away'}
              </span>
            </div>
            {notifPerm === 'default' && (
              <Button size="sm" variant="secondary" onClick={enableNotifications}>
                Enable
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** A premium feature line: soft icon chip + title + description. */
function Feature({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
        {icon}
      </span>
      <div className="text-sm">
        <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </div>
  );
}
