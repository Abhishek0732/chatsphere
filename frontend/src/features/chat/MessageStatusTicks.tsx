import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Message } from '@/types';

/** messenger-style delivery ticks: single, double, blue double. */
export function MessageStatusTicks({ message }: { message: Message }) {
  if (message.failed) {
    return <span className="text-[10px] font-medium text-red-400">failed</span>;
  }
  // Typed while offline: it is WAITING, not lost. It goes out by itself the
  // moment the connection is back, so say so rather than showing a bare clock
  // that looks identical to an ordinary in-flight message.
  if (message.queued) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
        <Clock className="h-3 w-3" />
        waiting
      </span>
    );
  }
  // Optimistic (still sending): clock.
  if (message.tempId && message.id < 0) {
    return <Clock className="h-3.5 w-3.5 text-slate-400" />;
  }
  switch (message.status) {
    case 'SENT':
      return <Check className="h-3.5 w-3.5 text-slate-400" />;
    case 'DELIVERED':
      return <CheckCheck className="h-3.5 w-3.5 text-slate-400" />;
    case 'READ':
      return <CheckCheck className={cn('h-3.5 w-3.5 text-sky-400')} />;
    default:
      return null;
  }
}
