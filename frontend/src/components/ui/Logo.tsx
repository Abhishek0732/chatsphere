import { cn } from '@/utils/cn';

/**
 * ChatSphere brand mark — the "Orbit Bubble": a white chat bubble that reads as
 * a sphere, wrapped by an orbital ring with an accent node, three typing dots
 * inside.
 *
 * The tile background uses the `.bg-brand-gradient` CSS utility (reliable across
 * browsers/modes) rather than an in-SVG gradient — a `var()` inside an SVG
 * `stop-color` paints inconsistently (it was rendering white in some light-mode
 * cases). The mark is solid white; the dots/node use `currentColor`, set to a
 * brand tone, so the whole logo still follows the chosen accent.
 *
 * Sizing + shadow come from `className` (e.g. "h-14 w-14 shadow-lg").
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'bg-brand-gradient inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[26%] text-brand-600',
        className,
      )}
    >
      <svg viewBox="0 0 512 512" className="h-full w-full" role="img" aria-label="ChatSphere">
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
        <circle cx="371" cy="147" r="12.5" fill="currentColor" />
        {/* sphere / chat bubble + tail */}
        <circle cx="256" cy="248" r="120" fill="#fff" />
        <path d="M172 322 C152 360 134 372 134 372 C170 368 198 350 216 326 Z" fill="#fff" />
        {/* typing dots */}
        <circle cx="210" cy="248" r="18" fill="currentColor" />
        <circle cx="256" cy="248" r="18" fill="currentColor" />
        <circle cx="302" cy="248" r="18" fill="currentColor" />
      </svg>
    </span>
  );
}
