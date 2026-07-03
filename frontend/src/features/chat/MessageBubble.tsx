import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Download, MoreHorizontal, Reply, Forward, Trash2, Ban } from 'lucide-react';
import { cn } from '@/utils/cn';
import { fileNameFromUrl, formatTime } from '@/utils/format';
import { useChatStore } from '@/store/chatStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { socketService } from '@/services/socket';
import { markMessageDeleted } from '@/services/messageCache';
import { downloadFile } from '@/utils/download';
import type { Message, ReplyPreview } from '@/types';
import { MessageStatusTicks } from './MessageStatusTicks';

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  /** Show sender name (group chats, incoming only). */
  showSender: boolean;
  onForward: (message: Message) => void;
}

const MENU_W = 144; // matches w-36

function previewOf(message: Message): string | null {
  if (message.type === 'IMAGE') return message.content ? `📷 ${message.content}` : '📷 Photo';
  if (message.type === 'FILE') return `📎 ${fileNameFromUrl(message.attachmentUrl)}`;
  return message.content || null;
}

export function MessageBubble({ message, mine, showSender, onForward }: MessageBubbleProps) {
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const openViewer = useImageViewer((s) => s.open);
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
  // Reply + Forward, plus Download (attachments) and Delete (own messages).
  const itemCount = 2 + (hasAttachment ? 1 : 0) + (mine ? 1 : 0);

  // Position the menu next to the trigger, clamped to stay fully on screen.
  const openMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuH = itemCount * 40 + 8;
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8;
    if (left < 8) left = 8;
    if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 4;
    if (top < 8) top = 8;
    setMenuPos({ top, left });
    setMenuOpen(true);
  };

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

  return (
    <div className={cn('group flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[75%] animate-pop-in rounded-2xl px-3 py-2 shadow-sm',
          mine
            ? 'rounded-br-md bg-brand-gradient text-white'
            : 'rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700/50',
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
              mine ? 'text-brand-100' : 'text-slate-400',
            )}
          >
            <Ban className="h-3.5 w-3.5" /> This message was deleted
          </p>
        ) : (
          <>
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
                <button
                  type="button"
                  onClick={() => openViewer(message.content || 'Photo', message.attachmentUrl)}
                  className="mb-1 block w-full"
                >
                  <img
                    src={message.attachmentUrl}
                    alt={message.content || 'image'}
                    className="max-h-72 w-full cursor-pointer rounded-lg object-cover"
                  />
                </button>
                {/* Caption typed alongside the image. */}
                {message.content && (
                  <p className="mb-0.5 whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </p>
                )}
              </>
            )}

            {message.type === 'FILE' && message.attachmentUrl && (
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

        <div
          className={cn(
            'mt-0.5 flex items-center justify-end gap-1',
            mine ? 'text-brand-100' : 'text-slate-400',
          )}
        >
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
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Menu is portaled + fixed-positioned so it always renders fully inside
          the viewport, never clipped by the scrolling message list. */}
      {menuOpen &&
        createPortal(
          <div
            ref={menuContentRef}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: MENU_W }}
            className="z-[60] overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
