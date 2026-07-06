import { NavLink } from 'react-router-dom';
import { MessageCircle, Users, User, Settings, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { cn } from '@/utils/cn';

const navItems = [
  { to: '/', label: 'Chats', icon: MessageCircle, end: true },
  { to: '/contacts', label: 'Contacts', icon: Users, end: false },
  { to: '/profile', label: 'Profile', icon: User, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

/** Desktop vertical rail + mobile bottom bar navigation. */
export function NavRail({ hideMobileBar = false }: { hideMobileBar?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const openViewer = useImageViewer((s) => s.open);

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
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              cn(
                'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 active:scale-95',
                isActive
                  ? 'bg-brand-gradient text-white shadow-glow'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
              )
            }
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
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
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px]',
                isActive ? 'text-brand-600' : 'text-slate-500 dark:text-slate-400',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
