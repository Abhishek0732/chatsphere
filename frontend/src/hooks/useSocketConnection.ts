import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '@/services/socket';
import { onForcedLogout, onTokenRefreshed } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/services/queryClient';
import { toast } from '@/store/toastStore';
import { NAVIGATE_EVENT, requestNotificationPermission } from '@/utils/notifications';

/**
 * Owns the WebSocket lifecycle for the authenticated app shell:
 * connects on mount, reconnects when the access token is refreshed, and
 * handles forced logout when refresh fails.
 */
export function useSocketConnection() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (!accessToken) return;
    socketService.connect();

    // Ask for desktop-notification permission once we're signed in.
    void requestNotificationPermission();

    // Clicking an OS notification asks the app to open a chat; navigate in-SPA.
    const onNavigate = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (typeof path === 'string') navigate(path);
    };
    window.addEventListener(NAVIGATE_EVENT, onNavigate);

    const offRefresh = onTokenRefreshed(() => {
      // New token -> STOMP CONNECT headers are stale, reconnect.
      socketService.reconnect();
    });

    const offLogout = onForcedLogout(() => {
      socketService.disconnect();
      logout();
      queryClient.clear();
      toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'error' });
      navigate('/login', { replace: true });
    });

    return () => {
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
      offRefresh();
      offLogout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);
}
