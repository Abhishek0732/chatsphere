import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useConversations } from '@/hooks/useConversations';
import { cn } from '@/utils/cn';
import { ConversationListItem } from './ConversationListItem';

type Filter = 'all' | 'unread' | 'groups';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
];

export function ConversationList() {
  const { data, isLoading } = useConversations();
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = term.trim().toLowerCase();
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.lastMessage?.createdAt ?? b.updatedAt).getTime() -
        new Date(a.lastMessage?.createdAt ?? a.updatedAt).getTime(),
    );
    return sorted.filter((c) => {
      if (filter === 'unread' && c.unreadCount === 0) return false;
      if (filter === 'groups' && c.type !== 'GROUP') return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, term, filter]);

  const emptyText =
    term
      ? 'No matches'
      : filter === 'unread'
        ? 'No unread chats'
        : filter === 'groups'
          ? 'No groups yet'
          : 'No conversations yet. Start one from Contacts.';

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
              <MessageCircle className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-brand-gradient">ChatSphere</h1>
          </div>
          <button
            onClick={() => navigate('/contacts')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-white shadow-sm transition hover:shadow-glow active:scale-95"
            aria-label="New chat"
          >
            <Plus className="h-5 w-5" />
          </button>
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
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filtered.map((c) => (
              <ConversationListItem key={c.id} conversation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
