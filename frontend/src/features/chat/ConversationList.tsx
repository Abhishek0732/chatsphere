import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { Spinner } from '@/components/ui/Spinner';
import { useConversations } from '@/hooks/useConversations';
import { socketService } from '@/services/socket';
import { cn } from '@/utils/cn';
import { AddContactModal } from '@/features/contacts/AddContactModal';
import { ConversationListItem } from './ConversationListItem';

type Filter = 'all' | 'unread' | 'groups';

// Cap how many conversations keep a live "typing…" subscription open at once.
const TYPING_SUB_LIMIT = 40;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
];

export function ConversationList() {
  const { data, isLoading } = useConversations();
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);

  // Sort once (most-recent first); both the filtered view and the typing-sub
  // list derive from this instead of each re-sorting the whole array.
  const sorted = useMemo(() => {
    const list = data ?? [];
    return [...list].sort(
      (a, b) =>
        new Date(b.lastMessage?.createdAt ?? b.updatedAt).getTime() -
        new Date(a.lastMessage?.createdAt ?? a.updatedAt).getTime(),
    );
  }, [data]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return sorted.filter((c) => {
      if (filter === 'unread' && c.unreadCount === 0) return false;
      if (filter === 'groups' && c.type !== 'GROUP') return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, term, filter]);

  // Keep a live typing subscription open only for the most-recent conversations,
  // so the sidebar can show "typing…" without opening one STOMP subscription per
  // chat — a user with thousands of chats would otherwise flood the broker.
  const typingSubIds = useMemo(
    () => sorted.slice(0, TYPING_SUB_LIMIT).map((c) => c.id),
    [sorted],
  );
  const convIdsKey = typingSubIds.join(',');
  useEffect(() => {
    socketService.syncTypingSubs(typingSubIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convIdsKey]);

  const emptyText =
    term
      ? 'No matches'
      : filter === 'unread'
        ? 'No unread chats'
        : filter === 'groups'
          ? 'No groups yet'
          : 'No conversations yet. Start one from Contacts.';

  return (
    <div className="relative flex h-full flex-col">
      <div className="space-y-3 border-b border-white/40 p-3 dark:border-white/5">
        <div className="flex items-center gap-2 px-1">
          <Logo className="h-8 w-8 shadow-sm" />
          <h1 className="text-lg font-bold tracking-tight text-brand-gradient">ChatSphere</h1>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search chats"
            className="pl-9"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                filter === f.key
                  ? 'bg-brand-gradient text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">{emptyText}</p>
        ) : (
          <div className="divide-y divide-slate-200/40 dark:divide-white/5">
            {filtered.map((c) => (
              <ConversationListItem key={c.id} conversation={c} />
            ))}
          </div>
        )}
      </div>

      {/* Floating "new chat" button (WhatsApp-style), bottom-right of the list. */}
      <button
        onClick={() => setAddOpen(true)}
        className="absolute bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:brightness-110 active:scale-95"
        aria-label="New chat"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddContactModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
