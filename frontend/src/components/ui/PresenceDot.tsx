import { cn } from '@/utils/cn';

export interface PresenceDotProps {
  online: boolean;
  className?: string;
}

export function PresenceDot({ online, className }: PresenceDotProps) {
  return (
    <span
      title={online ? 'Online' : 'Offline'}
      className={cn(
        'inline-block h-3 w-3 rounded-full border-2 border-white dark:border-slate-900',
        online ? 'bg-emerald-500' : 'bg-slate-400',
        className,
      )}
    />
  );
}
