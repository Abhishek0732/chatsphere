import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useConversations } from '@/hooks/useConversations';
import { ConversationListItem } from './ConversationListItem';

export function ConversationList() {
  const { data, isLoading } = useConversations();
  const [term, setTerm] = useState('');

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = term.trim().toLowerCase();
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.lastMessage?.createdAt ?? b.updatedAt).getTime() -
        new Date(a.lastMessage?.createdAt ?? a.updatedAt).getTime(),
    );
    if (!q) return sorted;
    return sorted.filter((c) => c.name.toLowerCase().includes(q));
  }, [data, term]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search chats"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            {term ? 'No matches' : 'No conversations yet. Start one from Contacts.'}
          </p>
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
