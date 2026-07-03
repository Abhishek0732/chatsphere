import { NavLink } from 'react-router-dom';
import { MessageCircle, Users, User, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuthStore } from '@/store/authStore';
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

  return (
    <>
      {/* Desktop rail */}
      <nav className="hidden w-16 flex-col items-center gap-2 border-r border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-2">
          <Avatar name={user?.displayName ?? '?'} src={user?.avatarUrl} size="md" />
        </div>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              cn(
                'flex h-11 w-11 items-center justify-center rounded-xl transition',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
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
          'fixed inset-x-0 bottom-0 z-30 items-center justify-around border-t border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900 md:hidden',
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
