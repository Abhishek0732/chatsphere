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
  Info,
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
import { MessageText } from './MessageText';
import { Avatar } from '@/components/ui/Avatar';

/** Stable empty list so direct chats don't hand memoized bubbles a new array. */
const NO_MENTIONS: string[] = [];

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  /** Show sender name (group chats, incoming only). */
  showSender: boolean;
  /** Reserve the avatar gutter (group chats only; direct chats have no avatars). */
  avatarColumn?: boolean;
  /** Render the sender's avatar beside this (incoming) bubble. */
  showAvatar?: boolean;
  /** Sender's avatar URL (resolved from the conversation members). */
  avatarUrl?: string;
  onForward: (message: Message) => void;
  /** Jump to (scroll + highlight) the original message when a reply is tapped. */
  onJumpTo?: (messageId: number) => void;
  /** Names that can be @mentioned here (group members + All/Everyone). */
  mentionNames?: string[];
  /** My display name — a mention of it is highlighted more strongly. */
  myName?: string;
  /** Open "Message info" (who has seen this) — group chats, own messages. */
  onShowInfo?: (message: Message) => void;
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

function MessageBubbleInner({
  message,
  mine,
  showSender,
  avatarColumn,
  showAvatar,
  avatarUrl,
  onForward,
  onJumpTo,
  mentionNames = NO_MENTIONS,
  myName,
  onShowInfo,
}: MessageBubbleProps) {
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
  // "Message info" (who has seen it) is a group-only action on your own messages,
  // exactly as in WhatsApp — a direct chat already says it with the read ticks.
  const canShowInfo = Boolean(onShowInfo) && mine && sent && !message.deleted;
  // Reply, Forward, Pin + Copy (text), Edit (own text), Download (attachment),
  // Info + Delete (own). Plus the emoji reaction row at the top.
  const itemCount =
    3 +
    (canCopy ? 1 : 0) +
    (canEdit ? 1 : 0) +
    (hasAttachment ? 1 : 0) +
    (canShowInfo ? 1 : 0) +
    (mine ? 1 : 0);

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
    <div className={cn('cv-row group flex w-full items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
      {avatarColumn &&
        !mine &&
        (showAvatar ? (
          <Avatar
            name={message.senderName}
            src={avatarUrl}
            size="sm"
            className="mb-5 h-8 w-8 shrink-0"
          />
        ) : (
          <div className="w-8 shrink-0" />
        ))}
      <div
        data-message-id={message.id}
        className={cn('flex min-w-0 max-w-[85%] flex-col gap-0.5', mine ? 'items-end' : 'items-start')}
      >
      <div
        className={cn(
          'relative min-w-0 max-w-full animate-pop-in rounded-2xl px-3.5 py-2 shadow-lg transition-transform duration-150',
          // A deleted message is neutral/muted (never the accent bubble), so its
          // "This message was deleted" text always has proper contrast.
          message.deleted
            ? cn('bg-surface-container-high text-on-surface-variant', mine ? 'rounded-br-none' : 'rounded-bl-none')
            : mine
              ? 'message-gradient-sent rounded-br-none font-medium text-on-primary'
              : 'message-received rounded-bl-none text-on-surface',
        )}
      >
        {showSender && !mine && !message.deleted && (
          <p className="mb-0.5 text-xs font-semibold text-primary">{message.senderName}</p>
        )}

        {message.deleted ? (
          <p
            className={cn(
              'flex items-center gap-1.5 text-sm italic',
              mine ? 'text-on-surface-variant' : 'text-on-surface-variant',
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
                    : 'border-primary bg-white/10',
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
              <button
                type="button"
                onClick={() => onJumpTo?.(message.replyTo!.id)}
                className={cn(
                  'mb-1 block w-full rounded-lg border-l-4 px-2 py-1 text-left text-xs transition hover:brightness-110',
                  mine
                    ? 'border-white/70 bg-brand-700/40'
                    : 'border-primary bg-white/10',
                )}
              >
                <span className="block font-semibold">{message.replyTo.senderName}</span>
                <span className="line-clamp-1 [overflow-wrap:anywhere] opacity-80">
                  {message.replyTo.content || 'Attachment'}
                </span>
              </button>
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
                  <MessageText
                    content={message.content}
                    mentionNames={mentionNames}
                    myName={myName}
                    mine={mine}
                    className="mb-0.5"
                  />
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
                  <MessageText
                    content={message.content}
                    mentionNames={mentionNames}
                    myName={myName}
                    mine={mine}
                    className="mb-0.5"
                  />
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
                  <MessageText
                    content={message.content}
                    mentionNames={mentionNames}
                    myName={myName}
                    mine={mine}
                    className="mb-0.5"
                  />
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
                    mine ? 'bg-brand-700/40' : 'bg-white/10',
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
                  <MessageText
                    content={message.content}
                    mentionNames={mentionNames}
                    myName={myName}
                    mine={mine}
                    className="mb-0.5"
                  />
                )}
              </>
            )}

            {message.type === 'TEXT' && message.content && (
              <MessageText
                content={message.content}
                mentionNames={mentionNames}
                myName={myName}
                mine={mine}
              />
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
                        : 'bg-white/10 text-on-surface hover:bg-white/15',
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="text-[10px] font-medium">{r.userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Actions trigger (revealed on hover). Sits on the inner edge of the bubble. */}
        {canAct && (
          <button
            ref={triggerRef}
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            className={cn(
              'absolute -top-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 shadow transition group-hover:opacity-100',
              'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
              mine ? 'left-1' : 'right-1',
              menuOpen && 'opacity-100',
            )}
            aria-label="Message actions"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Timestamp + status below the bubble, WhatsApp/reference-style. */}
      <div
        className={cn(
          'flex items-center gap-1 px-1 text-on-surface-variant',
          mine ? 'justify-end' : 'justify-start',
        )}
      >
        {message.editedAt && !message.deleted && (
          <span className="text-[10px] italic opacity-80">edited</span>
        )}
        <span className="text-[10px]">{formatTime(message.createdAt)}</span>
        {mine && !message.deleted && <MessageStatusTicks message={message} />}
      </div>
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
            <div className="flex items-center gap-1 self-start rounded-full border border-white/10 bg-surface-container/95 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
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
              className="overflow-hidden rounded-xl border border-white/10 bg-surface-container/95 text-sm text-on-surface shadow-2xl backdrop-blur-xl"
            >
            <button
              onClick={handleReply}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
            >
              <Reply className="h-4 w-4" /> Reply
            </button>
            <button
              onClick={handleForward}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
            >
              <Forward className="h-4 w-4" /> Forward
            </button>
            <button
              onClick={handlePin}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
            >
              {message.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {message.pinned ? 'Unpin' : 'Pin'}
            </button>
            {canCopy && (
              <button
                onClick={handleCopy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleEdit}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
            {hasAttachment && (
              <button
                onClick={handleDownload}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            )}
            {canShowInfo && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onShowInfo?.(message);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
              >
                <Info className="h-4 w-4" /> Message info
              </button>
            )}
            {mine && (
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-error transition hover:bg-error/10"
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
