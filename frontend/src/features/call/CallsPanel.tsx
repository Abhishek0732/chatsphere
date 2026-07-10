import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Phone, PhoneCall, Search, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { Logo } from '@/components/ui/Logo';
import { useCallHistory } from '@/hooks/useCalls';
import { socketService } from '@/services/socket';
import { cn } from '@/utils/cn';
import type { CallHistoryItem } from '@/types';

function isMissed(item: CallHistoryItem): boolean {
  return item.status === 'MISSED' || (!item.outgoing && item.status === 'CANCELLED');
}

/** "Today, 09:12 AM" / "Yesterday, 06:15 PM" / "Oct 24, 02:45 PM". */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  const yst = new Date(now);
  yst.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yst.toDateString();
  const day = sameDay ? 'Today' : isYesterday ? 'Yesterday' : d.toLocaleDateString([], { month: 'short', day: '2-digit' });
  return `${day}, ${time}`;
}

function CallRow({ item }: { item: CallHistoryItem }) {
  const missed = isMissed(item);
  const Arrow = item.outgoing ? ArrowUpRight : ArrowDownLeft;
  const arrowColor = missed ? 'text-error' : item.outgoing ? 'text-primary' : 'text-green-500';
  const CallIcon = item.type === 'VIDEO' ? Video : Phone;

  const callBack = () =>
    socketService.startCall(
      { id: item.counterpartId, name: item.counterpartName ?? 'Unknown', avatarUrl: item.counterpartAvatarUrl },
      item.type,
      item.conversationId ?? undefined,
    );

  return (
    <div className="glass-card flex items-center gap-3 rounded-xl p-3">
      <Avatar name={item.counterpartName ?? '?'} src={item.counterpartAvatarUrl} className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-lg font-semibold', missed ? 'text-error' : 'text-on-surface')}>
          {item.counterpartName ?? 'Unknown'}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
          <Arrow className={cn('h-4 w-4 shrink-0', arrowColor)} />
          {whenLabel(item.createdAt)}
        </p>
      </div>
      <button
        onClick={callBack}
        aria-label={`Call ${item.counterpartName ?? ''} back`}
        className="shrink-0 rounded-full p-2 text-primary transition hover:bg-primary/10 active:scale-90"
      >
        <CallIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export function CallsPanel() {
  const { data, isLoading } = useCallHistory();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'missed'>('all');

  const items = data ?? [];
  const filtered = tab === 'missed' ? items.filter(isMissed) : items;

  return (
    <div className="relative min-h-full bg-surface pb-24 text-on-surface">
      <header className="glass-panel sticky top-0 z-20 flex h-16 items-center justify-between border-x-0 border-t-0 px-5">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8 shadow ring-1 ring-white/10" />
          <h1 className="text-2xl font-bold tracking-tight text-primary">ChatSphere</h1>
        </div>
        <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-white/5" aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
      </header>

      {/* Tabs */}
      <div className="mx-auto flex max-w-lg gap-6 px-5 pt-4">
        {(['all', 'missed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative pb-2 text-sm font-medium capitalize transition-colors',
              tab === t ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <main className="mx-auto max-w-lg space-y-2.5 px-5 pt-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-on-surface-variant">
              <PhoneCall className="h-6 w-6" />
            </span>
            <p className="text-sm text-on-surface-variant">
              {tab === 'missed' ? 'No missed calls' : 'No calls yet — start one from any chat.'}
            </p>
          </div>
        ) : (
          filtered.map((c) => <CallRow key={c.callId} item={c} />)
        )}
      </main>

      {/* New-call FAB */}
      <button
        onClick={() => navigate('/contacts')}
        aria-label="New call"
        className="message-gradient-sent fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full text-on-primary shadow-lg transition active:scale-90 md:bottom-8"
      >
        <PhoneCall className="h-6 w-6" />
      </button>
    </div>
  );
}
