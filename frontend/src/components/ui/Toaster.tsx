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
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex animate-slide-down items-start gap-3 rounded-xl border border-white/10 bg-surface-container/95 p-3 text-on-surface shadow-2xl backdrop-blur-xl',
            t.href && 'cursor-pointer hover:bg-surface-container-high',
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
            <p className="text-sm font-medium text-on-surface">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 truncate text-xs text-on-surface-variant">{t.description}</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
            className="rounded p-0.5 text-on-surface-variant hover:text-on-surface"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
