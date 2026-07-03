import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Message } from '@/types';

/** WhatsApp-style delivery ticks: single, double, blue double. */
export function MessageStatusTicks({ message }: { message: Message }) {
  if (message.failed) {
    return <span className="text-[10px] font-medium text-red-400">failed</span>;
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
