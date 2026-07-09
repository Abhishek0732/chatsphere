import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquareText, Users, Phone, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { cn } from '@/utils/cn';

const mainItems = [
  { to: '/', label: 'Chats', icon: MessageSquareText },
  { to: '/contacts', label: 'Updates', icon: Users },
  { to: '/calls', label: 'Calls', icon: Phone },
];

/** Desktop labeled nav drawer (profile + tabs) + mobile bottom bar. */
export function NavRail({ hideMobileBar = false }: { hideMobileBar?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const openViewer = useImageViewer((s) => s.open);
  const { pathname } = useLocation();

  const isNavActive = (to: string) =>
    to === '/' ? pathname === '/' || pathname.startsWith('/chat') : pathname.startsWith(to);

  const itemClass = (active: boolean) =>
    cn(
      'flex items-center gap-4 rounded-xl p-3 transition-all duration-300 hover:translate-x-1',
      active
        ? 'bg-primary-container text-on-primary-container'
        : 'text-on-surface-variant hover:bg-surface-variant/30',
    );

  return (
    <>
      {/* Desktop drawer */}
      <nav className="hidden h-full w-20 shrink-0 flex-col gap-2 border-r border-white/10 bg-surface/70 p-3 backdrop-blur-xl md:flex lg:w-72">
        {/* Profile header */}
        <button
          type="button"
          onClick={() => openViewer(user?.displayName ?? 'You', user?.avatarUrl, { circle: true })}
          className="flex items-center gap-3 rounded-xl px-1 py-3 text-left"
        >
          <div className="relative h-12 w-12 shrink-0">
            <Avatar name={user?.displayName ?? '?'} src={user?.avatarUrl} size="lg" className="h-12 w-12" />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-green-400" />
          </div>
          <div className="hidden min-w-0 flex-col lg:flex">
            <span className="truncate text-lg font-semibold leading-tight text-primary">
              {user?.displayName ?? 'You'}
            </span>
            <span className="text-sm text-on-surface-variant">Online</span>
          </div>
        </button>

        {/* Tabs */}
        <div className="mt-4 flex flex-1 flex-col gap-1">
          {mainItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={label} className={itemClass(isNavActive(to))}>
              <Icon className="h-6 w-6 shrink-0" strokeWidth={isNavActive(to) ? 2.4 : 2} />
              <span className="hidden text-base lg:block">{label}</span>
            </NavLink>
          ))}

          <NavLink to="/settings" title="Settings" className={cn(itemClass(isNavActive('/settings')), 'mt-auto')}>
            <Settings className="h-6 w-6 shrink-0" strokeWidth={isNavActive('/settings') ? 2.4 : 2} />
            <span className="hidden text-base lg:block">Settings</span>
          </NavLink>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 items-center justify-around border-t border-white/10 bg-surface/80 py-1.5 backdrop-blur-xl md:hidden',
          hideMobileBar ? 'hidden' : 'flex',
        )}
      >
        {[...mainItems, { to: '/settings', label: 'Settings', icon: Settings }].map(
          ({ to, label, icon: Icon }) => {
            const active = isNavActive(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px]',
                  active ? 'text-primary' : 'text-on-surface-variant',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </NavLink>
            );
          },
        )}
      </nav>
    </>
  );
}
