import { ArrowDownLeft, ArrowUpRight, Phone, PhoneCall, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useCallHistory } from '@/hooks/useCalls';
import { socketService } from '@/services/socket';
import { cn } from '@/utils/cn';
import { formatListTimestamp } from '@/utils/format';
import type { CallHistoryItem } from '@/types';

/** "7s" / "1:07" / "1:02:03" — call duration for connected calls. */
function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}s`;
}

/** A red "missed" call = an incoming call the user never picked up. */
function isMissed(item: CallHistoryItem): boolean {
  return item.status === 'MISSED' || (!item.outgoing && item.status === 'CANCELLED');
}

/** WhatsApp-style outcome label under the name. */
function outcomeLabel(item: CallHistoryItem): string {
  if (item.status === 'ENDED') {
    const d = formatDuration(item.durationSeconds);
    const dir = item.outgoing ? 'Outgoing' : 'Incoming';
    return d ? `${dir} · ${d}` : dir;
  }
  if (item.status === 'MISSED') return 'Missed';
  if (item.status === 'DECLINED') return 'Declined';
  if (item.status === 'CANCELLED') return item.outgoing ? 'Cancelled' : 'Missed';
  if (item.status === 'FAILED') return 'Not answered';
  return item.outgoing ? 'Outgoing' : 'Incoming';
}

function CallRow({ item }: { item: CallHistoryItem }) {
  const missed = isMissed(item);
  const Arrow = item.outgoing ? ArrowUpRight : ArrowDownLeft;
  const CallIcon = item.type === 'VIDEO' ? Video : Phone;

  const callBack = () => {
    socketService.startCall(
      {
        id: item.counterpartId,
        name: item.counterpartName ?? 'Unknown',
        avatarUrl: item.counterpartAvatarUrl,
      },
      item.type,
      item.conversationId ?? undefined,
    );
  };

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Avatar name={item.counterpartName ?? '?'} src={item.counterpartAvatarUrl} size="lg" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'truncate font-medium',
              missed ? 'text-rose-500' : 'text-slate-900 dark:text-slate-50',
            )}
          >
            {item.counterpartName ?? 'Unknown'}
          </p>
          <span className="shrink-0 text-xs text-slate-400">
            {formatListTimestamp(item.createdAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Arrow
            className={cn('h-4 w-4 shrink-0', missed ? 'text-rose-500' : 'text-emerald-500')}
          />
          <span className="truncate">{outcomeLabel(item)}</span>
        </div>
      </div>

      <button
        onClick={callBack}
        aria-label={`Call ${item.counterpartName ?? ''} back`}
        className="ml-1 shrink-0 rounded-full p-2 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-white/5"
      >
        <CallIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export function CallsPanel() {
  const { data, isLoading } = useCallHistory();

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
      <h1 className="mb-3 px-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        Calls
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5">
            <PhoneCall className="h-6 w-6" />
          </span>
          <p className="text-sm text-slate-400">
            No calls yet — start a voice call from any chat.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-elevated dark:border-white/10 dark:bg-[#111a2b]">
          <div className="divide-y divide-slate-200/60 dark:divide-white/5">
            {data.map((c) => (
              <CallRow key={c.callId} item={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
