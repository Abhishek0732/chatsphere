import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { useConversations } from '@/hooks/useConversations';
import { useSendMessage } from '@/hooks/useSendMessage';
import { toast } from '@/store/toastStore';
import type { Message } from '@/types';

interface ForwardModalProps {
  message: Message | null;
  onClose: () => void;
}

export function ForwardModal({ message, onClose }: ForwardModalProps) {
  const { data: conversations, isLoading } = useConversations();
  const send = useSendMessage();
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Reset the picker each time the modal is opened for a new message.
  const open = message != null;
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setTerm('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = conversations ?? [];
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [conversations, term]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleForward = () => {
    if (!message || selected.size === 0) return;
    const targets = (conversations ?? []).filter((c) => selected.has(c.id));
    targets.forEach((c) => {
      send({
        conversationId: c.id,
        content: message.content,
        type: message.type,
        attachmentUrl: message.attachmentUrl,
      });
    });
    toast({
      title:
        targets.length === 1
          ? 'Message forwarded'
          : `Message forwarded to ${targets.length} chats`,
      variant: 'success',
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Forward to"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleForward} disabled={selected.size === 0}>
            {selected.size > 0 ? `Send (${selected.size})` : 'Send'}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">No conversations available.</p>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-on-surface focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">No chats found.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
              {filtered.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => toggle(c.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition',
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-500/10'
                          : 'hover:bg-white/5',
                      )}
                    >
                      <Avatar name={c.name} src={c.avatarUrl} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {c.type === 'GROUP' ? 'Group' : 'Direct message'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                          isSelected
                            ? 'border-brand-500 bg-brand-gradient text-white'
                            : 'border-white/20',
                        )}
                        aria-hidden
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
