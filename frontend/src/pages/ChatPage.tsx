import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageThread } from '@/features/chat/MessageThread';
import { Spinner } from '@/components/ui/Spinner';
import { useConversations } from '@/hooks/useConversations';

export function ChatPage() {
  const { chatKey } = useParams<{ chatKey: string }>();
  const { data: conversations, isLoading } = useConversations();
  const navigate = useNavigate();

  // The URL carries the opaque publicId. We also tolerate a numeric id
  // (old bookmarks / notification links) and canonicalise it to the public one.
  const conversation = (conversations ?? []).find(
    (c) => c.publicId === chatKey || String(c.id) === chatKey,
  );

  // If we arrived via a numeric id, replace the URL with the opaque one so the
  // numeric id never lingers in the address bar.
  useEffect(() => {
    if (conversation && conversation.publicId !== chatKey) {
      navigate(`/chat/${conversation.publicId}`, { replace: true });
    }
  }, [conversation, chatKey, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Unknown/guessed key, or a conversation the user isn't a member of: the list
  // (which is authorised server-side) simply won't contain it.
  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Conversation not found.
      </div>
    );
  }

  // Remount the thread when the conversation changes so all local state resets.
  return <MessageThread key={conversation.id} conversationId={conversation.id} />;
}
