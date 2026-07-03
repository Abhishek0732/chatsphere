import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Paperclip, Reply, SendHorizonal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useChatStore } from '@/store/chatStore';
import { socketService } from '@/services/socket';
import { uploadMedia } from '@/api/media';
import { toast } from '@/store/toastStore';
import { formatBytes } from '@/utils/format';
import type { MessageType } from '@/types';

const TYPING_STOP_MS = 2500;

interface PendingAttachment {
  url: string;
  fileName: string;
  type: MessageType;
  size: number;
}

export function MessageInput({ conversationId }: { conversationId: number }) {
  const send = useSendMessage();
  const draft = useChatStore((s) => s.drafts[conversationId] ?? '');
  const setDraft = useChatStore((s) => s.setDraft);
  const clearDraft = useChatStore((s) => s.clearDraft);
  const replyTo = useChatStore((s) => s.replyTo[conversationId] ?? null);
  const clearReplyTo = useChatStore((s) => s.clearReplyTo);

  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const typingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus the composer when the user chooses to reply.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Reset typing state / timers when switching conversations.
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (typingRef.current) {
        socketService.sendTyping(conversationId, false);
        typingRef.current = false;
      }
    };
  }, [conversationId]);

  const signalTyping = () => {
    if (!typingRef.current) {
      typingRef.current = true;
      socketService.sendTyping(conversationId, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingRef.current = false;
      socketService.sendTyping(conversationId, false);
    }, TYPING_STOP_MS);
  };

  const stopTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingRef.current) {
      typingRef.current = false;
      socketService.sendTyping(conversationId, false);
    }
  };

  const onFilePicked = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      const type: MessageType = result.contentType.startsWith('image/') ? 'IMAGE' : 'FILE';
      setAttachment({
        url: result.url,
        fileName: result.fileName,
        type,
        size: result.size,
      });
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text && !attachment) return;

    if (attachment) {
      send({
        conversationId,
        content: attachment.type === 'IMAGE' ? text : text || attachment.fileName,
        type: attachment.type,
        attachmentUrl: attachment.url,
        replyTo,
      });
      setAttachment(null);
    }
    if (text && !attachment) {
      send({ conversationId, content: text, type: 'TEXT', replyTo });
    } else if (text && attachment) {
      // text was sent as the attachment caption above; nothing else to do
    }

    clearDraft(conversationId);
    clearReplyTo(conversationId);
    stopTyping();
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-brand-500 bg-white px-3 py-2 dark:bg-slate-800">
          <Reply className="h-4 w-4 shrink-0 text-brand-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              Replying to {replyTo.senderName}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {replyTo.content || 'Attachment'}
            </p>
          </div>
          <button
            onClick={() => clearReplyTo(conversationId)}
            className="rounded p-1 text-slate-400 hover:text-red-500"
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {attachment && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
          {attachment.type === 'IMAGE' ? (
            <img src={attachment.url} alt="preview" className="h-12 w-12 rounded object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 dark:bg-slate-700">
              <Paperclip className="h-5 w-5 text-slate-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attachment.fileName}</p>
            <p className="text-xs text-slate-400">{formatBytes(attachment.size)}</p>
          </div>
          <button
            onClick={() => setAttachment(null)}
            className="rounded p-1 text-slate-400 hover:text-red-500"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => onFilePicked(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Attach file"
        >
          {uploading ? <Spinner className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
        </Button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          placeholder="Type a message"
          onChange={(e) => {
            setDraft(conversationId, e.target.value);
            signalTyping();
          }}
          onKeyDown={onKeyDown}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />

        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!draft.trim() && !attachment}
          aria-label="Send"
          className="rounded-full"
        >
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
