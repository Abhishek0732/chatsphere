import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-gradient px-1.5 py-0.5 text-xs font-semibold text-white shadow-sm',
        className,
      )}
    >
      {children}
    </span>
  );
}
