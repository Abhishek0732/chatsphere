import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Camera,
  Check,
  ChevronRight,
  Database,
  Download,
  HelpCircle,
  Lock,
  LogOut,
  MessageSquareText,
  Moon,
  QrCode,
  Search,
  Share2,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { notificationPermission, requestNotificationPermission } from '@/utils/notifications';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { useUpdateProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/ui/Avatar';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import { AppearanceStudio } from './AppearanceStudio';
import { ChangePasswordModal } from './ChangePasswordModal';
import { BlockedUsersModal } from './BlockedUsersModal';
import { QrModal } from '@/features/contacts/QrModal';

type SettingKey = 'appearance' | 'privacy' | 'notifications';

/** A single settings row: tertiary icon + label (+subtitle) and a chevron/toggle. */
function Row({
  icon,
  title,
  subtitle,
  onClick,
  right,
  danger,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/5"
    >
      <span className="flex items-center gap-3">
        <span className={cn('shrink-0', danger ? 'text-error' : 'text-tertiary')}>{icon}</span>
        <span>
          <p className={cn('text-base', danger ? 'text-error' : 'text-on-surface')}>{title}</p>
          {subtitle && <p className="text-sm text-on-surface-variant">{subtitle}</p>}
        </span>
      </span>
      {right ?? (
        <ChevronRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-1" />
      )}
    </button>
  );
}

/** A titled group of rows in a glass card. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {title}
      </h3>
      <div className="glass-card divide-y divide-white/5 overflow-hidden rounded-xl">{children}</div>
    </section>
  );
}

export function SettingsPanel() {
  const user = useAuthStore((s) => s.user);
  const openViewer = useImageViewer((s) => s.open);
  const logout = useLogout();
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();

  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const [openModal, setOpenModal] = useState<SettingKey | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const close = () => setOpenModal(null);

  const enableNotifications = async () => setNotifPerm(await requestNotificationPermission());
  const protectAvatar = !!user?.protectAvatar;
  const toggleProtect = () => updateProfile.mutate({ protectAvatar: !protectAvatar });
  const soon = () => toast({ title: 'Coming soon', variant: 'info' });

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="min-h-full bg-surface pb-20 text-on-surface">
      {/* Top app bar */}
      <header className="glass-panel sticky top-0 z-20 flex h-16 items-center justify-between border-x-0 border-t-0 px-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-primary transition active:scale-95 md:hidden"
            aria-label="Back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-primary">Settings</h1>
        </div>
        <button
          onClick={soon}
          className="rounded-full p-2 text-on-surface-variant transition hover:bg-white/5"
          aria-label="Search settings"
        >
          <Search className="h-5 w-5" />
        </button>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-5 pt-6">
        {/* Profile summary */}
        {user && (
          <Link to="/profile" className="glass-card flex items-center gap-4 rounded-xl p-4">
            <div className="relative">
              <Avatar
                name={user.displayName}
                src={user.avatarUrl}
                className="h-16 w-16 border-2 border-primary text-xl"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openViewer(user.displayName, user.avatarUrl, { circle: true });
                }}
              />
              <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-surface bg-green-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-on-surface">{user.displayName}</h2>
              <p className="truncate text-sm text-on-surface-variant">Online • @{user.username}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setQrOpen(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/20 text-primary transition hover:bg-primary-container/40"
              aria-label="My QR code"
            >
              <QrCode className="h-5 w-5" />
            </button>
          </Link>
        )}

        <Section title="General">
          <Row
            icon={<Moon className="h-5 w-5" />}
            title="Dark Mode"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            right={
              <span
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  isDark ? 'bg-primary' : 'bg-surface-container-highest',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                    isDark ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </span>
            }
          />
          <Row
            icon={<User className="h-5 w-5" />}
            title="Account"
            onClick={() => navigate('/profile')}
          />
        </Section>

        <Section title="Communication">
          <Row
            icon={<MessageSquareText className="h-5 w-5" />}
            title="Chats"
            subtitle="Theme, Wallpaper, History"
            onClick={() => setOpenModal('appearance')}
          />
          <Row
            icon={notifPerm === 'granted' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            title="Notifications"
            onClick={() => setOpenModal('notifications')}
          />
        </Section>

        <Section title="Privacy & Security">
          <Row
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Privacy"
            onClick={() => setOpenModal('privacy')}
          />
          <Row
            icon={<Lock className="h-5 w-5" />}
            title="Change password"
            subtitle="Update your account password"
            onClick={() => setPwOpen(true)}
          />
          <Row
            icon={<Ban className="h-5 w-5" />}
            title="Blocked contacts"
            subtitle="People you've blocked"
            onClick={() => setBlockedOpen(true)}
          />
          <Row icon={<Database className="h-5 w-5" />} title="Storage and Data" onClick={soon} />
        </Section>

        <Section title="Support">
          <Row icon={<HelpCircle className="h-5 w-5" />} title="Help Center" onClick={soon} />
          <Row
            icon={<Share2 className="h-5 w-5 text-primary" />}
            title="Invite Friends"
            onClick={soon}
            right={<span />}
          />
        </Section>

        <Section title="Account">
          <Row
            icon={<LogOut className="h-5 w-5" />}
            title={logout.isPending ? 'Signing out…' : 'Log Out'}
            danger
            onClick={() => logout.mutate()}
            right={<span />}
          />
        </Section>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <Modal open={openModal === 'appearance'} onClose={close} title="Chats" className="max-w-lg">
        <div className="-mx-1 max-h-[70vh] overflow-y-auto px-1 cs-scroll">
          <AppearanceStudio />
        </div>
      </Modal>

      <Modal open={openModal === 'privacy'} onClose={close} title="Privacy">
        <div className="space-y-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">Profile photo protection</p>
              <p className="text-sm text-on-surface-variant">
                Choose who can save or capture your picture.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-on-surface">Protect my profile photo</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">Applies to everyone but you</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={protectAvatar}
              disabled={updateProfile.isPending}
              onClick={toggleProtect}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60',
                protectAvatar ? 'bg-primary' : 'bg-surface-container-highest',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
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

      <Modal open={openModal === 'notifications'} onClose={close} title="Notifications">
        <div className="space-y-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <Bell className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">Push notifications</p>
              <p className="text-sm text-on-surface-variant">
                Get alerted to new messages when the app is in the background.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <div className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  notifPerm === 'granted' ? 'bg-green-500' : 'bg-surface-container-highest',
                )}
              />
              <span className="text-on-surface-variant">
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

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      <BlockedUsersModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}

/** A premium feature line: soft icon chip + title + description. */
function Feature({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="text-sm">
        <p className="font-medium text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant">{desc}</p>
      </div>
    </div>
  );
}
