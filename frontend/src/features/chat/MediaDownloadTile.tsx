import { Download, Image as ImageIcon, Mic, Video } from 'lucide-react';
import { cn } from '@/utils/cn';

type Kind = 'image' | 'video' | 'audio';

interface Props {
  kind: Kind;
  mine: boolean;
  /** Reveal (load/play) the media inline — the "download" tap. */
  onReveal: () => void;
}

const LABEL: Record<Kind, string> = { image: 'Photo', video: 'Video', audio: 'Voice message' };
const ICON: Record<Kind, typeof ImageIcon> = { image: ImageIcon, video: Video, audio: Mic };

/**
 * WhatsApp-style placeholder for an incoming media message: nothing is shown
 * until the recipient taps download. Purely local — no network request is made
 * until the user actually reveals the media, so long media-heavy chats stay
 * instant to render.
 */
export function MediaDownloadTile({ kind, mine, onReveal }: Props) {
  const Icon = ICON[kind];
  const meta = (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icon className="h-3.5 w-3.5" />
      {LABEL[kind]}
    </span>
  );

  if (kind === 'audio') {
    return (
      <button
        type="button"
        onClick={onReveal}
        className={cn(
          'mb-1 flex w-56 max-w-full items-center gap-3 rounded-lg p-2 text-left',
          mine ? 'bg-brand-700/40' : 'bg-slate-100 dark:bg-slate-700',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white">
          <Download className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">{meta}</span>
      </button>
    );
  }

  // Photo / video: a neutral frosted tile with a download button in the middle.
  return (
    <button
      type="button"
      onClick={onReveal}
      aria-label={`Download ${LABEL[kind]}`}
      className="relative -mx-2.5 -mt-1.5 mb-1.5 flex aspect-[4/3] w-[calc(min(75vw,18rem)_+_1.25rem)] max-w-[calc(100%_+_1.25rem)] items-center justify-center overflow-hidden rounded-2xl"
    >
      {/* Frosted, content-free backdrop — no real bytes loaded. */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-300/70 to-slate-400/60 backdrop-blur-xl dark:from-slate-700/70 dark:to-slate-800/70" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/30">
        <Download className="h-6 w-6" />
      </span>
      <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-white">
        {meta}
      </span>
    </button>
  );
}
