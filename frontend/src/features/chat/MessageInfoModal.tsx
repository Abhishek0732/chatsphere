import { useQuery } from '@tanstack/react-query';
import { Check, CheckCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { getMessageInfo } from '@/api/conversations';
import { queryKeys } from '@/api/queryKeys';
import { fileNameFromUrl, formatTime } from '@/utils/format';
import type { Message, User } from '@/types';
import { SkeletonList } from '@/components/ui/Skeleton';

function preview(m: Message): string {
  if (m.type === 'IMAGE') return m.content ? `📷 ${m.content}` : '📷 Photo';
  if (m.type === 'FILE') return m.content || `📎 ${fileNameFromUrl(m.attachmentUrl)}`;
  return m.content || '';
}

function PeopleList({ people }: { people: User[] }) {
  return (
    <ul className="mt-1 space-y-1">
      {people.map((u) => (
        <li key={u.id} className="flex items-center gap-2.5 py-1">
          <Avatar name={u.displayName} src={u.avatarUrl} size="sm" className="h-8 w-8 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{u.displayName}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * WhatsApp-style "Message info": which group members have opened the chat past
 * this message (Read by) and which haven't yet (Delivered to). Read state comes
 * from each member's read pointer, so it stays accurate as people catch up —
 * the modal refetches while it's open.
 */
export function MessageInfoModal({
  message,
  onClose,
}: {
  message: Message | null;
  onClose: () => void;
}) {
  const open = Boolean(message);
  const { data, isLoading } = useQuery({
    queryKey: message
      ? queryKeys.messageInfo(message.conversationId, message.id)
      : ['messageInfo', 'none'],
    queryFn: () => getMessageInfo(message!.conversationId, message!.id),
    enabled: open,
    refetchInterval: open ? 5000 : false,
    staleTime: 0,
  });

  return (
    <Modal open={open} onClose={onClose} title="Message info">
      {message && (
        <div className="mb-4 rounded-xl bg-surface-container-high px-3 py-2">
          <p className="line-clamp-3 text-sm text-on-surface [overflow-wrap:anywhere]">
            {preview(message) || 'Message'}
          </p>
          <p className="mt-1 text-right text-[10px] text-on-surface-variant">
            {formatTime(message.createdAt)}
          </p>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : (
        <div className="space-y-4">
          <section>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <CheckCheck className="h-4 w-4" /> Read by {data?.readBy.length ?? 0}
            </p>
            {data && data.readBy.length > 0 ? (
              <PeopleList people={data.readBy} />
            ) : (
              <p className="mt-1 text-sm text-on-surface-variant">No one has read this yet.</p>
            )}
          </section>

          <section>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <Check className="h-4 w-4" /> Delivered to {data?.pending.length ?? 0}
            </p>
            {data && data.pending.length > 0 ? (
              <PeopleList people={data.pending} />
            ) : (
              <p className="mt-1 text-sm text-on-surface-variant">Everyone has read this.</p>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
