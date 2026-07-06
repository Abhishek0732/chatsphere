import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Camera, Mic, Paperclip, Pencil, Reply, SendHorizonal, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useChatStore } from '@/store/chatStore';
import { socketService } from '@/services/socket';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';
import { formatBytes, isVideoUrl } from '@/utils/format';
import { mediaSrc } from '@/utils/media';
import type { MessageType } from '@/types';

const TYPING_STOP_MS = 2500;

interface PendingAttachment {
  url: string;
  fileName: string;
  type: MessageType;
  size: number;
}

/** mm:ss for the recording timer. */
function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MessageInput({ conversationId }: { conversationId: number }) {
  const send = useSendMessage();
  const draft = useChatStore((s) => s.drafts[conversationId] ?? '');
  const setDraft = useChatStore((s) => s.setDraft);
  const clearDraft = useChatStore((s) => s.clearDraft);
  const replyTo = useChatStore((s) => s.replyTo[conversationId] ?? null);
  const clearReplyTo = useChatStore((s) => s.clearReplyTo);
  const editing = useChatStore((s) => s.editing[conversationId] ?? null);
  const clearEditing = useChatStore((s) => s.clearEditing);

  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const typingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice-message recording.
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Focus the composer when the user chooses to reply.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Auto-grow the textarea with its content, up to 6 rows, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const maxHeight = lineHeight * 6 + padding;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [draft]);

  // Load the message text into the composer when an edit begins.
  useEffect(() => {
    if (editing) {
      setDraft(conversationId, editing.content);
      textareaRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  const cancelEdit = () => {
    clearEditing(conversationId);
    clearDraft(conversationId);
  };

  // Reset typing state / timers when switching conversations.
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (typingRef.current) {
        socketService.sendTyping(conversationId, false);
        typingRef.current = false;
      }
      // Discard any in-progress recording when leaving the conversation.
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        cancelledRef.current = true;
        recorderRef.current.stop();
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
    const sizeError = uploadSizeError(file);
    if (sizeError) {
      toast({ title: sizeError, variant: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      return;
    }
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

    // Editing an existing message.
    if (editing) {
      if (text) socketService.editMessage(conversationId, editing.id, text);
      clearEditing(conversationId);
      clearDraft(conversationId);
      stopTyping();
      return;
    }

    if (!text && !attachment) return;

    if (attachment) {
      // One message carries the attachment + the typed text as its caption.
      // The filename is derived from the URL at render time, so `content` is
      // free to hold the caption for both images and files.
      send({
        conversationId,
        content: text,
        type: attachment.type,
        attachmentUrl: attachment.url,
        replyTo,
      });
      setAttachment(null);
    } else {
      send({ conversationId, content: text, type: 'TEXT', replyTo });
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

  const teardownRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
    setRecordSecs(0);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({ title: 'Voice recording is not supported here', variant: 'error' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const cancelled = cancelledRef.current;
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        teardownRecording();
        if (cancelled || blob.size === 0) return;
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice-message-${Date.now()}.${ext}`, { type });
        setUploading(true);
        try {
          const result = await uploadMedia(file);
          send({ conversationId, content: '', type: 'FILE', attachmentUrl: result.url, replyTo });
          clearReplyTo(conversationId);
        } catch {
          toast({ title: 'Could not send voice message', variant: 'error' });
        } finally {
          setUploading(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSecs(0);
      stopTyping();
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      teardownRecording();
      toast({ title: 'Microphone access denied', variant: 'error' });
    }
  };

  const stopAndSendRecording = () => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  };

  return (
    <div className="border-t border-white/40 bg-white/70 p-3 backdrop-blur-md dark:border-white/5 dark:bg-slate-900/70">
      {editing && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-brand-500 bg-white px-3 py-2 dark:bg-slate-800">
          <Pencil className="h-4 w-4 shrink-0 text-brand-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">Editing message</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{editing.content}</p>
          </div>
          <button
            onClick={cancelEdit}
            className="rounded p-1 text-slate-400 hover:text-red-500"
            aria-label="Cancel edit"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {replyTo && !editing && (
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
            <img src={mediaSrc(attachment.url)} alt="preview" className="h-12 w-12 rounded object-cover" />
          ) : isVideoUrl(attachment.url) ? (
            <video
              src={mediaSrc(attachment.url)}
              muted
              preload="metadata"
              className="h-12 w-12 rounded bg-black object-cover"
            />
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
        {/* Hidden inputs: any-file picker + camera capture (opens the camera on mobile). */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => onFilePicked(e.target.files?.[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFilePicked(e.target.files?.[0])}
        />

        {recording ? (
          // Recording bar: cancel, pulsing dot + timer, and the send button.
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-red-300 bg-white px-3 py-2.5 shadow-sm dark:border-red-500/40 dark:bg-slate-800">
            <button
              type="button"
              onClick={cancelRecording}
              className="rounded-full p-1 text-slate-400 transition hover:text-red-500"
              aria-label="Cancel recording"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
              {formatDuration(recordSecs)}
            </span>
            <span className="text-xs text-slate-400">Recording…</span>
          </div>
        ) : (
          // Composer field with the attach + camera icons inside it.
          <div className="flex flex-1 items-end gap-0.5 rounded-2xl border border-slate-300 bg-white px-2 py-1 shadow-sm transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/60 dark:border-slate-600 dark:bg-slate-800">
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
              className="min-h-[2rem] flex-1 resize-none overflow-y-hidden bg-transparent px-2 py-1.5 text-sm text-slate-900 focus:outline-none dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mb-0.5 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Attach file"
            >
              {uploading ? <Spinner className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="mb-0.5 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Take photo"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Trailing button: send while recording, send when there's content to
            send, otherwise the mic to start a voice message (WhatsApp-style). */}
        {recording ? (
          <Button
            type="button"
            size="icon"
            onClick={stopAndSendRecording}
            aria-label="Send voice message"
            className="rounded-full"
          >
            <SendHorizonal className="h-5 w-5" />
          </Button>
        ) : draft.trim() || attachment || editing ? (
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            aria-label="Send"
            className="rounded-full"
          >
            <SendHorizonal className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={startRecording}
            disabled={uploading}
            aria-label="Record voice message"
            className="rounded-full"
          >
            {uploading ? <Spinner className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </div>
  );
}
