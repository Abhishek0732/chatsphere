import { useMemo, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, Music2, Plus, Type, Video, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { uploadMedia, uploadSizeError, uploadErrorMessage } from '@/api/media';
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
  // A status can hold several photos/videos picked at once (one album frame);
  // picking a single file is just an album of one.
  const [media, setMedia] = useState<Media[]>([]);
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
    setMedia([]);
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

  /** How many photos/videos one status frame may hold — matches the server cap. */
  const MAX_MEDIA = 20;

  const pickMedia = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_MEDIA - media.length;
    if (room <= 0) {
      toast({ title: `Up to ${MAX_MEDIA} items per status`, variant: 'error' });
      if (mediaInput.current) mediaInput.current.value = '';
      return;
    }
    const chosen = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      // Upload in order so the album keeps the order they were picked in.
      for (const file of chosen) {
        const err = uploadSizeError(file);
        if (err) {
          toast({ title: `${file.name}: ${err}`, variant: 'error' });
          continue;
        }
        try {
          const res = await uploadMedia(file);
          setMedia((prev) => [
            ...prev,
            { url: res.url, type: res.contentType.startsWith('video/') ? 'VIDEO' : 'IMAGE' },
          ]);
        } catch (err) {
          toast({
            title: `${file.name}: upload failed`,
            description: uploadErrorMessage(err),
            variant: 'error',
          });
        }
      }
      if (files.length > room) {
        toast({ title: `Added ${room}; a status holds up to ${MAX_MEDIA}`, variant: 'info' });
      }
    } finally {
      setUploading(false);
      if (mediaInput.current) mediaInput.current.value = '';
    }
  };

  const removeMedia = (idx: number) => setMedia((prev) => prev.filter((_, i) => i !== idx));

  const musicFields = music
    ? {
        musicUrl: music.url,
        musicTitle: music.title,
        musicArtist: music.artist,
        musicDurationMs: music.durationMs || undefined,
        musicStartMs: music.startMs || undefined,
      }
    : {};

  const post = () => {
    // Only tags still present in the typed text count.
    const ids = mentionsIn(body, tagged.current);
    const mentions = ids.length > 0 ? ids : undefined;
    // A mention only TAGS the person (they get notified + the "add to my status"
    // button). The "@Name" is stripped from the caption so it isn't shown to
    // everyone — for a text status that leaves nothing, fall back to the raw text.
    const cleaned = stripTags(body);
    const textCaption = cleaned || body;

    const payload =
      mode === 'text'
        ? { type: 'TEXT' as const, caption: textCaption, bgColor: bg, mentions, ...musicFields }
        : media.length > 0
          ? {
              // The status's own type mirrors the first item; each album item
              // carries its own type in `media` so a mixed set renders right.
              type: media[0].type,
              mediaUrl: media[0].url,
              media,
              caption: cleaned || undefined,
              mentions,
              ...musicFields,
            }
          : null;
    if (!payload) return;
    if (mode === 'text' && !text.trim()) return;
    create.mutate(payload, { onSuccess: close });
  };

  const canPost = mode === 'text' ? text.trim().length > 0 : media.length > 0;

  // What the preview renders — the same values that get posted.
  const body = mode === 'text' ? text.trim() : caption.trim();
  const mentionNames = people
    .filter((p) => body.includes(`@${p.displayName}`))
    .map((p) => p.displayName);

  // Remove the "@Name" tag tokens from a caption: a mention tags the person, it
  // doesn't put their name in the text everyone sees. Longest token first so
  // "@John Doe" is stripped before a shorter "@John".
  const stripTags = (t: string): string => {
    let out = t;
    [...tagged.current.keys()]
      .sort((a, b) => b.length - a.length)
      .forEach((token) => {
        out = out.split(token).join('');
      });
    return out
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([,.!?…])/g, '$1')
      .trim();
  };
  // The caption viewers actually see (no @tags). Text status keeps its raw text
  // if stripping would empty it.
  const shownCaption = mode === 'text' ? stripTags(body) || body : stripTags(body);

  const draft: StatusDraft =
    mode === 'text'
      ? { type: 'TEXT', caption: shownCaption, bgColor: bg, music, mentionNames: [] }
      : {
          type: media[0]?.type ?? 'IMAGE',
          mediaUrl: media[0]?.url,
          media,
          caption: shownCaption || undefined,
          music,
          mentionNames: [],
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
          multiple
          className="hidden"
          onChange={(e) => pickMedia(e.target.files)}
        />

        {mode === 'media' ? (
          media.length > 0 ? (
            <div>
              {/* Selected photos/videos — this whole set posts as one status frame. */}
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div
                    key={`${m.url}-${i}`}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-black"
                  >
                    {m.type === 'IMAGE' ? (
                      <img src={mediaSrc(m.url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video src={mediaSrc(m.url)} muted className="h-full w-full object-cover" />
                    )}
                    <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] font-semibold text-white">
                      {i + 1}
                    </span>
                    {m.type === 'VIDEO' && (
                      <Video className="absolute bottom-1 right-1 h-4 w-4 text-white drop-shadow" />
                    )}
                    <button
                      onClick={() => removeMedia(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {/* Add-more tile. */}
                {media.length < MAX_MEDIA && (
                  <button
                    onClick={() => mediaInput.current?.click()}
                    disabled={uploading}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-50 dark:border-slate-600"
                  >
                    {uploading ? (
                      <Spinner className="h-5 w-5" />
                    ) : (
                      <>
                        <Plus className="h-6 w-6" />
                        <span className="text-[11px] font-medium">Add more</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {media.length === 1
                  ? '1 item · will post as a single status'
                  : `${media.length} items · will post as one status frame`}
              </p>
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
                  <span className="text-sm font-medium">Choose photos or videos</span>
                  <span className="text-xs text-slate-400">Pick several to post them in one frame</span>
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
        {mode === 'media' && media.length > 0 && (
          <MentionField
            value={caption}
            onChange={setCaption}
            people={people}
            tagged={tagged}
            placeholder="Add a caption… use @ to mention"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        )}

        {/* Who's tagged — a mention notifies them and lets them add the status,
            but their name is NOT shown in the caption, so surface it here. */}
        {mentionNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Tagged:</span>
            {mentionNames.map((n) => (
              <span
                key={n}
                className="rounded-full bg-brand-500/15 px-2 py-0.5 font-medium text-brand-600 dark:text-brand-400"
              >
                @{n}
              </span>
            ))}
            <span className="text-slate-400">· only they can add it, not shown in caption</span>
          </div>
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
