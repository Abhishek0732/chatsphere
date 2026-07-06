import { Outlet, useLocation } from 'react-router-dom';
import { NavRail } from '@/components/NavRail';
import { ImageViewer } from '@/components/ui/ImageViewer';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { useMe } from '@/hooks/useProfile';
import { cn } from '@/utils/cn';

/**
 * Authenticated app shell: owns the WebSocket lifecycle, loads the current
 * user, and renders the navigation rail + routed content.
 */
export function AppLayout() {
  useSocketConnection();
  useMe();

  const location = useLocation();
  const isThread = location.pathname.startsWith('/chat/');

  return (
    <div className="app-bg flex h-full w-full overflow-hidden md:gap-3 md:p-3">
      <NavRail hideMobileBar={isThread} />
      <main
        className={cn(
          'min-w-0 flex-1 overflow-hidden',
          // Reserve space for the mobile bottom bar unless we're in a thread.
          isThread ? 'pb-0' : 'pb-14 md:pb-0',
        )}
      >
        <Outlet />
      </main>
      <ImageViewer />
    </div>
  );
}
