import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Forward, MoreVertical, Reply, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { fileNameFromUrl } from '@/utils/format';
import { useChatStore } from '@/store/chatStore';
import { socketService } from '@/services/socket';
import { markMessageDeleted, removeMessageLocally } from '@/services/messageCache';
import { hideMessage } from '@/api/conversations';
import { DeleteMessageDialog } from '@/components/ui/DeleteMessageDialog';
import { toast } from '@/store/toastStore';
import { downloadFile } from '@/utils/download';
import type { Message, ReplyPreview } from '@/types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MENU_W = 188;

/**
 * A compact, self-contained action menu for a single message — Reply, Forward,
 * Download, Delete + a quick-reaction row. Used for individual photos inside an
 * album, where each tile needs its own actions (messenger-style) rather than the
 * whole group being replied to or deleted at once. The menu is portaled and
 * fixed-positioned so it never gets clipped by the scrolling thread.
 */
export function MessageActionsMenu({
  message,
  mine,
  onForward,
  onDismiss,
  triggerClassName,
}: {
  message: Message;
  mine: boolean;
  onForward?: (message: Message) => void;
  /**
   * Dismiss the surrounding surface (e.g. close the album gallery modal) after
   * an action that takes the user back to the chat — reply or forward — so the
   * message input isn't left hidden behind it.
   */
  onDismiss?: () => void;
  /** Extra classes for the corner trigger button (e.g. position tweaks). */
  triggerClassName?: string;
}) {
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const sent = message.id > 0;
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const preview: string = message.content ? `📷 ${message.content}` : '📷 Photo';

  const openMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Reaction row + up to 4 items.
    const menuH = 4 * 40 + 64;
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8;
    if (left < 8) left = 8;
    if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 4;
    if (top < 8) top = 8;
    setPos({ top, left });
    setOpen(true);
  };

  // Re-clamp with the real rendered size (the reaction row is wider than MENU_W).
  useLayoutEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos((p) => {
      let left = p.left;
      let top = p.top;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
      if (top < 8) top = 8;
      return left === p.left && top === p.top ? p : { left, top };
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || contentRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const handleReply = () => {
    const reply: ReplyPreview = {
      id: message.id,
      senderName: message.senderName,
      content: preview,
      type: message.type,
    };
    setReplyTo(message.conversationId, reply);
    setOpen(false);
    onDismiss?.();
  };

  const handleForward = () => {
    onForward?.(message);
    setOpen(false);
    onDismiss?.();
  };

  const handleDownload = () => {
    if (message.attachmentUrl) {
      void downloadFile(message.attachmentUrl, fileNameFromUrl(message.attachmentUrl));
    }
    setOpen(false);
  };

  const handleDelete = () => {
    setOpen(false);
    setDeleteOpen(true);
  };

  const handleDeleteForEveryone = () => {
    markMessageDeleted(message.conversationId, message.id);
    socketService.deleteMessage(message.conversationId, message.id);
  };

  const handleDeleteForMe = () => {
    removeMessageLocally(message.conversationId, message.id);
    if (sent) {
      void hideMessage(message.conversationId, message.id).catch(() =>
        toast({ title: 'Could not delete message', variant: 'error' }),
      );
    }
  };

  const handleReact = (emoji: string) => {
    socketService.reactToMessage(message.conversationId, message.id, emoji);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          open ? setOpen(false) : openMenu();
        }}
        className={cn(
          'absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow transition hover:bg-black/70 group-hover:opacity-100',
          open && 'opacity-100',
          triggerClassName,
        )}
        aria-label="Photo actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={contentRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            className="z-[60] flex flex-col gap-2"
          >
            <div className="flex items-center gap-1 self-start rounded-full border border-white/10 bg-surface-container/95 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="rounded-full px-0.5 text-xl transition hover:scale-125"
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

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
              {onForward && (
                <button
                  onClick={handleForward}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
                >
                  <Forward className="h-4 w-4" /> Forward
                </button>
              )}
              <button
                onClick={handleDownload}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-on-surface transition hover:bg-white/5"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-error transition hover:bg-error/10"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>,
          document.body,
        )}

      <DeleteMessageDialog
        open={deleteOpen}
        canDeleteForEveryone={mine && sent && !message.deleted}
        onDeleteForEveryone={handleDeleteForEveryone}
        onDeleteForMe={handleDeleteForMe}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
