import { cn } from '@/utils/cn';

/**
 * ChatSphere brand mark — the "Orbit Bubble": a white chat bubble that reads as
 * a sphere, wrapped by an orbital ring with an accent node, three typing dots
 * inside. Colors come from the brand gradient tokens (--grad-from/--grad-to) so
 * the logo automatically follows the user's chosen accent.
 *
 * Sizing + shadow come from `className` (e.g. "h-14 w-14 shadow-lg"); the
 * rounded squircle + clip are baked in.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[26%]',
        className,
      )}
    >
      <svg viewBox="0 0 512 512" className="h-full w-full" role="img" aria-label="ChatSphere">
        <defs>
          <linearGradient id="csLogoBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--grad-from)" />
            <stop offset="1" stopColor="var(--grad-to)" />
          </linearGradient>
          <linearGradient id="csLogoDot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--grad-from)" />
            <stop offset="1" stopColor="var(--grad-to)" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" fill="url(#csLogoBg)" />
        {/* orbit ring (behind the sphere) + node */}
        <ellipse
          cx="256"
          cy="252"
          rx="188"
          ry="92"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.92"
          strokeWidth="14"
          transform="rotate(-20 256 252)"
        />
        <circle cx="371" cy="147" r="26" fill="#fff" />
        <circle cx="371" cy="147" r="12.5" fill="url(#csLogoDot)" />
        {/* sphere / chat bubble + tail */}
        <circle cx="256" cy="248" r="120" fill="#fff" />
        <path d="M172 322 C152 360 134 372 134 372 C170 368 198 350 216 326 Z" fill="#fff" />
        {/* typing dots */}
        <circle cx="210" cy="248" r="18" fill="url(#csLogoDot)" />
        <circle cx="256" cy="248" r="18" fill="url(#csLogoDot)" />
        <circle cx="302" cy="248" r="18" fill="url(#csLogoDot)" />
      </svg>
    </span>
  );
}
