import { cn } from '@/utils/cn';

/**
 * Shimmer placeholders.
 *
 * Loading used to mean a spinner — or, while a lazy chunk loaded, a blank
 * screen. Both make the app feel slower than it is. A skeleton shaped like the
 * content that is about to arrive keeps the layout stable and gives the eye
 * something to hold on to, so nothing ever flashes empty.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} />;
}

/** One row of a list: avatar + two lines (chats, contacts, calls, members). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5', className)}>
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-3 w-8 shrink-0" />
    </div>
  );
}

export function SkeletonList({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-1', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Message bubbles, alternating sides, with varied widths so it reads as a chat. */
export function SkeletonThread({ rows = 7 }: { rows?: number }) {
  const widths = ['w-40', 'w-56', 'w-32', 'w-64', 'w-44', 'w-28', 'w-52'];
  return (
    <div className="space-y-3 px-4 py-4" aria-busy="true" aria-label="Loading messages">
      {Array.from({ length: rows }, (_, i) => {
        const mine = i % 3 === 0;
        return (
          <div key={i} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <Skeleton
              className={cn(
                'h-10 rounded-2xl',
                widths[i % widths.length],
                mine ? 'rounded-br-none' : 'rounded-bl-none',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Square tiles — the media grid and the album gallery. */
export function SkeletonGrid({ tiles = 9, cols = 3 }: { tiles?: number; cols?: number }) {
  return (
    <div
      className={cn('grid gap-2', cols === 4 ? 'grid-cols-4' : 'grid-cols-3')}
      aria-busy="true"
      aria-label="Loading media"
    >
      {Array.from({ length: tiles }, (_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}

/**
 * The whole app shell. This is what shows while the authenticated bundle loads
 * — previously a blank page, because the shell is code-split.
 */
export function SkeletonAppShell() {
  return (
    <div className="flex h-full w-full bg-surface" aria-busy="true" aria-label="Loading ChatSphere">
      {/* Nav rail */}
      <div className="hidden w-64 shrink-0 flex-col gap-2 border-r border-white/5 p-4 sm:flex">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-xl" />
        ))}
      </div>

      {/* Conversation list */}
      <div className="w-full max-w-sm shrink-0 border-r border-white/5 p-3">
        <Skeleton className="mb-3 h-8 w-40" />
        <Skeleton className="mb-4 h-10 w-full rounded-xl" />
        <SkeletonList rows={7} />
      </div>

      {/* Thread pane */}
      <div className="hidden flex-1 flex-col md:flex">
        <div className="flex items-center gap-3 border-b border-white/5 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <SkeletonThread />
      </div>
    </div>
  );
}
