import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Music2, Send, Trash2, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { mediaSrc } from '@/utils/media';
import { formatListTimestamp } from '@/utils/format';
import {
  useMarkStatusViewed,
  useDeleteStatus,
  useReplyToStatus,
  useStatusViewers,
} from '@/hooks/useStatus';
import type { StatusUser } from '@/types';

const IMAGE_MS = 5000;
// A photo/text status with music stays on screen for the length of the song,
// capped at 30s so a long track can't hold the story indefinitely.
const MUSIC_CAP_MS = 30000;
const REPLY_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

interface Props {
  users: StatusUser[];
  startUserIndex: number;
  onClose: () => void;
}

export function StatusViewer({ users: incoming, startUserIndex, onClose }: Props) {
  // Snapshot so a background feed refetch (from marking views) can't reorder
  // the story we're in the middle of watching.
  const [users] = useState(incoming);
  const [userIndex, setUserIndex] = useState(startUserIndex);
  const [itemIndex, setItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);

  const pausedRef = useRef(false);
  const holdRef = useRef(false);
  const progressRef = useRef(0);
  // Duration (ms) a photo/text-with-music status should run: the song length
  // clamped to MUSIC_CAP_MS, resolved once the audio metadata loads.
  const musicDurRef = useRef<number | null>(null);
  const downAt = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const markViewed = useMarkStatusViewed();
  const deleteStatus = useDeleteStatus();
  const replyToStatus = useReplyToStatus();

  const user = users[userIndex];
  const item = user?.items[itemIndex];

  const { data: viewers } = useStatusViewers(
    item?.id ?? null,
    Boolean(showViewers && user?.me && item),
  );

  const advance = () => {
    setShowViewers(false);
    if (item && itemIndex < user.items.length - 1) {
      setItemIndex((i) => i + 1);
    } else if (userIndex < users.length - 1) {
      setUserIndex((u) => u + 1);
      setItemIndex(0);
    } else {
      onClose();
    }
  };

  const prev = () => {
    setShowViewers(false);
    if (itemIndex > 0) {
      setItemIndex((i) => i - 1);
    } else if (userIndex > 0) {
      const pu = userIndex - 1;
      setUserIndex(pu);
      setItemIndex(users[pu].items.length - 1);
    }
  };

  // Drive progress for image/text; mark viewed on show.
  useEffect(() => {
    if (!item) return;
    setProgress(0);
    progressRef.current = 0;
    musicDurRef.current = null; // re-resolved from this item's audio metadata
    if (!user.me && !item.viewed) markViewed.mutate(item.id);
    if (item.type === 'VIDEO') return; // video drives its own progress

    let raf = 0;
    let last: number | null = null;
    const step = (t: number) => {
      if (pausedRef.current) {
        last = t;
        raf = requestAnimationFrame(step);
        return;
      }
      if (last == null) last = t;
      const dt = t - last;
      last = t;
      // Photo/text: 5s, unless it has music — then follow the song (≤30s).
      // Before the song's length is known, assume the 30s cap.
      const durationMs = item.musicUrl ? musicDurRef.current ?? MUSIC_CAP_MS : IMAGE_MS;
      progressRef.current += dt / durationMs;
      if (progressRef.current >= 1) {
        setProgress(1);
        advance();
        return;
      }
      setProgress(progressRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIndex, itemIndex]);

  // Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Don't hijack the arrow keys while typing a reply.
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIndex, itemIndex]);

  // The story pauses while the user holds the screen, has the seen-by list open,
  // or is composing a reply — and resumes once all of those are cleared.
  const applyPause = () => {
    const p = holdRef.current || showViewers || replyFocused;
    pausedRef.current = p;
    if (videoRef.current) p ? videoRef.current.pause() : void videoRef.current.play().catch(() => {});
    if (audioRef.current) p ? audioRef.current.pause() : void audioRef.current.play().catch(() => {});
  };

  // Keep video/audio + the RAF timer in sync when the seen-by sheet or the reply
  // box toggles (opening the seen list stops the timer; closing resumes it).
  useEffect(() => {
    applyPause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showViewers, replyFocused]);

  const onDown = () => {
    downAt.current = Date.now();
    holdRef.current = true;
    applyPause();
  };
  const onUp = (e: React.PointerEvent) => {
    const held = Date.now() - downAt.current;
    holdRef.current = false;
    applyPause();
    if (held < 250) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.33) prev();
      else advance();
    }
  };

  const sendReply = (payload: { text?: string; emoji?: string }) => {
    if (!item) return;
    replyToStatus.mutate({ id: item.id, payload });
  };

  const onSubmitReply = () => {
    const text = replyText.trim();
    if (!text) return;
    sendReply({ text });
    setReplyText('');
  };

  if (!user || !item) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Progress segments */}
      <div className="flex gap-1 px-3 pt-3">
        {user.items.map((it, i) => (
          <div key={it.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${i < itemIndex ? 100 : i === itemIndex ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar name={user.user.displayName} src={user.user.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {user.me ? 'My status' : user.user.displayName}
          </p>
          <p className="text-xs text-white/60">{formatListTimestamp(item.createdAt)}</p>
        </div>
        {item.musicUrl && <Music2 className="h-4 w-4 animate-pulse text-white/80" />}
        {user.me && (
          <button
            onClick={() => deleteStatus.mutate(item.id, { onSuccess: advance })}
            className="rounded-full p-2 text-white/80 hover:bg-white/10"
            aria-label="Delete status"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-full p-2 text-white/80 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Media area (tap zones + hold-to-pause) */}
      <div
        className="relative flex flex-1 select-none items-center justify-center overflow-hidden"
        onPointerDown={onDown}
        onPointerUp={onUp}
        style={item.type === 'TEXT' ? { backgroundImage: item.bgColor ?? undefined } : undefined}
      >
        {item.type === 'IMAGE' && (
          <img src={mediaSrc(item.mediaUrl)} alt="" className="max-h-full max-w-full object-contain" />
        )}
        {item.type === 'VIDEO' && (
          <video
            key={item.id}
            ref={videoRef}
            src={mediaSrc(item.mediaUrl)}
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={advance}
          />
        )}
        {item.type === 'TEXT' && (
          <p className="max-w-lg px-8 text-center text-2xl font-semibold leading-snug text-white">
            {item.caption}
          </p>
        )}
      </div>

      {/* Caption + seen-by / reply bar */}
      <div className="px-4 pb-6 pt-3">
        {item.type !== 'TEXT' && item.caption && (
          <p className="mb-3 text-center text-sm text-white">{item.caption}</p>
        )}
        {user.me ? (
          <button
            onClick={() => setShowViewers(true)}
            className="mx-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/20"
          >
            <Eye className="h-4 w-4" />
            {item.viewCount > 0 ? `Seen by ${item.viewCount}` : 'No views yet'}
          </button>
        ) : (
          <div className="mx-auto w-full max-w-lg">
            {/* Quick emoji reactions (WhatsApp-style). */}
            <div className="mb-3 flex items-center justify-center gap-3">
              {REPLY_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => sendReply({ emoji: e })}
                  className="text-3xl transition-transform hover:scale-125 active:scale-95"
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {/* Reply composer. */}
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2 py-1.5 backdrop-blur">
              <input
                value={replyText}
                onChange={(ev) => setReplyText(ev.target.value)}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    ev.preventDefault();
                    onSubmitReply();
                  }
                }}
                placeholder={`Reply to ${user.user.displayName}…`}
                className="flex-1 bg-transparent px-3 text-sm text-white placeholder:text-white/50 focus:outline-none"
              />
              <button
                onClick={onSubmitReply}
                disabled={!replyText.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 disabled:opacity-40"
                aria-label="Send reply"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Background music. For a photo/text status the song sets the timeline
          (capped at 30s); for a video the music just loops underneath. */}
      {item.musicUrl && (
        <audio
          key={`m-${item.id}`}
          ref={audioRef}
          src={mediaSrc(item.musicUrl)}
          autoPlay
          loop={item.type === 'VIDEO'}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            musicDurRef.current = Number.isFinite(d)
              ? Math.min(d * 1000, MUSIC_CAP_MS)
              : MUSIC_CAP_MS;
          }}
        />
      )}

      {/* Viewers bottom sheet */}
      {showViewers && user.me && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end" onClick={() => setShowViewers(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="animate-slide-up relative max-h-[60vh] overflow-y-auto rounded-t-3xl bg-white p-4 scrollbar-thin dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4" /> Viewed by {item.viewCount}
            </p>
            {(viewers ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No views yet.</p>
            ) : (
              <ul className="space-y-1">
                {(viewers ?? []).map((v) => (
                  <li key={v.user.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                    <Avatar name={v.user.displayName} src={v.user.avatarUrl} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium">{v.user.displayName}</span>
                    <span className="text-xs text-slate-400">{formatListTimestamp(v.viewedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
