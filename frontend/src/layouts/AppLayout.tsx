import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavRail } from '@/components/NavRail';
import { ImageViewer } from '@/components/ui/ImageViewer';
import { CallManager } from '@/features/call/CallManager';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { useMe } from '@/hooks/useProfile';
import { syncPushOnLogin } from '@/services/push';
import { cn } from '@/utils/cn';

/**
 * Authenticated app shell: owns the WebSocket lifecycle, loads the current
 * user, and renders the navigation rail + routed content.
 */
export function AppLayout() {
  useSocketConnection();
  useMe();

  // If this browser already has notification permission, make sure the server has
  // its push subscription — the endpoint is keyed to whoever subscribed last, so
  // a new login on a shared machine must re-claim it. Never prompts here; that
  // only happens when the user asks for it in Settings.
  useEffect(() => {
    void syncPushOnLogin();
  }, []);

  const location = useLocation();
  // Thread + call screens go full-bleed on mobile (no bottom nav bar).
  const isFullScreen =
    location.pathname.startsWith('/chat/') || location.pathname.startsWith('/call/');

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface text-on-surface">
      <NavRail hideMobileBar={isFullScreen} />
      <main
        className={cn(
          'min-w-0 flex-1 overflow-hidden',
          // Reserve space for the mobile bottom bar unless we're full-screen.
          isFullScreen ? 'pb-0' : 'pb-14 md:pb-0',
        )}
      >
        <Outlet />
      </main>
      <ImageViewer />
      <CallManager />
    </div>
  );
}
