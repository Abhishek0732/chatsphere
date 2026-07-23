import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';

export interface DeleteMessageDialogProps {
  open: boolean;
  /** Show "Delete for everyone" — only for your own, not-yet-deleted message. */
  canDeleteForEveryone: boolean;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
  onClose: () => void;
}

/**
 * Message-level delete prompt, mirroring {@link DeleteChatDialog}. Your own
 * message offers "Delete for everyone" + "Delete for me"; anyone else's (or an
 * already-deleted tombstone) offers only "Delete for me". Each action then closes.
 */
export function DeleteMessageDialog({
  open,
  canDeleteForEveryone,
  onDeleteForEveryone,
  onDeleteForMe,
  onClose,
}: DeleteMessageDialogProps) {
  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <div className="flex flex-col items-center px-2 pb-1 pt-3 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-error/15 text-error ring-8 ring-error/5">
          <Trash2 className="h-8 w-8" />
        </div>

        <h2 className="text-xl font-bold text-on-surface">Delete message?</h2>

        <div className="mt-7 flex w-full flex-col gap-3">
          {canDeleteForEveryone && (
            <button
              type="button"
              onClick={run(onDeleteForEveryone)}
              className="w-full rounded-xl bg-gradient-to-br from-red-500 to-red-600 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.97]"
            >
              Delete for everyone
            </button>
          )}
          <button
            type="button"
            onClick={run(onDeleteForMe)}
            className="w-full rounded-xl border border-error/40 py-3 text-sm font-semibold text-error transition hover:bg-error/10 active:scale-[0.97]"
          >
            Delete for me
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl glass-panel py-3 text-sm font-semibold text-on-surface transition hover:bg-white/5 active:scale-[0.97]"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
