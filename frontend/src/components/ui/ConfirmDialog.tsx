import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { cn } from '@/utils/cn';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Optional icon shown in the badge; defaults to a warning triangle. */
  icon?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * In-app confirmation dialog — a clean, themed replacement for window.confirm().
 * A soft icon badge, a title, an optional one-line message, and balanced
 * Cancel / Confirm buttons styled with the design tokens (glass + gradient/error).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  icon,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <div className="flex flex-col items-center px-2 pb-1 pt-3 text-center">
        <div
          className={cn(
            'mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-8',
            danger ? 'bg-error/15 text-error ring-error/5' : 'bg-primary/15 text-primary ring-primary/5',
          )}
        >
          {icon ?? <AlertTriangle className="h-8 w-8" />}
        </div>

        <h2 className="text-xl font-bold text-on-surface">{title}</h2>
        {message && (
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{message}</p>
        )}

        <div className="mt-7 flex w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl glass-panel py-3 text-sm font-semibold text-on-surface transition hover:bg-white/5 active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              'flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.97]',
              danger
                ? 'bg-gradient-to-br from-red-500 to-red-600'
                : 'bg-primary-container text-on-primary-container',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
