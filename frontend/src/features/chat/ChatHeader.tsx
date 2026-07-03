import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eraser, MoreVertical, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { useClearChat } from '@/hooks/useConversations';
import { formatLastSeen } from '@/utils/format';
import type { ConversationSummary } from '@/types';
import { otherMember } from './utils';

// Stable empty reference (see TypingIndicator): a fresh `[]` from a zustand
// selector triggers an infinite re-render loop under useSyncExternalStore.
const NO_TYPERS: { userId: number; userName: string }[] = [];

interface ChatHeaderProps {
  conversation: ConversationSummary;
  onOpenInfo?: () => void;
}

export function ChatHeader({ conversation, onOpenInfo }: ChatHeaderProps) {
  const navigate = useNavigate();
  const myId = useAuthStore((s) => s.user?.id);
  const other = otherMember(conversation, myId);
  const openViewer = useImageViewer((s) => s.open);
  const clearChat = useClearChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const presence = useChatStore((s) => (other ? s.presence[other.id] : undefined));
  const typers = useChatStore((s) => s.typing[conversation.id] ?? NO_TYPERS);
  const someoneTyping = typers.some((t) => t.userId !== myId);

  const handleClear = () => {
    setMenuOpen(false);
    const label = conversation.type === 'GROUP' ? 'this group' : conversation.name;
    if (window.confirm(`Clear all messages with ${label}? The chat stays in your list.`)) {
      clearChat.mutate(conversation.id);
    }
  };

  let subtitle: string;
  if (conversation.type === 'GROUP') {
    subtitle = `${conversation.members.length} members`;
  } else if (someoneTyping) {
    subtitle = 'typing…';
  } else if (presence?.online) {
    subtitle = 'online';
  } else {
    subtitle = formatLastSeen(presence?.lastSeen ?? other?.lastSeen);
  }

  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={() => navigate('/')}
        className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
          name={conversation.name}
          src={conversation.avatarUrl}
          size="md"
          onClick={() => openViewer(conversation.name, conversation.avatarUrl)}
        />
        <button
          className="min-w-0 flex-1 text-left"
          onClick={onOpenInfo}
          disabled={!onOpenInfo}
        >
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
            {conversation.name}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </button>
      </div>

      {conversation.type === 'GROUP' && (
        <button
          onClick={onOpenInfo}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Group info"
        >
          <Users className="h-5 w-5" />
        </button>
      )}

      {/* Top-right options menu → Clear chat */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Chat options"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={handleClear}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Eraser className="h-4 w-4" /> Clear chat
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
