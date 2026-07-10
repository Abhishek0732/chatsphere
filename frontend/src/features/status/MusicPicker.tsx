import { useEffect, useMemo, useRef, useState } from 'react';
import { Music2, Pause, Play, Search, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { mediaSrc } from '@/utils/media';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';
import { MUSIC_LIBRARY, type LibraryTrack, type MusicSelection } from './musicLibrary';
import { useResetOnClose } from '@/hooks/useResetOnClose';

function fmt(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Read an audio file's duration locally, without uploading. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : 0);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    a.src = url;
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (sel: MusicSelection) => void;
}

export function MusicPicker({ open, onClose, onSelect }: Props) {
  const [tab, setTab] = useState<'library' | 'device'>('library');
  const [query, setQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  useResetOnClose(open, () => {
    setQuery('');
    setTab('library');
    setPlayingId(null);
  });
  // One shared <audio> for previews — never one element per row.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const stopPreview = () => {
    audioRef.current?.pause();
    setPlayingId(null);
  };

  // Tear down the preview whenever the sheet closes or unmounts.
  useEffect(() => {
    if (!open) stopPreview();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MUSIC_LIBRARY;
    return MUSIC_LIBRARY.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q),
    );
  }, [query]);

  const preview = (t: LibraryTrack) => {
    if (playingId === t.id) return stopPreview();
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.src = mediaSrc(t.url);
    a.currentTime = 0;
    a.onended = () => setPlayingId(null);
    void a.play().catch(() => {});
    setPlayingId(t.id);
  };

  const choose = (sel: MusicSelection) => {
    stopPreview();
    onSelect(sel);
    onClose();
  };

  const pickFromLibrary = (t: LibraryTrack) =>
    choose({ url: t.url, title: t.title, artist: t.artist, durationMs: t.durationMs });

  const pickFromDevice = async (file?: File) => {
    if (!file) return;
    const err = uploadSizeError(file);
    if (err) return toast({ title: err, variant: 'error' });
    setUploading(true);
    try {
      const [res, durationMs] = await Promise.all([uploadMedia(file), readDuration(file)]);
      const title = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'My audio';
      choose({ url: res.url, title, artist: 'From device', durationMs });
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add music">
      <div className="space-y-3">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['library', 'device'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition',
                tab === t
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {t === 'library' ? <Music2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {t === 'library' ? 'Library' : 'My device'}
            </button>
          ))}
        </div>

        {tab === 'library' ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, artists, moods…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <ul className="max-h-[46vh] space-y-1 overflow-y-auto scrollbar-thin pr-1">
              {filtered.map((t) => {
                const isPlaying = playingId === t.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => pickFromLibrary(t)}
                      className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {/* Cover + play/pause overlay */}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          preview(t);
                        }}
                        className={cn(
                          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-lg shadow-sm',
                          t.cover,
                        )}
                      >
                        <span className={cn('transition', isPlaying && 'opacity-0')}>{t.emoji}</span>
                        <span
                          className={cn(
                            'absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-white transition',
                            isPlaying
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100',
                          )}
                        >
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {t.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {t.artist} · {t.genre}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">
                        {fmt(t.durationMs)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="py-8 text-center text-sm text-slate-400">No tracks found.</li>
              )}
            </ul>
          </>
        ) : (
          <div className="py-4">
            <input
              ref={fileInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => pickFromDevice(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-60 dark:border-slate-600"
            >
              {uploading ? (
                <Spinner className="h-6 w-6" />
              ) : (
                <>
                  <Upload className="h-7 w-7" />
                  <span className="text-sm font-medium">Choose audio from device</span>
                  <span className="text-xs text-slate-400">MP3, M4A, WAV…</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export { fmt as formatTrackDuration };
