import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, SquarePen } from 'lucide-react';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Logo } from '@/components/ui/Logo';
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
    <div className="relative flex h-full flex-col bg-surface-container-lowest">
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 shadow ring-1 ring-white/10" />
            <h1 className="text-2xl font-bold tracking-tight text-primary">ChatSphere</h1>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20 active:scale-90"
            aria-label="New chat"
          >
            <SquarePen className="h-5 w-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-full border-none bg-surface-container-high py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-1 focus:ring-primary/50"
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
                  ? 'bg-primary/20 text-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4 cs-scroll">
        {isLoading ? (
          <SkeletonList rows={8} />
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-on-surface-variant">{emptyText}</p>
        ) : (
          filtered.map((c) => <ConversationListItem key={c.id} conversation={c} />)
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
