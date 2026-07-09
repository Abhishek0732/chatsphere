import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
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
 * A colored icon badge, a title, an optional one-line message, and balanced
 * Cancel / Confirm buttons. No header or close icon.
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
    <Modal open={open} onClose={onClose} className="max-w-xs">
      <div className="flex flex-col items-center px-1 pb-1 pt-2 text-center">
        <div
          className={cn(
            'mb-4 flex h-14 w-14 items-center justify-center rounded-full',
            danger ? 'bg-error/15 text-error' : 'bg-primary/15 text-primary',
          )}
        >
          {icon ?? <AlertTriangle className="h-7 w-7" />}
        </div>

        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        {message && (
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{message}</p>
        )}

        <div className="mt-6 flex w-full gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            className="flex-1"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
