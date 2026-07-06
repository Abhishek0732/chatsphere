import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Music2, Trash2, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { mediaSrc } from '@/utils/media';
import { formatListTimestamp } from '@/utils/format';
import { useMarkStatusViewed, useDeleteStatus, useStatusViewers } from '@/hooks/useStatus';
import type { StatusUser } from '@/types';

const IMAGE_MS = 5000;

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

  const pausedRef = useRef(false);
  const progressRef = useRef(0);
  const downAt = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const markViewed = useMarkStatusViewed();
  const deleteStatus = useDeleteStatus();

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
      progressRef.current += dt / IMAGE_MS;
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
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIndex, itemIndex]);

  const setPaused = (p: boolean) => {
    pausedRef.current = p;
    if (videoRef.current) p ? videoRef.current.pause() : void videoRef.current.play().catch(() => {});
    if (audioRef.current) p ? audioRef.current.pause() : void audioRef.current.play().catch(() => {});
  };

  const onDown = () => {
    downAt.current = Date.now();
    setPaused(true);
  };
  const onUp = (e: React.PointerEvent) => {
    const held = Date.now() - downAt.current;
    setPaused(false);
    if (held < 250) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.33) prev();
      else advance();
    }
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

      {/* Caption + seen-by */}
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
        ) : null}
      </div>

      {/* Background music */}
      {item.musicUrl && (
        <audio key={`m-${item.id}`} ref={audioRef} src={mediaSrc(item.musicUrl)} autoPlay loop />
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
