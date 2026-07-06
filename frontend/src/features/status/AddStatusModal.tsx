import { useRef, useState } from 'react';
import { Image as ImageIcon, Music2, Type, Video, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';
import { mediaSrc } from '@/utils/media';
import { useCreateStatus } from '@/hooks/useStatus';

const TEXT_BGS = [
  'linear-gradient(135deg,#8b7cff,#5b8def)',
  'linear-gradient(135deg,#f43f5e,#ec4899)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#f59e0b,#fb923c)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#111827,#374151)',
];

interface Media {
  url: string;
  type: 'IMAGE' | 'VIDEO';
}

export function AddStatusModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateStatus();
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [media, setMedia] = useState<Media | null>(null);
  const [caption, setCaption] = useState('');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(TEXT_BGS[0]);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicName, setMusicName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mediaInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMedia(null);
    setCaption('');
    setText('');
    setMusicUrl(null);
    setMusicName(null);
    setMode('media');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickMedia = async (file?: File) => {
    if (!file) return;
    const err = uploadSizeError(file);
    if (err) return toast({ title: err, variant: 'error' });
    setUploading(true);
    try {
      const res = await uploadMedia(file);
      setMedia({ url: res.url, type: res.contentType.startsWith('video/') ? 'VIDEO' : 'IMAGE' });
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (mediaInput.current) mediaInput.current.value = '';
    }
  };

  const pickMusic = async (file?: File) => {
    if (!file) return;
    const err = uploadSizeError(file);
    if (err) return toast({ title: err, variant: 'error' });
    setUploading(true);
    try {
      const res = await uploadMedia(file);
      setMusicUrl(res.url);
      setMusicName(res.fileName);
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (musicInput.current) musicInput.current.value = '';
    }
  };

  const post = () => {
    const payload =
      mode === 'text'
        ? { type: 'TEXT' as const, caption: text.trim(), bgColor: bg, musicUrl: musicUrl ?? undefined }
        : media
          ? {
              type: media.type,
              mediaUrl: media.url,
              caption: caption.trim() || undefined,
              musicUrl: musicUrl ?? undefined,
            }
          : null;
    if (!payload) return;
    if (mode === 'text' && !text.trim()) return;
    create.mutate(payload, { onSuccess: close });
  };

  const canPost = mode === 'text' ? text.trim().length > 0 : !!media;

  return (
    <Modal open={open} onClose={close} title="Add to status">
      <div className="space-y-4">
        {/* Mode switch */}
        <div className="flex gap-2">
          {(['media', 'text'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition',
                mode === m
                  ? 'bg-brand-gradient text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {m === 'media' ? <ImageIcon className="h-4 w-4" /> : <Type className="h-4 w-4" />}
              {m === 'media' ? 'Photo / Video' : 'Text'}
            </button>
          ))}
        </div>

        {/* Hidden pickers */}
        <input
          ref={mediaInput}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => pickMedia(e.target.files?.[0])}
        />
        <input
          ref={musicInput}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => pickMusic(e.target.files?.[0])}
        />

        {mode === 'media' ? (
          media ? (
            <div className="relative overflow-hidden rounded-2xl bg-black">
              {media.type === 'IMAGE' ? (
                <img src={mediaSrc(media.url)} alt="" className="max-h-72 w-full object-contain" />
              ) : (
                <video src={mediaSrc(media.url)} controls className="max-h-72 w-full" />
              )}
              <button
                onClick={() => setMedia(null)}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => mediaInput.current?.click()}
              disabled={uploading}
              className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-500 hover:text-brand-500 dark:border-slate-600"
            >
              {uploading ? (
                <Spinner className="h-6 w-6" />
              ) : (
                <>
                  <div className="flex gap-3">
                    <ImageIcon className="h-7 w-7" />
                    <Video className="h-7 w-7" />
                  </div>
                  <span className="text-sm font-medium">Choose a photo or video</span>
                </>
              )}
            </button>
          )
        ) : (
          <div>
            <div
              className="flex min-h-44 items-center justify-center rounded-2xl p-5"
              style={{ backgroundImage: bg }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a status…"
                rows={3}
                className="w-full resize-none bg-transparent text-center text-lg font-semibold text-white placeholder:text-white/70 focus:outline-none"
              />
            </div>
            <div className="mt-3 flex gap-2">
              {TEXT_BGS.map((g) => (
                <button
                  key={g}
                  onClick={() => setBg(g)}
                  style={{ backgroundImage: g }}
                  className={cn(
                    'h-7 w-7 rounded-full ring-2 ring-offset-2 transition ring-offset-white dark:ring-offset-slate-900',
                    bg === g ? 'ring-slate-900 dark:ring-white' : 'ring-transparent',
                  )}
                  aria-label="Background"
                />
              ))}
            </div>
          </div>
        )}

        {/* Caption (media only) */}
        {mode === 'media' && media && (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        )}

        {/* Music */}
        {musicUrl ? (
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
            <Music2 className="h-4 w-4 shrink-0 text-brand-500" />
            <span className="min-w-0 flex-1 truncate">{musicName}</span>
            <button
              onClick={() => {
                setMusicUrl(null);
                setMusicName(null);
              }}
              className="rounded p-1 text-slate-400 hover:text-red-500"
              aria-label="Remove music"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => musicInput.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Music2 className="h-4 w-4" /> Add music
          </button>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={post} disabled={!canPost || uploading} loading={create.isPending}>
            Post status
          </Button>
        </div>
      </div>
    </Modal>
  );
}
