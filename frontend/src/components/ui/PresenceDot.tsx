import { cn } from '@/utils/cn';

export interface PresenceDotProps {
  online: boolean;
  className?: string;
}

/**
 * The green "online" dot. It renders ONLY when the person is online — there is no
 * grey "offline" dot. That keeps presence a positive signal, and a contact whose
 * last-seen is hidden (or who is simply offline) shows nothing at all rather than
 * leaking their offline state.
 */
export function PresenceDot({ online, className }: PresenceDotProps) {
  if (!online) return null;
  return (
    <span
      title="Online"
      className={cn(
        'inline-block h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900',
        className,
      )}
    />
  );
}
