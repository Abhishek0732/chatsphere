import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Music2, Repeat2, Send, Trash2, X } from 'lucide-react';
import { queryKeys } from '@/api/queryKeys';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { mediaSrc } from '@/utils/media';
import { formatListTimestamp } from '@/utils/format';
import {
  useAddStatusToMine,
  useMarkStatusViewed,
  useDeleteStatus,
  useReplyToStatus,
  useStatusViewers,
} from '@/hooks/useStatus';
import { StatusText } from './StatusText';
import { StatusCollage } from './StatusCollage';
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
  // Statuses added to mine during this viewing. `users` is a snapshot, so the
  // server's canAdd flag won't change under us — this hides the button straight
  // away instead of waiting for the feed to refetch on close.
  const [added, setAdded] = useState<Set<number>>(new Set());

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
  const addToMine = useAddStatusToMine();
  const qc = useQueryClient();

  // Reconcile the feed with the server once, when the viewer unmounts — instead
  // of refetching on every item advance.
  useEffect(() => {
    return () => {
      void qc.invalidateQueries({ queryKey: queryKeys.status });
    };
  }, [qc]);

  const user = users[userIndex];
  const item = user?.items[itemIndex];
  // The frame's media as a list: the album if the server sent one, else the single
  // mediaUrl. Empty for a text status.
  const album = useMemo(() => {
    if (!item) return [];
    if (item.media && item.media.length > 0) return item.media;
    return item.mediaUrl ? [{ url: item.mediaUrl, type: item.type as 'IMAGE' | 'VIDEO' }] : [];
  }, [item]);
  // Several photos/videos in one frame render as a collage (all at once), not a
  // carousel — so the whole set is a single tap-through-able story frame.
  const isCollage = album.length > 1;
  const mentionNames = useMemo(
    () => (item?.mentions ?? []).map((m) => m.displayName),
    [item?.mentions],
  );

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

  // Mark the frame seen once, when it's first shown — not again per album slide.
  useEffect(() => {
    if (!item) return;
    if (!user.me && !item.viewed) markViewed.mutate(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIndex, itemIndex]);

  // Drive the progress bar for a photo/text/collage frame (a single video reports
  // its own progress). A collage shows every photo at once, so it's one timed frame.
  useEffect(() => {
    if (!item) return;
    setProgress(0);
    progressRef.current = 0;
    // Prefer the duration stored with the status (library/device track) so the
    // timeline is right from frame one; fall back to the audio metadata below.
    // A scrubbed segment starts partway in, so the remaining length is what plays.
    musicDurRef.current =
      item.musicUrl && item.musicDurationMs
        ? Math.min(item.musicDurationMs - (item.musicStartMs ?? 0), MUSIC_CAP_MS)
        : null;
    if (!isCollage && item.type === 'VIDEO') return; // the video drives its own progress

    // A collage holds more to look at, so give it a little longer than a single
    // photo — scaled by how many tiles it has, capped so it never drags.
    const collageMs = Math.min(IMAGE_MS + (album.length - 1) * 1500, 20000);

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
      // With music, the song sets the timeline (≤30s); otherwise 5s for a single
      // photo/text, or the scaled duration for a collage.
      const durationMs = item.musicUrl
        ? musicDurRef.current ?? MUSIC_CAP_MS
        : isCollage
          ? collageMs
          : IMAGE_MS;
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
      {/* Progress segments — one per status frame. A collage (multiple photos in
          one frame) is a single frame, so it's still one segment. */}
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
          {/* Song shows right under the name — the way modern messengers surface it. */}
          {item.musicUrl && item.musicTitle && (
            <p className="flex items-center gap-1 truncate text-xs text-white/90">
              <Music2 className="h-3 w-3 shrink-0 animate-pulse" />
              <span className="truncate">
                {item.musicTitle}
                {item.musicArtist && <span className="text-white/60"> · {item.musicArtist}</span>}
              </span>
            </p>
          )}
          <p className="text-xs text-white/60">{formatListTimestamp(item.createdAt)}</p>
        </div>
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
        {/* Multiple photos/videos → a collage, all shown together in this frame. */}
        {isCollage ? (
          <div className="w-full px-3">
            <StatusCollage media={album} />
          </div>
        ) : item.type === 'IMAGE' ? (
          <img src={mediaSrc(item.mediaUrl)} alt="" className="max-h-full max-w-full object-contain" />
        ) : item.type === 'VIDEO' ? (
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
        ) : (
          <p className="max-w-lg px-8 text-center text-2xl font-semibold leading-snug text-white">
            <StatusText text={item.caption ?? ''} names={mentionNames} />
          </p>
        )}
      </div>

      {/* Caption + seen-by / reply bar */}
      <div className="px-4 pb-6 pt-3">
        {item.type !== 'TEXT' && item.caption && (
          <p className="mb-3 text-center text-sm text-white">
            <StatusText text={item.caption} names={mentionNames} />
          </p>
        )}
        {/* A status someone added from another person's keeps the credit visible. */}
        {item.originalUser && (
          <div className="mx-auto mb-3 flex max-w-[80%] items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur">
            <Repeat2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              From <span className="font-medium">{item.originalUser.displayName}</span>’s status
            </span>
          </div>
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
            {/* Tagged in this status? Then you can put it on your own, like modern messengers. */}
            {item.canAdd && !added.has(item.id) && (
              <button
                onClick={() =>
                  addToMine.mutate(item.id, {
                    onSuccess: () => setAdded((s) => new Set(s).add(item.id)),
                  })
                }
                disabled={addToMine.isPending}
                className="mx-auto mb-3 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90 disabled:opacity-60"
              >
                <Repeat2 className="h-4 w-4" />
                {addToMine.isPending ? 'Adding…' : 'Add to my status'}
              </button>
            )}
            {/* Quick emoji reactions (messenger-style). */}
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
          onLoadedMetadata={(e) => {
            const a = e.currentTarget;
            const startMs = item.musicStartMs ?? 0;
            // Begin at the scrubbed offset the poster chose.
            if (startMs > 0 && Number.isFinite(a.duration)) a.currentTime = startMs / 1000;
            const d = a.duration;
            musicDurRef.current = Number.isFinite(d)
              ? Math.min(d * 1000 - startMs, MUSIC_CAP_MS)
              : MUSIC_CAP_MS;
          }}
          onTimeUpdate={(e) => {
            // Keep looping within the chosen [start, start+window] segment (for a
            // video/collage the music plays underneath and would otherwise drift
            // back to 0 on loop).
            const a = e.currentTarget;
            const startMs = item.musicStartMs ?? 0;
            const windowMs = Math.min(
              (Number.isFinite(a.duration) ? a.duration * 1000 : MUSIC_CAP_MS) - startMs,
              MUSIC_CAP_MS,
            );
            if ((item.type === 'VIDEO' || isCollage) && a.currentTime * 1000 >= startMs + windowMs) {
              a.currentTime = startMs / 1000;
            }
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
