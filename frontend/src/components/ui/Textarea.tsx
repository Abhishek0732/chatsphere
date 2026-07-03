import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, ...props },
  ref,
) {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition',
          'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500',
          'dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
          error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
});
