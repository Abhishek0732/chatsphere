import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Eraser, MoreVertical, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { useClearChat } from '@/hooks/useConversations';
import { formatListTimestamp } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { ConversationSummary } from '@/types';
import { lastMessagePreview, otherMember } from './utils';

export function ConversationListItem({ conversation }: { conversation: ConversationSummary }) {
  const myId = useAuthStore((s) => s.user?.id);
  const other = otherMember(conversation, myId);
  const online = useChatStore((s) => (other ? Boolean(s.presence[other.id]?.online) : false));
  const openViewer = useImageViewer((s) => s.open);
  const clearChat = useClearChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    const label = conversation.type === 'GROUP' ? 'this group' : conversation.name;
    if (window.confirm(`Clear all messages with ${label}? The chat stays in your list.`)) {
      clearChat.mutate(conversation.id);
    }
  };

  return (
    <div ref={wrapRef} className="group relative">
      <NavLink
        to={`/chat/${conversation.publicId}`}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-3 transition-colors',
            isActive
              ? 'bg-slate-100 dark:bg-slate-800'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
          )
        }
      >
        <div className="relative">
          <Avatar
            name={conversation.name}
            src={conversation.avatarUrl}
            size="lg"
            onClick={(e) => {
              // Don't follow the NavLink — open the picture instead.
              e.preventDefault();
              e.stopPropagation();
              openViewer(conversation.name, conversation.avatarUrl);
            }}
          />
          {conversation.type === 'GROUP' ? (
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-slate-200 p-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <Users className="h-3 w-3" />
            </span>
          ) : (
            other && <PresenceDot online={online} className="absolute bottom-0 right-0" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-slate-900 dark:text-slate-100">
              {conversation.name}
            </span>
            <span className="shrink-0 text-xs text-slate-400 group-hover:invisible">
              {formatListTimestamp(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm text-slate-500 dark:text-slate-400">
              {lastMessagePreview(conversation)}
            </span>
            {conversation.unreadCount > 0 && <Badge>{conversation.unreadCount}</Badge>}
          </div>
        </div>
      </NavLink>

      {/* Hover kebab → delete chat. Sits over the (hidden) timestamp slot. */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
        className={cn(
          'absolute right-2 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-slate-500 opacity-0 transition hover:bg-slate-200 group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-slate-700',
          menuOpen && 'opacity-100',
        )}
        aria-label="Chat options"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {menuOpen && (
        <div className="absolute right-2 top-10 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={handleClear}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Eraser className="h-4 w-4" /> Clear chat
          </button>
        </div>
      )}
    </div>
  );
}
