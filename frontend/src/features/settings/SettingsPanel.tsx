import { useEffect, useState, type ReactNode } from 'react';
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
  Music2,
  Play,
  QrCode,
  Search,
  Share2,
  ShieldCheck,
  User,
  Trash2,
  X,
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
import { disablePush, enablePush, pushState, type PushState } from '@/services/push';
import { testPush } from '@/api/push';
import { useRingtoneStore } from '@/store/ringtoneStore';
import { RINGTONES, previewRingtone, stopRingtone } from '@/features/call/ringtone';
import { cn } from '@/utils/cn';
import { AppearanceStudio } from './AppearanceStudio';
import { ChangePasswordModal } from './ChangePasswordModal';
import { BlockedUsersModal } from './BlockedUsersModal';
import { InviteFriendsModal } from './InviteFriendsModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { QrModal } from '@/features/contacts/QrModal';

type SettingKey = 'appearance' | 'privacy' | 'notifications' | 'ringtone';

/** A settings row as data, so the search box can filter it. */
interface RowDef {
  key: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Extra search terms (synonyms) not shown in the row. */
  keywords?: string;
  onClick?: () => void;
  right?: ReactNode;
  danger?: boolean;
}
interface SectionDef {
  title: string;
  rows: RowDef[];
}

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ringtone = useRingtoneStore((s) => s.ringtone);
  const setRingtone = useRingtoneStore((s) => s.setRingtone);
  // Closing any settings modal also silences a ringtone preview left playing.
  const close = () => {
    stopRingtone();
    setOpenModal(null);
  };

  // Web Push: whether THIS browser is registered to be notified while the app is
  // closed. Distinct from the permission prompt — permission alone notifies you
  // only while a tab is open.
  const [push, setPush] = useState<PushState>('off');
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (push === 'on') {
        setPush(await disablePush());
        return;
      }
      const { state, reason } = await enablePush();
      setPush(state);
      setNotifPerm(notificationPermission());
      if (state === 'on') {
        toast({ title: 'Notifications on, even when closed', variant: 'success' });
      } else if (state === 'denied') {
        toast({ title: 'Blocked — enable notifications in your browser settings', variant: 'error' });
      } else {
        // 'off' or 'unsupported' — say WHY instead of silently flipping back.
        toast({
          title: 'Couldn’t turn on notifications',
          description: reason ?? 'Please try again.',
          variant: 'error',
        });
      }
    } catch {
      toast({ title: 'Couldn’t turn on notifications', description: 'Please try again.', variant: 'error' });
    } finally {
      setPushBusy(false);
    }
  };

  const enableNotifications = async () => setNotifPerm(await requestNotificationPermission());

  // Fire a test push to this browser so the user can confirm OS notifications
  // actually arrive (the SW shows a test even when the tab is focused).
  const sendTest = async () => {
    const res = await testPush().catch(() => null);
    if (!res) return toast({ title: 'Could not send a test notification', variant: 'error' });
    if (!res.enabled) {
      toast({ title: 'Push is switched off on the server', variant: 'error' });
    } else if (res.devices === 0) {
      toast({ title: 'No device registered yet — turn notifications on first', variant: 'error' });
    } else {
      toast({
        title: `Test sent to ${res.devices} device${res.devices > 1 ? 's' : ''}`,
        description: 'It should pop up in a moment — even over other windows.',
        variant: 'success',
      });
    }
  };
  const protectAvatar = !!user?.protectAvatar;
  const toggleProtect = () => updateProfile.mutate({ protectAvatar: !protectAvatar });
  // Reciprocal privacy toggles (default ON): turning either off also hides the
  // other person's from you.
  const readReceipts = user?.readReceiptsEnabled !== false;
  const toggleReadReceipts = () => updateProfile.mutate({ readReceiptsEnabled: !readReceipts });
  const lastSeen = user?.lastSeenEnabled !== false;
  const toggleLastSeen = () => updateProfile.mutate({ lastSeenEnabled: !lastSeen });
  const soon = () => toast({ title: 'Coming soon', variant: 'info' });

  // Invite: a dialog around a SHORT, opaque "add me" link (/i/<code>) — the old
  // link carried the raw QR token in the URL, which is a long-lived secret and
  // has no business being pasted into someone's chat window.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  // The settings as data so search can filter them. `keywords` holds synonyms a
  // user might type that aren't in the visible title/subtitle.
  const sections: SectionDef[] = [
    {
      title: 'General',
      rows: [
        {
          key: 'dark-mode',
          icon: <Moon className="h-5 w-5" />,
          title: 'Dark Mode',
          keywords: 'theme appearance light dark',
          onClick: () => setTheme(isDark ? 'light' : 'dark'),
          right: (
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
          ),
        },
        {
          key: 'account',
          icon: <User className="h-5 w-5" />,
          title: 'Account',
          keywords: 'profile name username avatar',
          onClick: () => navigate('/profile'),
        },
      ],
    },
    {
      title: 'Communication',
      rows: [
        {
          key: 'chats',
          icon: <MessageSquareText className="h-5 w-5" />,
          title: 'Chats',
          subtitle: 'Theme, Wallpaper, History',
          keywords: 'wallpaper background bubble export',
          onClick: () => setOpenModal('appearance'),
        },
        {
          key: 'ringtone',
          icon: <Music2 className="h-5 w-5" />,
          title: 'Call ringtone',
          subtitle: RINGTONES.find((r) => r.id === ringtone)?.label ?? 'Classic',
          keywords: 'sound tone ring call',
          onClick: () => setOpenModal('ringtone'),
        },
        {
          key: 'notifications',
          icon: notifPerm === 'granted' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />,
          title: 'Notifications',
          keywords: 'push alerts sound mute',
          onClick: () => setOpenModal('notifications'),
        },
      ],
    },
    {
      title: 'Privacy & Security',
      rows: [
        {
          key: 'privacy',
          icon: <ShieldCheck className="h-5 w-5" />,
          title: 'Privacy',
          keywords: 'profile photo protection last seen presence',
          onClick: () => setOpenModal('privacy'),
        },
        {
          key: 'password',
          icon: <Lock className="h-5 w-5" />,
          title: 'Change password',
          subtitle: 'Update your account password',
          keywords: 'security login credentials',
          onClick: () => setPwOpen(true),
        },
        {
          key: 'blocked',
          icon: <Ban className="h-5 w-5" />,
          title: 'Blocked contacts',
          subtitle: "People you've blocked",
          keywords: 'unblock spam',
          onClick: () => setBlockedOpen(true),
        },
        {
          key: 'storage',
          icon: <Database className="h-5 w-5" />,
          title: 'Storage and Data',
          keywords: 'cache media download usage',
          onClick: soon,
        },
      ],
    },
    {
      title: 'Support',
      rows: [
        {
          key: 'help',
          icon: <HelpCircle className="h-5 w-5" />,
          title: 'Help Center',
          keywords: 'support faq contact',
          onClick: soon,
        },
        {
          key: 'invite',
          icon: <Share2 className="h-5 w-5 text-primary" />,
          title: 'Invite Friends',
          subtitle: 'Share your personal add-me link',
          keywords: 'share link add me referral',
          onClick: () => setInviteOpen(true),
          right: <span />,
        },
      ],
    },
    {
      title: 'Account',
      rows: [
        {
          key: 'logout',
          icon: <LogOut className="h-5 w-5" />,
          title: logout.isPending ? 'Signing out…' : 'Log Out',
          keywords: 'sign out exit',
          danger: true,
          onClick: () => logout.mutate(),
          right: <span />,
        },
        {
          key: 'delete',
          icon: <Trash2 className="h-5 w-5" />,
          title: 'Delete Account',
          subtitle: 'Permanently close this account',
          keywords: 'remove close deactivate',
          danger: true,
          onClick: () => setDeleteOpen(true),
          right: <span />,
        },
      ],
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sections
        .map((s) => ({
          ...s,
          rows: s.rows.filter((r) =>
            `${s.title} ${r.title} ${r.subtitle ?? ''} ${r.keywords ?? ''}`
              .toLowerCase()
              .includes(q),
          ),
        }))
        .filter((s) => s.rows.length > 0)
    : sections;

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <div className="min-h-full bg-surface pb-20 text-on-surface">
      {/* Top app bar */}
      <header className="glass-panel sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-x-0 border-t-0 px-5">
        {searchOpen ? (
          <>
            <Search className="h-5 w-5 shrink-0 text-on-surface-variant" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              placeholder="Search settings…"
              className="min-w-0 flex-1 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
            <button
              onClick={closeSearch}
              className="shrink-0 rounded-full p-2 text-on-surface-variant transition hover:bg-white/5"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
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
              onClick={() => setSearchOpen(true)}
              className="rounded-full p-2 text-on-surface-variant transition hover:bg-white/5"
              aria-label="Search settings"
            >
              <Search className="h-5 w-5" />
            </button>
          </>
        )}
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-5 pt-6">
        {/* Profile summary — hidden while searching so results stand alone. */}
        {!q && user && (
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

        {filtered.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.rows.map((row) => (
              <Row
                key={row.key}
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                onClick={row.onClick}
                right={row.right}
                danger={row.danger}
              />
            ))}
          </Section>
        ))}

        {q && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            No settings match “{query.trim()}”.
          </p>
        )}
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

          {/* Reciprocal privacy toggles, messenger-style. */}
          <div className="space-y-3 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-on-surface">Read receipts</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  If off, you won't send or see blue ticks. Group chats always show them.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={readReceipts}
                disabled={updateProfile.isPending}
                onClick={toggleReadReceipts}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60',
                  readReceipts ? 'bg-primary' : 'bg-surface-container-highest',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                    readReceipts ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-on-surface">Last seen &amp; online</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  If off, you won't see anyone's last seen or online either.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={lastSeen}
                disabled={updateProfile.isPending}
                onClick={toggleLastSeen}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60',
                  lastSeen ? 'bg-primary' : 'bg-surface-container-highest',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                    lastSeen ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={openModal === 'ringtone'} onClose={close} title="Call ringtone">
        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <Music2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">Incoming call ringtone</p>
              <p className="text-sm text-on-surface-variant">
                Pick the tone that plays for incoming calls. A web app can’t use your phone’s
                system ringtone, so choose one here — saved on this device.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {RINGTONES.map((r) => {
              const selected = r.id === ringtone;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-4 py-3 transition',
                    selected
                      ? 'border-primary/60 bg-primary-container/40'
                      : 'border-white/10 bg-white/[0.04]',
                  )}
                >
                  <button
                    onClick={() => previewRingtone(r.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-on-surface hover:bg-white/20"
                    aria-label={`Preview ${r.label}`}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setRingtone(r.id);
                      previewRingtone(r.id);
                    }}
                    className="min-w-0 flex-1 text-left text-sm font-medium text-on-surface"
                  >
                    {r.label}
                  </button>
                  {selected && <Check className="h-5 w-5 shrink-0 text-primary" />}
                </div>
              );
            })}
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
                Get told about new messages, mentions and calls — even when ChatSphere is
                closed.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <div className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  push === 'on' ? 'bg-green-500' : 'bg-surface-container-highest',
                )}
              />
              <span className="text-on-surface-variant">
                {push === 'on'
                  ? 'On — this device will be notified while the app is shut'
                  : push === 'denied'
                    ? 'Blocked — enable notifications in your browser settings'
                    : push === 'unsupported'
                      ? 'Not supported on this browser'
                      : 'Off — you will only be notified while the app is open'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {push === 'on' && (
                <Button size="sm" variant="ghost" onClick={sendTest}>
                  Test
                </Button>
              )}
              {(push === 'on' || push === 'off') && (
                <Button size="sm" variant="secondary" onClick={togglePush} disabled={pushBusy}>
                  {pushBusy ? '…' : push === 'on' ? 'Turn off' : 'Turn on'}
                </Button>
              )}
            </div>
          </div>
          {/* Fallback: the browser supports notifications but not Web Push (or the
              server has no VAPID keys) — at least offer in-app alerts. */}
          {push === 'off' && notifPerm === 'default' && (
            <button
              onClick={enableNotifications}
              className="text-xs text-on-surface-variant underline underline-offset-2"
            >
              Or just allow notifications while the app is open
            </button>
          )}
        </div>
      </Modal>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      <BlockedUsersModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <InviteFriendsModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
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
