import { getPushKey, subscribePush, unsubscribePush } from '@/api/push';

/**
 * Web Push registration.
 *
 * Notifications used to reach only an OPEN tab — the app announced messages over
 * its WebSocket, so a closed app announced nothing. This registers the browser
 * with the server so a message (or a call, or a mention) still arrives when
 * ChatSphere is shut.
 *
 * Everything here degrades quietly: no service worker, no permission, or no VAPID
 * keys configured on the server all mean "push is off", never "the app is broken".
 */

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

/** The state plus, when it isn't 'on', a human explanation of why. */
export interface PushResult {
  state: PushState;
  reason?: string;
}

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const isIos = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1));

/** Why background notifications aren't available at all in this context. */
function unsupportedReason(): string {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Notifications need a secure (https) connection. Open the app’s https address instead of http.';
  }
  if (isIos()) {
    return 'On iPhone/iPad, add ChatSphere to your Home Screen and open it from there — Safari tabs can’t show background notifications.';
  }
  return 'This browser doesn’t support background notifications.';
}

/** The VAPID key arrives base64url-encoded; the browser wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function toPayload(sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  };
}

/** What the UI should show, without prompting for anything. */
export async function pushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

/**
 * Ask for permission (if needed) and register this browser with the server.
 * Returns the resulting state — callers use it to show why nothing happened.
 */
export async function enablePush(): Promise<PushResult> {
  if (!supported()) return { state: 'unsupported', reason: unsupportedReason() };

  const key = await getPushKey().catch(() => null);
  if (!key?.enabled || !key.publicKey) {
    return { state: 'off', reason: 'Notifications aren’t set up on the server yet.' };
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission === 'denied') return { state: 'denied' };
  if (permission !== 'granted') {
    return { state: 'off', reason: 'The permission prompt was dismissed — tap Turn on and choose Allow.' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    // Re-use the existing subscription if the browser already has one: creating a
    // second one would leave a dead endpoint the server keeps pushing to.
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key.publicKey),
      }));

    await subscribePush(toPayload(sub));
    return { state: 'on' };
  } catch {
    // subscribe() or the server round-trip failed — report it rather than
    // leaving the toggle looking like it just didn't respond.
    return { state: 'off', reason: 'Couldn’t register this device for notifications. Please try again.' };
  }
}

/** Turn push off for this browser (and stop the server pushing to a dead endpoint). */
export async function disablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return 'off';
  await unsubscribePush(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
  return 'off';
}

/**
 * Called after login: if this browser has already been granted permission, make
 * sure the server knows about the subscription (it may belong to a previous user
 * on this machine, and the endpoint is keyed to whoever subscribed last).
 * Never prompts — that only happens when the user asks for it in Settings.
 */
export async function syncPushOnLogin(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    await enablePush();
  } catch {
    // Push is a nice-to-have; a failure here must never block the app.
  }
}
