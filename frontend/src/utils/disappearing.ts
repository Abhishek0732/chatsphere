/** Disappearing-messages timer presets, matching WhatsApp's choices. */
export interface DisappearingOption {
  label: string;
  seconds: number | null;
}

export const DISAPPEARING_OPTIONS: DisappearingOption[] = [
  { label: 'Off', seconds: null },
  { label: '24 hours', seconds: 86_400 },
  { label: '7 days', seconds: 604_800 },
  { label: '90 days', seconds: 7_776_000 },
];

/** A human label for a ttl in seconds (e.g. 604800 -> "7 days"). */
export function formatDisappearing(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return 'Off';
  const known = DISAPPEARING_OPTIONS.find((o) => o.seconds === seconds);
  if (known) return known.label;
  if (seconds % 86_400 === 0) return `${seconds / 86_400} days`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hours`;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * True when a message has passed its disappearing deadline. Clients hide expired
 * messages immediately, so they vanish from view before the server sweep gets to
 * hard-delete the row.
 */
export function isExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t <= now;
}
