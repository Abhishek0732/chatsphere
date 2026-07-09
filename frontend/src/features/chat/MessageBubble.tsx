import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Download,
  ChevronDown,
  Reply,
  Forward,
  Trash2,
  Ban,
  Copy,
  Pin,
  PinOff,
  Pencil,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { fileNameFromUrl, formatTime, isAudioUrl, isVideoUrl } from '@/utils/format';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { useMediaRevealStore } from '@/store/mediaRevealStore';
import { MediaDownloadTile } from './MediaDownloadTile';
import { socketService } from '@/services/socket';
import { markMessageDeleted } from '@/services/messageCache';
import { toast } from '@/store/toastStore';
import { downloadFile } from '@/utils/download';
import { copyText } from '@/utils/clipboard';
import { mediaSrc } from '@/utils/media';
import type { Message, ReplyPreview } from '@/types';
import { MessageStatusTicks } from './MessageStatusTicks';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  /** Show sender name (group chats, incoming only). */
  showSender: boolean;
  onForward: (message: Message) => void;
}

const MENU_W = 188; // fits the emoji reaction row
const EDIT_WINDOW_MS = 15 * 60 * 1000; // WhatsApp: edit within 15 minutes of sending

function previewOf(message: Message): string | null {
  if (message.type === 'IMAGE') return message.content ? `📷 ${message.content}` : '📷 Photo';
  if (message.type === 'FILE') {
    if (isAudioUrl(message.attachmentUrl)) {
      return message.content ? `🎤 ${message.content}` : '🎤 Voice message';
    }
    if (isVideoUrl(message.attachmentUrl)) {
      return message.content ? `🎥 ${message.content}` : '🎥 Video';
    }
    return `📎 ${fileNameFromUrl(message.attachmentUrl)}`;
  }
  return message.content || null;
}

function MessageBubbleInner({ message, mine, showSender, onForward }: MessageBubbleProps) {
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const setEditing = useChatStore((s) => s.setEditing);
  const myId = useAuthStore((s) => s.user?.id);
  const openViewer = useImageViewer((s) => s.open);
  const revealMedia = useMediaRevealStore((s) => s.reveal);
  // Media I received stays hidden until I "download" it (WhatsApp-style); my own
  // sent media is always shown. Optimistic (negative id) messages show directly.
  const mediaRevealed = useMediaRevealStore((s) => Boolean(s.revealed[message.id]));
  const gateMedia = !mine && message.id > 0 && !mediaRevealed;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);

  // A positive server id means the message is persisted (optimistic messages use a
  // negative id). The server echoes the tempId back, so don't gate on tempId here.
  const sent = message.id > 0;
  const canAct = sent && !message.deleted;
  const hasAttachment =
    (message.type === 'IMAGE' || message.type === 'FILE') && Boolean(message.attachmentUrl);
  const canCopy = Boolean(message.content);
  // WhatsApp-style: your own text messages are editable for 15 minutes after
  // sending (read state no longer matters — a read message can still be edited).
  const canEdit =
    mine &&
    message.type === 'TEXT' &&
    !message.deleted &&
    Date.now() - new Date(message.createdAt).getTime() <= EDIT_WINDOW_MS;
  // Reply, Forward, Pin + Copy (text), Edit (own text), Download (attachment),
  // Delete (own). Plus the emoji reaction row at the top.
  const itemCount =
    3 + (canCopy ? 1 : 0) + (canEdit ? 1 : 0) + (hasAttachment ? 1 : 0) + (mine ? 1 : 0);

  // Position the menu next to the trigger, clamped to stay fully on screen.
  const openMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuH = itemCount * 40 + 64; // + floating reaction pill & gap
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8;
    if (left < 8) left = 8;
    if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 4;
    if (top < 8) top = 8;
    setMenuPos({ top, left });
    setMenuOpen(true);
  };

  // Re-clamp using the popover's REAL size once it's rendered. openMenu() only
  // estimates with the actions-menu width, but the emoji reaction row is wider —
  // on a narrow (mobile) screen that overflows/clips the right edge. This measures
  // the actual popover (reaction bar + menu) and nudges it fully on-screen. Runs
  // before paint, so there's no visible jump.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const el = menuContentRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setMenuPos((pos) => {
      let left = pos.left;
      let top = pos.top;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
      if (top < 8) top = 8;
      return left === pos.left && top === pos.top ? pos : { left, top };
    });
  }, [menuOpen]);

  // Close on outside click or scroll (fixed menu shouldn't float detached).
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuContentRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [menuOpen]);

  const handleReply = () => {
    const reply: ReplyPreview = {
      id: message.id,
      senderName: message.senderName,
      content: previewOf(message),
      type: message.type,
    };
    setReplyTo(message.conversationId, reply);
    setMenuOpen(false);
  };

  const handleForward = () => {
    onForward(message);
    setMenuOpen(false);
  };

  const handleDownload = () => {
    if (message.attachmentUrl) {
      void downloadFile(message.attachmentUrl, fileNameFromUrl(message.attachmentUrl));
    }
    setMenuOpen(false);
  };

  const handleDelete = () => {
    markMessageDeleted(message.conversationId, message.id); // optimistic
    socketService.deleteMessage(message.conversationId, message.id);
    setMenuOpen(false);
  };

  const handleReact = (emoji: string) => {
    socketService.reactToMessage(message.conversationId, message.id, emoji);
    setMenuOpen(false);
  };

  const handleCopy = () => {
    setMenuOpen(false);
    if (!message.content) return;
    void copyText(message.content).then((ok) =>
      toast({ title: ok ? 'Copied to clipboard' : 'Copy failed', variant: ok ? 'success' : 'error' }),
    );
  };

  const handlePin = () => {
    socketService.pinMessage(message.conversationId, message.id, !message.pinned);
    setMenuOpen(false);
  };

  const handleEdit = () => {
    setEditing(message.conversationId, { id: message.id, content: message.content ?? '' });
    setMenuOpen(false);
  };

  return (
    <div className={cn('group flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[78%] animate-pop-in rounded-[20px] px-3.5 py-2.5 shadow-elevated transition-transform duration-150 hover:-translate-y-px',
          mine
            ? 'rounded-br-[6px] bg-[#d6ebff] text-slate-900 dark:bg-[#164e7a] dark:text-slate-50'
            : 'rounded-bl-[6px] bg-white text-slate-900 ring-1 ring-slate-900/5 dark:bg-[#17233c] dark:text-slate-100 dark:ring-white/[0.06]',
        )}
      >
        {showSender && !mine && !message.deleted && (
          <p className="mb-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
            {message.senderName}
          </p>
        )}

        {message.deleted ? (
          <p
            className={cn(
              'flex items-center gap-1.5 text-sm italic',
              mine ? 'text-slate-500 dark:text-slate-300' : 'text-slate-400',
            )}
          >
            <Ban className="h-3.5 w-3.5" /> This message was deleted
          </p>
        ) : (
          <>
            {message.statusRef && (
              <div
                className={cn(
                  'mb-1 flex items-center gap-2 rounded-lg border-l-4 py-1 pl-2 pr-1.5 text-xs',
                  mine
                    ? 'border-white/70 bg-brand-700/40'
                    : 'border-brand-400 bg-slate-100 dark:bg-slate-700',
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {mine ? 'You replied to their status' : 'Replied to your status'}
                  </span>
                  {message.statusRef.caption && (
                    <span className="block truncate opacity-80">{message.statusRef.caption}</span>
                  )}
                </div>
                {message.statusRef.type === 'TEXT' ? (
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md text-[9px] text-white"
                    style={{
                      backgroundImage: message.statusRef.bgColor ?? undefined,
                      backgroundColor: message.statusRef.bgColor ? undefined : '#6366f1',
                    }}
                  >
                    Aa
                  </span>
                ) : message.statusRef.mediaUrl ? (
                  message.statusRef.type === 'VIDEO' ? (
                    <video
                      src={mediaSrc(message.statusRef.mediaUrl)}
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={mediaSrc(message.statusRef.mediaUrl)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
                    />
                  )
                ) : null}
              </div>
            )}

            {message.replyTo && (
              <div
                className={cn(
                  'mb-1 rounded-lg border-l-4 px-2 py-1 text-xs',
                  mine
                    ? 'border-white/70 bg-brand-700/40'
                    : 'border-brand-400 bg-slate-100 dark:bg-slate-700',
                )}
              >
                <span className="block font-semibold">{message.replyTo.senderName}</span>
                <span className="block truncate opacity-80">
                  {message.replyTo.content || 'Attachment'}
                </span>
              </div>
            )}

            {message.type === 'IMAGE' && message.attachmentUrl && (
              <>
                {gateMedia ? (
                  <MediaDownloadTile
                    kind="image"
                    mine={mine}
                    onReveal={() => revealMedia(message.id)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => openViewer(message.content || 'Photo', message.attachmentUrl)}
                    className="-mx-2.5 -mt-1.5 mb-1.5 block w-[calc(min(75vw,18rem)_+_1.25rem)] max-w-[calc(100%_+_1.25rem)] overflow-hidden rounded-2xl"
                  >
                    <img
                      src={mediaSrc(message.attachmentUrl)}
                      alt={message.content || 'image'}
                      loading="lazy"
                      decoding="async"
                      className="max-h-96 w-full cursor-pointer object-cover"
                    />
                  </button>
                )}
                {/* Caption typed alongside the image. */}
                {message.content && (
                  <p className="mb-0.5 whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </p>
                )}
              </>
            )}

            {message.type === 'FILE' && message.attachmentUrl && isAudioUrl(message.attachmentUrl) && (
              <>
                {gateMedia ? (
                  <MediaDownloadTile
                    kind="audio"
                    mine={mine}
                    onReveal={() => revealMedia(message.id)}
                  />
                ) : (
                  /* Inline audio / voice-message player. */
                  <audio
                    src={mediaSrc(message.attachmentUrl)}
                    controls
                    preload="metadata"
                    className="mb-1 w-56 max-w-full"
                  />
                )}
                {message.content && (
                  <p className="mb-0.5 whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </p>
                )}
              </>
            )}

            {message.type === 'FILE' &&
              message.attachmentUrl &&
              isVideoUrl(message.attachmentUrl) && (
              <>
                {gateMedia ? (
                  <MediaDownloadTile
                    kind="video"
                    mine={mine}
                    onReveal={() => revealMedia(message.id)}
                  />
                ) : (
                  /* Inline video player — play directly in the chat (WhatsApp-style). */
                  <video
                    src={mediaSrc(message.attachmentUrl)}
                    controls
                    preload="metadata"
                    playsInline
                    className="-mx-2.5 -mt-1.5 mb-1.5 block max-h-96 w-[calc(min(75vw,18rem)_+_1.25rem)] max-w-[calc(100%_+_1.25rem)] rounded-2xl bg-black"
                  />
                )}
                {message.content && (
                  <p className="mb-0.5 whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </p>
                )}
              </>
            )}

            {message.type === 'FILE' &&
              message.attachmentUrl &&
              !isVideoUrl(message.attachmentUrl) &&
              !isAudioUrl(message.attachmentUrl) && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void downloadFile(message.attachmentUrl!, fileNameFromUrl(message.attachmentUrl))
                  }
                  className={cn(
                    'mb-1 flex w-full items-center gap-2 rounded-lg p-2 text-left',
                    mine ? 'bg-brand-700/40' : 'bg-slate-100 dark:bg-slate-700',
                  )}
                >
                  <FileText className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {fileNameFromUrl(message.attachmentUrl)}
                  </span>
                  <Download className="h-4 w-4 shrink-0" />
                </button>
                {/* Caption typed alongside the file. */}
                {message.content && (
                  <p className="mb-0.5 whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </p>
                )}
              </>
            )}

            {message.type === 'TEXT' && message.content && (
              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
            )}
          </>
        )}

        {/* Emoji reactions. */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => {
              const mineReacted = myId != null && r.userIds.includes(myId);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => handleReact(r.emoji)}
                  className={cn(
                    'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition',
                    mine
                      ? mineReacted
                        ? 'bg-white/30 ring-1 ring-white/60'
                        : 'bg-white/15 hover:bg-white/25'
                      : mineReacted
                        ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-300'
                        : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200',
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="text-[10px] font-medium">{r.userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        <div
          className={cn(
            'mt-0.5 flex items-center justify-end gap-1',
            mine ? 'text-slate-500 dark:text-slate-300/80' : 'text-slate-400',
          )}
        >
          {message.editedAt && !message.deleted && (
            <span className="text-[10px] italic opacity-80">edited</span>
          )}
          <span className="text-[10px]">{formatTime(message.createdAt)}</span>
          {mine && !message.deleted && <MessageStatusTicks message={message} />}
        </div>

        {/* Actions trigger (revealed on hover). Sits on the inner edge of the bubble. */}
        {canAct && (
          <button
            ref={triggerRef}
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            className={cn(
              'absolute -top-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 shadow transition group-hover:opacity-100',
              'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300',
              mine ? 'left-1' : 'right-1',
              menuOpen && 'opacity-100',
            )}
            aria-label="Message actions"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Menu is portaled + fixed-positioned so it always renders fully inside
          the viewport, never clipped by the scrolling message list. */}
      {menuOpen &&
        createPortal(
          <div
            ref={menuContentRef}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
            className="z-[60] flex flex-col gap-2"
          >
            {/* Floating WhatsApp-style reaction bar, separate from the menu. */}
            <div className="flex items-center gap-1 self-start rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-xl dark:border-white/10 dark:bg-[#17233c]">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => handleReact(e)}
                  className="rounded-full px-0.5 text-xl transition hover:scale-125"
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Actions menu. */}
            <div
              style={{ width: MENU_W }}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl dark:border-white/10 dark:bg-[#17233c]"
            >
            <button
              onClick={handleReply}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Reply className="h-4 w-4" /> Reply
            </button>
            <button
              onClick={handleForward}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Forward className="h-4 w-4" /> Forward
            </button>
            <button
              onClick={handlePin}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {message.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {message.pinned ? 'Unpin' : 'Pin'}
            </button>
            {canCopy && (
              <button
                onClick={handleCopy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleEdit}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
            {hasAttachment && (
              <button
                onClick={handleDownload}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            )}
            {mine && (
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// Memoized: in a long thread, an unrelated re-render of the list (e.g. a remote
// typing event) must not re-render every bubble — only bubbles whose props
// actually change. `onForward` is a stable setter from the parent.
export const MessageBubble = memo(MessageBubbleInner);
