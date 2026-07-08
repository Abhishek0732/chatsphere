/**
 * A stable per-browser device id, persisted in localStorage. Used to register
 * the device so the backend knows where to ring (and, later, where to push).
 */
const KEY = 'chatsphere-device-id';

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
