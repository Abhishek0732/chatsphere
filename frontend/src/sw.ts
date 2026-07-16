/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

/**
 * The service worker.
 *
 * Its whole reason for existing is the `push` handler below: a service worker is
 * the ONLY thing that runs when the app is closed, so it is the only thing that
 * can announce a message to someone who is not currently looking at ChatSphere.
 * Everything else in the app talks over a WebSocket, which by definition only
 * reaches an open tab.
 */

// Keep the offline app-shell behaviour the generated worker used to give us.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  // A "does this work?" push from Settings — shown even if a tab is focused, so
  // the click gives immediate feedback.
  test?: boolean;
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {};
  try {
    data = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    // A push with a non-JSON body is still worth showing rather than dropping.
    data = { body: event.data?.text() };
  }

  const title = data.title || 'ChatSphere';
  const body = data.body || 'New message';
  const url = data.url || '/';

  event.waitUntil(
    (async () => {
      // Don't double-announce: if a window is already open AND focused, the app
      // itself is handling notifications over the socket.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const focused = clients.some((c) => 'focused' in c && (c as WindowClient).focused);
      if (focused && !data.test) return;

      await self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        // Collapse repeat messages from the same sender into one notification
        // instead of stacking twenty of them.
        tag: `chatsphere-${title}`,
        renotify: true,
        data: { url },
      } as NotificationOptions);
    })(),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Focus the app if it is already open, rather than opening a second copy.
      for (const client of clients) {
        if ('focus' in client) {
          const w = client as WindowClient;
          await w.focus();
          if (url !== '/' && 'navigate' in w) await w.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
