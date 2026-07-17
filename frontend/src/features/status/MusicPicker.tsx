import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Music2, Pause, Play, Search, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { SkeletonList } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { mediaSrc } from '@/utils/media';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { getMusicCategories, searchMusic, type CatalogTrack } from '@/api/music';
import { toast } from '@/store/toastStore';
import { useDebounce } from '@/hooks/useDebounce';
import { MUSIC_LIBRARY, type MusicSelection } from './musicLibrary';
import { useResetOnClose } from '@/hooks/useResetOnClose';

function fmt(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** How long a status plays music for — the scrub window. Matches the viewer cap. */
const WINDOW_MS = 30_000;

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

/** The bundled loops, shaped like catalogue tracks — used when the catalogue
 *  is unreachable (offline / upstream down) so the picker is never empty. */
const OFFLINE_TRACKS: CatalogTrack[] = MUSIC_LIBRARY.map((t) => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  genre: t.genre,
  artworkUrl: '',
  previewUrl: t.url,
  durationMs: t.durationMs,
}));

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (sel: MusicSelection) => void;
}

export function MusicPicker({ open, onClose, onSelect }: Props) {
  const [tab, setTab] = useState<'catalog' | 'device'>('catalog');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Trending');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // When set, we're on the trim step for this chosen track (scrub to a segment).
  const [trimming, setTrimming] = useState<MusicSelection | null>(null);
  const debouncedQuery = useDebounce(query, 350);

  useResetOnClose(open, () => {
    setQuery('');
    setCategory('Trending');
    setTab('catalog');
    setPlayingId(null);
    setTrimming(null);
  });

  // One shared <audio> for previews — never one element per row.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: categories } = useQuery({
    queryKey: ['music', 'categories'],
    queryFn: getMusicCategories,
    enabled: open,
    staleTime: Infinity,
  });

  // Searching overrides the category shelf, as in Instagram.
  const searching = debouncedQuery.trim().length > 0;
  const { data: tracks, isLoading } = useQuery({
    queryKey: ['music', 'search', searching ? debouncedQuery.trim() : `cat:${category}`],
    queryFn: () =>
      searchMusic(searching ? { q: debouncedQuery.trim() } : { category, limit: 25 }),
    enabled: open && tab === 'catalog',
    staleTime: 10 * 60 * 1000,
  });

  // If the catalogue is unreachable, don't show an empty sheet.
  const offline = !isLoading && (tracks?.length ?? 0) === 0 && !searching;
  const list = offline ? OFFLINE_TRACKS : (tracks ?? []);

  const stopPreview = () => {
    audioRef.current?.pause();
    setPlayingId(null);
  };

  useEffect(() => {
    if (!open) stopPreview();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [open]);

  // Changing shelf/search shouldn't leave the old clip playing.
  useEffect(() => {
    stopPreview();
  }, [category, debouncedQuery]);

  const preview = (t: CatalogTrack) => {
    if (playingId === t.id) return stopPreview();
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.src = mediaSrc(t.previewUrl);
    a.currentTime = 0;
    a.onended = () => setPlayingId(null);
    void a.play().catch(() => toast({ title: 'Could not play this track', variant: 'error' }));
    setPlayingId(t.id);
  };

  const choose = (sel: MusicSelection) => {
    stopPreview();
    onSelect(sel);
    onClose();
  };

  // A track long enough to scrub goes to the trim step; a short clip (a ~30s
  // catalogue preview) is already the whole window, so use it straight away.
  const beginTrim = (sel: MusicSelection) => {
    stopPreview();
    if ((sel.durationMs || 0) > WINDOW_MS + 1000) {
      setTrimming(sel);
    } else {
      choose({ ...sel, startMs: 0 });
    }
  };

  const pickTrack = (t: CatalogTrack) =>
    beginTrim({
      url: t.previewUrl,
      title: t.title,
      artist: t.artist,
      durationMs: t.durationMs,
    });

  const pickFromDevice = async (file?: File) => {
    if (!file) return;
    const err = uploadSizeError(file);
    if (err) return toast({ title: err, variant: 'error' });
    setUploading(true);
    try {
      const [res, durationMs] = await Promise.all([uploadMedia(file), readDuration(file)]);
      const title = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'My audio';
      beginTrim({ url: res.url, title, artist: 'From device', durationMs });
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  if (trimming) {
    return (
      <Modal open={open} onClose={onClose} title="Trim music">
        <TrimView
          selection={trimming}
          onBack={() => setTrimming(null)}
          onConfirm={(startMs) => choose({ ...trimming, startMs })}
        />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Add music">
      <div className="space-y-3">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['catalog', 'device'] as const).map((t) => (
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
              {t === 'catalog' ? <Music2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {t === 'catalog' ? 'Music' : 'My device'}
            </button>
          ))}
        </div>

        {tab === 'catalog' ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs and artists…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Browse shelves — hidden while searching, as in Instagram. */}
            {!searching && (categories ?? []).length > 0 && (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
                {(categories ?? []).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition',
                      c === category
                        ? 'bg-brand-gradient text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {offline && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                Couldn’t reach the music catalogue — showing the built-in tracks.
              </p>
            )}

            {isLoading ? (
              <SkeletonList rows={6} />
            ) : (
              <ul className="max-h-[46vh] space-y-1 overflow-y-auto scrollbar-thin pr-1">
                {list.map((t) => {
                  const isPlaying = playingId === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => pickTrack(t)}
                        className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {/* Cover art + play/pause overlay. Tapping the art plays
                            the clip; tapping the row picks the song. */}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            preview(t);
                          }}
                          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm"
                        >
                          {t.artworkUrl ? (
                            <img
                              src={t.artworkUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Music2 className="h-5 w-5 text-white" />
                          )}
                          <span
                            className={cn(
                              'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition',
                              isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
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
                            {t.artist}
                            {t.genre ? ` · ${t.genre}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          {fmt(t.durationMs)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {list.length === 0 && (
                  <li className="py-8 text-center text-sm text-slate-400">
                    No songs found for “{debouncedQuery}”.
                  </li>
                )}
              </ul>
            )}
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

/**
 * Scrub a longer track to the segment the status should play. The bar shows the
 * whole song with the chosen window highlighted; drag the slider to move it, and
 * preview loops that window so you hear exactly what viewers will.
 */
function TrimView({
  selection,
  onBack,
  onConfirm,
}: {
  selection: MusicSelection;
  onBack: () => void;
  onConfirm: (startMs: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(selection.durationMs || 0);
  const [start, setStart] = useState(0);
  const [playing, setPlaying] = useState(false);

  const window = Math.min(WINDOW_MS, duration || WINDOW_MS);
  const maxStart = Math.max(0, duration - window);

  // The timeupdate handler runs off stale closures otherwise; read live via refs.
  const startRef = useRef(0);
  const windowRef = useRef(window);
  startRef.current = start;
  windowRef.current = window;

  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;
    a.preload = 'metadata';
    a.src = mediaSrc(selection.url);
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setDuration(Math.round(a.duration * 1000));
      }
    };
    const onTime = () => {
      // Loop within the chosen window so the preview never runs past it.
      if (a.currentTime * 1000 >= startRef.current + windowRef.current) {
        a.currentTime = startRef.current / 1000;
      }
    };
    const onEnded = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnded);
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    a.currentTime = start / 1000;
    void a
      .play()
      .then(() => setPlaying(true))
      .catch(() => toast({ title: 'Could not play this track', variant: 'error' }));
  };

  const onScrub = (v: number) => {
    setStart(v);
    const a = audioRef.current;
    if (a) a.currentTime = v / 1000;
  };

  const leftPct = duration > 0 ? (start / duration) * 100 : 0;
  const widthPct = duration > 0 ? (window / duration) * 100 : 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white">
          <Music2 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {selection.title}
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {selection.artist}
          </span>
        </span>
        <button
          onClick={toggle}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Drag to choose the part that plays ({Math.round(window / 1000)}s)
      </p>

      {/* Track bar with the chosen window highlighted. */}
      <div className="relative h-12 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        <div
          className="absolute inset-y-0 rounded-lg bg-brand-500/30 ring-2 ring-brand-500"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>

      {/* Scrubber: moves the start of the window. */}
      <input
        type="range"
        min={0}
        max={maxStart}
        step={250}
        value={start}
        onChange={(e) => onScrub(Number(e.target.value))}
        disabled={maxStart === 0}
        className="w-full accent-brand-500"
      />
      <div className="flex justify-between text-xs tabular-nums text-slate-500 dark:text-slate-400">
        <span>{fmt(start)}</span>
        <span>{fmt(start + window)}</span>
        <span>{fmt(duration)}</span>
      </div>

      <button
        onClick={() => onConfirm(start)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
      >
        <Check className="h-4 w-4" /> Use this part
      </button>
    </div>
  );
}
