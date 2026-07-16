import { useMemo, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, Music2, Type, Video, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';
import { mediaSrc } from '@/utils/media';
import { useCreateStatus } from '@/hooks/useStatus';
import { useContacts } from '@/hooks/useContacts';
import { MentionField, mentionsIn } from '@/components/ui/MentionField';
import { MusicPicker } from './MusicPicker';
import { StatusPreview, type StatusDraft } from './StatusPreview';
import type { MusicSelection } from './musicLibrary';

const TEXT_BGS = [
  'linear-gradient(135deg,#8b7cff,#5b8def)',
  'linear-gradient(135deg,#f43f5e,#ec4899)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#f59e0b,#fb923c)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#111a2b,#374151)',
];

interface Media {
  url: string;
  type: 'IMAGE' | 'VIDEO';
}

export function AddStatusModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateStatus();
  const { data: contacts } = useContacts();
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [media, setMedia] = useState<Media | null>(null);
  const [caption, setCaption] = useState('');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(TEXT_BGS[0]);
  const [music, setMusic] = useState<MusicSelection | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mediaInput = useRef<HTMLInputElement>(null);

  // @mentions: you can tag your contacts in a status, as in Instagram and modern messengers.
  // The map remembers what each inserted "@Name" tags, so a mention the user
  // deletes from the text is dropped on post.
  const tagged = useRef<Map<string, number>>(new Map());
  const people = useMemo(() => (contacts ?? []).map((c) => c.user), [contacts]);

  const reset = () => {
    setMedia(null);
    setCaption('');
    setText('');
    setMusic(null);
    setPreviewOpen(false);
    setMode('media');
    tagged.current.clear();
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

  const musicFields = music
    ? {
        musicUrl: music.url,
        musicTitle: music.title,
        musicArtist: music.artist,
        musicDurationMs: music.durationMs || undefined,
      }
    : {};

  const post = () => {
    // Only tags still present in the posted text count.
    const ids = mentionsIn(body, tagged.current);
    const mentions = ids.length > 0 ? ids : undefined;

    const payload =
      mode === 'text'
        ? { type: 'TEXT' as const, caption: body, bgColor: bg, mentions, ...musicFields }
        : media
          ? {
              type: media.type,
              mediaUrl: media.url,
              caption: body || undefined,
              mentions,
              ...musicFields,
            }
          : null;
    if (!payload) return;
    if (mode === 'text' && !text.trim()) return;
    create.mutate(payload, { onSuccess: close });
  };

  const canPost = mode === 'text' ? text.trim().length > 0 : !!media;

  // What the preview renders — the same values that get posted.
  const body = mode === 'text' ? text.trim() : caption.trim();
  const mentionNames = people
    .filter((p) => body.includes(`@${p.displayName}`))
    .map((p) => p.displayName);
  const draft: StatusDraft =
    mode === 'text'
      ? { type: 'TEXT', caption: body, bgColor: bg, music, mentionNames }
      : {
          type: media?.type ?? 'IMAGE',
          mediaUrl: media?.url,
          caption: body || undefined,
          music,
          mentionNames,
        };

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
              <MentionField
                multiline
                value={text}
                onChange={setText}
                people={people}
                tagged={tagged}
                placeholder="Type a status… use @ to mention"
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
          <MentionField
            value={caption}
            onChange={setCaption}
            people={people}
            tagged={tagged}
            placeholder="Add a caption… use @ to mention"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        )}

        {/* Music */}
        {music ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white">
              <Music2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{music.title}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {music.artist}
              </span>
            </span>
            <button
              onClick={() => setMusic(null)}
              className="rounded p-1 text-slate-400 hover:text-red-500"
              aria-label="Remove music"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMusicOpen(true)}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Music2 className="h-4 w-4" /> Add music
          </button>
        )}

        <MusicPicker open={musicOpen} onClose={() => setMusicOpen(false)} onSelect={setMusic} />

        {/* With a song attached, Preview is the primary action — you can't tell
            whether a track works from its title alone, so play it first. */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          {music ? (
            <>
              <Button
                variant="secondary"
                onClick={post}
                disabled={!canPost || uploading}
                loading={create.isPending}
              >
                Post
              </Button>
              <Button onClick={() => setPreviewOpen(true)} disabled={!canPost || uploading}>
                <Eye className="mr-1.5 h-4 w-4" /> Preview
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setPreviewOpen(true)}
                disabled={!canPost || uploading}
              >
                <Eye className="mr-1.5 h-4 w-4" /> Preview
              </Button>
              <Button onClick={post} disabled={!canPost || uploading} loading={create.isPending}>
                Post status
              </Button>
            </>
          )}
        </div>
      </div>

      {previewOpen && canPost && (
        <StatusPreview
          draft={draft}
          posting={create.isPending}
          onEdit={() => setPreviewOpen(false)}
          onPost={post}
        />
      )}
    </Modal>
  );
}
