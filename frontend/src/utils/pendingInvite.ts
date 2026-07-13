/**
 * A shared invite link (/i/<code>) opened while signed out is remembered here,
 * so logging in resumes it instead of dropping the invitation on the floor.
 * Stores the PATH, so the resume is a plain navigation.
 */
export const PENDING_INVITE_KEY = 'pendingInvitePath';

export function pendingInvitePath(): string | null {
  return sessionStorage.getItem(PENDING_INVITE_KEY);
}
