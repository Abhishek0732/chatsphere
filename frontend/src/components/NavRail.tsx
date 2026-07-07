import { NavLink, useLocation } from 'react-router-dom';
import { MessageCircle, CircleDashed, User, Settings, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { cn } from '@/utils/cn';

const navItems = [
  { to: '/', label: 'Chats', icon: MessageCircle },
  { to: '/contacts', label: 'Updates', icon: CircleDashed },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Desktop vertical rail + mobile bottom bar navigation. */
export function NavRail({ hideMobileBar = false }: { hideMobileBar?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const openViewer = useImageViewer((s) => s.open);
  const { pathname } = useLocation();

  // Keep "Chats" lit while inside a conversation, like Discord highlights the
  // current section regardless of the exact sub-route.
  const isNavActive = (to: string) =>
    to === '/' ? pathname === '/' || pathname.startsWith('/chat') : pathname.startsWith(to);

  return (
    <>
      {/* Desktop rail */}
      <nav className="glass-panel md-float hidden w-[68px] flex-col items-center gap-2 py-4 md:flex">
        {/* Brand mark */}
        <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="mb-2">
          <Avatar
            name={user?.displayName ?? '?'}
            src={user?.avatarUrl}
            size="md"
            className="ring-2 ring-brand-500/40 ring-offset-2 ring-offset-white transition hover:ring-brand-500/70 dark:ring-offset-slate-900"
            onClick={() => openViewer(user?.displayName ?? 'You', user?.avatarUrl, { circle: true })}
          />
        </div>
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = isNavActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={cn(
                // Discord-style: squircle that morphs squarer on hover/active,
                // with an animated pill indicator on the rail's left edge.
                'group/nav relative flex h-11 w-11 items-center justify-center transition-all duration-200 active:scale-95',
                active
                  ? 'rounded-2xl bg-brand-gradient text-white shadow-glow'
                  : 'rounded-[22px] text-slate-500 hover:rounded-2xl hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100',
              )}
            >
              <span
                className={cn(
                  'absolute -left-[14px] w-[3px] rounded-r-full bg-white transition-all duration-200',
                  active ? 'h-6' : 'h-0 group-hover/nav:h-2.5',
                )}
              />
              <Icon className="h-5 w-5" />
            </NavLink>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        className={cn(
          'glass-panel fixed inset-x-0 bottom-0 z-30 items-center justify-around border-t border-white/40 py-1.5 dark:border-white/5 md:hidden',
          hideMobileBar ? 'hidden' : 'flex',
        )}
      >
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px]',
              isNavActive(to) ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
