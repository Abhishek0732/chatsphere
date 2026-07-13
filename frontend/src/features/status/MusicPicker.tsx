import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Music2, Pause, Play, Search, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
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
  const debouncedQuery = useDebounce(query, 350);

  useResetOnClose(open, () => {
    setQuery('');
    setCategory('Trending');
    setTab('catalog');
    setPlayingId(null);
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

  const pickTrack = (t: CatalogTrack) =>
    choose({
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
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
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
