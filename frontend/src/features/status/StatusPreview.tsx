import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Music2, Pencil, RotateCcw, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { mediaSrc } from '@/utils/media';
import { useAuthStore } from '@/store/authStore';
import type { MusicSelection } from './musicLibrary';

/** Must match StatusViewer, or the preview would lie about the timing. */
const IMAGE_MS = 5000;
const MUSIC_CAP_MS = 30000;

export interface StatusDraft {
  type: 'IMAGE' | 'VIDEO' | 'TEXT';
  mediaUrl?: string;
  caption?: string;
  bgColor?: string;
  music: MusicSelection | null;
}

/**
 * Shows the status exactly as viewers will see it — same layout, same progress
 * timing, and the chosen song actually playing — so you can judge it before
 * posting rather than after. Deliberately mirrors StatusViewer's rules: a
 * photo/text status runs for 5s, or for the length of the song (capped at 30s)
 * when one is attached; a video runs its own length with the music underneath.
 */
export function StatusPreview({
  draft,
  posting,
  onEdit,
  onPost,
}: {
  draft: StatusDraft;
  posting: boolean;
  onEdit: () => void;
  onPost: () => void;
}) {
  const me = useAuthStore((s) => s.user);
  const [progress, setProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [done, setDone] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef(0);
  // Song length (ms, capped) once the audio metadata resolves.
  const musicDurRef = useRef<number | null>(
    draft.music?.durationMs ? Math.min(draft.music.durationMs, MUSIC_CAP_MS) : null,
  );

  const hasMusic = Boolean(draft.music);

  // Drive the progress bar for photo/text; video reports its own progress.
  useEffect(() => {
    setProgress(0);
    setDone(false);
    progressRef.current = 0;
    if (draft.type === 'VIDEO') return;

    let raf = 0;
    let last: number | null = null;
    const step = (t: number) => {
      if (last == null) last = t;
      const dt = t - last;
      last = t;
      const durationMs = hasMusic ? (musicDurRef.current ?? MUSIC_CAP_MS) : IMAGE_MS;
      progressRef.current += dt / durationMs;
      if (progressRef.current >= 1) {
        setProgress(1);
        setDone(true); // hold on the last frame; the user replays if they want
        return;
      }
      setProgress(progressRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [draft.type, hasMusic, replayKey]);

  const replay = () => {
    setReplayKey((k) => k + 1);
    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
      void a.play().catch(() => {});
    }
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-black">
      {/* Progress bar — the real one viewers will see. */}
      <div className="flex gap-1 px-3 pt-3">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar name={me?.displayName ?? '?'} src={me?.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">My status</p>
          <p className="text-xs text-white/60">Preview · only you can see this</p>
        </div>
        {hasMusic && <Music2 className="h-4 w-4 animate-pulse text-white/80" />}
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={draft.type === 'TEXT' ? { backgroundImage: draft.bgColor } : undefined}
      >
        {draft.type === 'IMAGE' && draft.mediaUrl && (
          <img
            src={mediaSrc(draft.mediaUrl)}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        )}
        {draft.type === 'VIDEO' && draft.mediaUrl && (
          <video
            key={`v-${replayKey}`}
            ref={videoRef}
            src={mediaSrc(draft.mediaUrl)}
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={() => setDone(true)}
          />
        )}
        {draft.type === 'TEXT' && (
          <p className="max-w-lg px-8 text-center text-2xl font-semibold leading-snug text-white">
            {draft.caption}
          </p>
        )}

        {done && (
          <button
            onClick={replay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 text-white transition hover:bg-black/40"
          >
            <span className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur">
              <RotateCcw className="h-4 w-4" /> Replay
            </span>
          </button>
        )}
      </div>

      <div className="px-4 pb-6 pt-3">
        {draft.type !== 'TEXT' && draft.caption && (
          <p className="mb-3 text-center text-sm text-white">{draft.caption}</p>
        )}
        {draft.music && (
          <div className="mx-auto mb-4 flex max-w-[80%] items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur">
            <Music2 className="h-3.5 w-3.5 shrink-0 animate-pulse" />
            <span className="truncate">
              <span className="font-medium">{draft.music.title}</span>
              <span className="text-white/70"> · {draft.music.artist}</span>
            </span>
          </div>
        )}

        <div className="mx-auto flex max-w-lg gap-2">
          <Button variant="secondary" className="flex-1" onClick={onEdit} disabled={posting}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Button>
          <Button className="flex-1" onClick={onPost} loading={posting}>
            <Send className="mr-1.5 h-4 w-4" /> Post status
          </Button>
        </div>
      </div>

      {/* The actual song, playing — the whole point of previewing. */}
      {draft.music && (
        <audio
          key={`a-${replayKey}`}
          ref={audioRef}
          src={mediaSrc(draft.music.url)}
          autoPlay
          loop={draft.type === 'VIDEO'}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            musicDurRef.current = Number.isFinite(d)
              ? Math.min(d * 1000, MUSIC_CAP_MS)
              : MUSIC_CAP_MS;
          }}
        />
      )}
    </div>,
    document.body,
  );
}
