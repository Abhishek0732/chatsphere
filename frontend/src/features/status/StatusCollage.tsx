import { mediaSrc } from '@/utils/media';
import { cn } from '@/utils/cn';
import type { StatusMedia } from '@/types';

/**
 * Several photos/videos shown together in ONE status frame — a collage, the way a
 * multi-photo post looks in modern messengers (all visible at once, no tapping
 * through). Small counts get a curated mosaic (a featured tile + fillers) that
 * tiles the square exactly; larger counts fall back to an even square-ish grid.
 */
const LAYOUTS: Record<number, { grid: string; tiles: string[] }> = {
  2: { grid: 'grid-cols-2 grid-rows-1', tiles: ['', ''] },
  3: { grid: 'grid-cols-2 grid-rows-2', tiles: ['row-span-2', '', ''] },
  4: { grid: 'grid-cols-2 grid-rows-2', tiles: ['', '', '', ''] },
  5: { grid: 'grid-cols-3 grid-rows-2', tiles: ['col-span-2', '', '', '', ''] },
  6: { grid: 'grid-cols-3 grid-rows-2', tiles: ['', '', '', '', '', ''] },
};

export function StatusCollage({
  media,
  className,
  onTileClick,
}: {
  media: StatusMedia[];
  className?: string;
  /** Optional: open a single tile (e.g. full-screen) when tapped. */
  onTileClick?: (index: number) => void;
}) {
  const n = media.length;
  const layout = LAYOUTS[n];
  // Fallback for 7+: an even grid sized so every row/column has real height.
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const fallbackStyle = layout
    ? undefined
    : {
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      };

  return (
    <div
      className={cn('mx-auto grid aspect-square w-full max-w-[72vh] gap-1', layout?.grid, className)}
      style={fallbackStyle}
    >
      {media.map((m, i) => (
        <button
          key={i}
          type="button"
          onClick={onTileClick ? () => onTileClick(i) : undefined}
          className={cn(
            'relative overflow-hidden rounded-md bg-white/5',
            onTileClick && 'cursor-zoom-in',
            layout?.tiles[i],
          )}
        >
          {m.type === 'VIDEO' ? (
            <video
              src={mediaSrc(m.url)}
              muted
              autoPlay
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={mediaSrc(m.url)} alt="" className="h-full w-full object-cover" />
          )}
        </button>
      ))}
    </div>
  );
}
