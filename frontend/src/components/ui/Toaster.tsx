import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const icons: Record<ToastVariant, ReactNode> = {
  default: <Info className="h-5 w-5 text-slate-400" />,
  info: <Info className="h-5 w-5 text-sky-500" />,
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const navigate = useNavigate();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-3 shadow-lg animate-slide-up dark:border-slate-700 dark:bg-slate-800',
            t.href && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/70',
          )}
          onClick={() => {
            if (t.href) {
              navigate(t.href);
              dismiss(t.id);
            }
          }}
        >
          <div className="mt-0.5">{icons[t.variant]}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {t.description}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
