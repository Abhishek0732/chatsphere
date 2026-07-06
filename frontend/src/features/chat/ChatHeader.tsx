import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban, Eraser, LogOut, MoreVertical, UserCheck, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { useClearChat } from '@/hooks/useConversations';
import { useLeaveGroup } from '@/hooks/useGroups';
import { useBlockUser, useIsBlocked, useUnblockUser } from '@/hooks/useBlocks';
import { formatLastSeen } from '@/utils/format';
import type { ConversationSummary } from '@/types';
import { otherMember } from './utils';

// Stable empty reference: a fresh `[]` from a zustand selector triggers an
// infinite re-render loop under useSyncExternalStore.
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
  const leaveGroup = useLeaveGroup();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const isBlocked = useIsBlocked(other?.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    onConfirm: () => void;
  } | null>(null);
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
  const otherTypers = typers.filter((t) => t.userId !== myId);
  const someoneTyping = otherTypers.length > 0;
  // In groups, knowing WHO is typing matters; in a direct chat the name is
  // already shown above, so a plain "typing…" is enough.
  const typingLabel =
    conversation.type === 'GROUP'
      ? otherTypers.length === 1
        ? `${otherTypers[0].userName} is typing…`
        : `${otherTypers.map((t) => t.userName).join(', ')} are typing…`
      : 'typing…';

  const handleClear = () => {
    setMenuOpen(false);
    const label = conversation.type === 'GROUP' ? 'this group' : conversation.name;
    setConfirm({
      title: 'Clear chat',
      message: `Clear all messages with ${label}? The chat stays in your list.`,
      confirmLabel: 'Clear',
      danger: true,
      onConfirm: () => clearChat.mutate(conversation.id),
    });
  };

  const handleLeave = () => {
    setMenuOpen(false);
    setConfirm({
      title: 'Leave group',
      message: `Leave "${conversation.name}"? You'll stop receiving its messages.`,
      confirmLabel: 'Leave',
      danger: true,
      onConfirm: () => leaveGroup.mutate(conversation.id),
    });
  };

  const handleBlockToggle = () => {
    setMenuOpen(false);
    if (!other) return;
    if (isBlocked) {
      unblockUser.mutate(other);
    } else {
      setConfirm({
        title: `Block ${other.displayName}?`,
        message: `You'll stop receiving their messages, and their profile photo and status will be hidden.`,
        confirmLabel: 'Block',
        danger: true,
        onConfirm: () => blockUser.mutate(other),
      });
    }
  };

  let subtitle: string;
  if (conversation.type === 'DIRECT' && isBlocked) {
    subtitle = 'Blocked';
  } else if (someoneTyping) {
    subtitle = typingLabel;
  } else if (conversation.type === 'GROUP') {
    subtitle = `${conversation.members.length} members`;
  } else if (presence?.online) {
    subtitle = 'online';
  } else {
    subtitle = formatLastSeen(presence?.lastSeen ?? other?.lastSeen);
  }

  return (
    <header className="relative z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-3 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
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
          className="ring-2 ring-brand-500/20 transition hover:ring-brand-500/50"
          onClick={() => openViewer(conversation.name, conversation.avatarUrl, { circle: true })}
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
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Eraser className="h-4 w-4" /> Clear chat
            </button>
            {conversation.type === 'GROUP' && (
              <button
                onClick={handleLeave}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-4 w-4" /> Leave group
              </button>
            )}
            {conversation.type === 'DIRECT' &&
              other &&
              (isBlocked ? (
                <button
                  onClick={handleBlockToggle}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <UserCheck className="h-4 w-4" /> Unblock
                </button>
              ) : (
                <button
                  onClick={handleBlockToggle}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Ban className="h-4 w-4" /> Block
                </button>
              ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm != null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />
    </header>
  );
}
