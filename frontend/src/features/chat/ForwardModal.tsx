import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
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
  const navigate = useNavigate();

  const forwardTo = (targetId: number, publicId: string) => {
    if (!message) return;
    send({
      conversationId: targetId,
      content: message.content,
      type: message.type,
      attachmentUrl: message.attachmentUrl,
    });
    toast({ title: 'Message forwarded', variant: 'success' });
    onClose();
    navigate(`/chat/${publicId}`);
  };

  return (
    <Modal open={message != null} onClose={onClose} title="Forward to">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No conversations available.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => forwardTo(c.id, c.publicId)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar name={c.name} src={c.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.type === 'GROUP' ? 'Group' : 'Direct message'}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
