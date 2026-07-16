/**
 * Desktop / OS notifications via the Web Notifications API. These pop over
 * whatever else the user has open when the app is in the background (another
 * tab, another window, minimised), as long as a ChatSphere tab is still alive.
 *
 * Clicking a notification focuses the app and asks it to navigate; the actual
 * router navigation is performed by a listener (see useSocketConnection) so we
 * stay within the SPA instead of doing a full reload.
 */

/** Custom DOM event carrying an in-app path to navigate to. */
export const NAVIGATE_EVENT = 'chatsphere:navigate';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'granted' | 'denied' | 'default' | 'unsupported'. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** Ask for permission if it hasn't been decided yet. Returns the final state. */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Per-conversation buffer so repeat messages accumulate (messenger-style)
 *  into a single growing notification instead of replacing each other. */
interface MessageBucket {
  title: string;
  lines: string[];
  count: number;
}
const buckets = new Map<number, MessageBucket>();
const MAX_LINES = 6;

/**
 * Notify about an incoming chat message. Successive messages for the same
 * conversation are collapsed into ONE notification whose body lists them and
 * whose title carries a count (e.g. "Group name (3 messages)"), matching how
 * Modern messengers stack unread messages.
 */
export function notifyMessage(opts: {
  conversationId: number;
  title: string;
  line: string;
  path?: string;
}): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;

  const bucket = buckets.get(opts.conversationId) ?? { title: opts.title, lines: [], count: 0 };
  bucket.title = opts.title;
  bucket.count += 1;
  bucket.lines.push(opts.line);
  if (bucket.lines.length > MAX_LINES) {
    bucket.lines = bucket.lines.slice(-MAX_LINES);
  }
  buckets.set(opts.conversationId, bucket);

  const hidden = bucket.count - bucket.lines.length;
  const bodyLines = hidden > 0 ? [`…and ${hidden} earlier`, ...bucket.lines] : bucket.lines;

  const title = bucket.count > 1 ? `${bucket.title} (${bucket.count} messages)` : bucket.title;

  try {
    const n = new Notification(title, {
      body: bodyLines.join('\n'),
      // Same tag => one notification per conversation; renotify re-alerts on
      // each new message instead of silently updating in place. `renotify` is
      // valid at runtime but missing from the DOM lib types, hence the cast.
      tag: `conversation-${opts.conversationId}`,
      renotify: true,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    } as NotificationOptions & { renotify: boolean });
    n.onclick = () => {
      window.focus();
      if (opts.path) {
        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: opts.path }));
      }
      clearMessageNotifications(opts.conversationId);
      n.close();
    };
  } catch {
    // Some browsers (notably mobile) only allow notifications through the
    // service worker; silently ignore rather than crash the socket handler.
  }
}

/** Reset a conversation's accumulated notification (call when it's opened/read). */
export function clearMessageNotifications(conversationId: number): void {
  buckets.delete(conversationId);
}
