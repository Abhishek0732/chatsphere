import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { deleteMyAccount } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/services/queryClient';
import { socketService } from '@/services/socket';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/utils/apiError';
import { useResetOnClose } from '@/hooks/useResetOnClose';

/** Typed exactly, so this can't happen by accident on an unlocked phone. */
const CONFIRM_WORD = 'DELETE';

/**
 * Deleting an account is irreversible, so the flow deliberately has friction:
 * the person must re-enter their password AND type DELETE. It also says plainly
 * what will and won't happen — in particular that their username and email are
 * retired for good, and that messages they already sent stay in other people's
 * chats (removing them would tear holes in someone else's history).
 */
export function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const logoutLocal = useAuthStore((s) => s.logout);

  useResetOnClose(open, () => {
    setPassword('');
    setConfirm('');
  });

  const remove = useMutation({
    mutationFn: () => deleteMyAccount(password),
    onSuccess: () => {
      socketService.disconnect();
      logoutLocal();
      queryClient.clear();
      toast({ title: 'Your account has been deleted', variant: 'default' });
    },
    onError: (e) =>
      toast({ title: apiErrorMessage(e, 'Could not delete your account'), variant: 'error' }),
  });

  const armed = password.length > 0 && confirm.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <Modal open={open} onClose={onClose} title="Delete account">
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl bg-error/10 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
          <p className="text-sm text-on-surface">
            This cannot be undone. Your account is closed immediately and you are signed out
            everywhere.
          </p>
        </div>

        <ul className="space-y-1.5 text-sm text-on-surface-variant">
          <li>• Your profile, photo, contacts, groups and status updates are deleted.</li>
          <li>
            • Your username and email are <span className="font-medium text-on-surface">retired
            permanently</span> — they cannot be used to sign up again.
          </li>
          <li>
            • Messages you already sent stay in other people’s chats, shown as{' '}
            <span className="font-medium text-on-surface">“Deleted user”</span>. Removing them
            would tear holes in their conversations.
          </li>
        </ul>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-on-surface-variant">
              Confirm your password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Your password"
              className="w-full rounded-xl border border-white/10 bg-surface-container-high px-3.5 py-2.5 text-sm text-on-surface focus:border-error focus:outline-none focus:ring-2 focus:ring-error/30"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-on-surface-variant">
              Type <span className="font-semibold text-error">{CONFIRM_WORD}</span> to confirm
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_WORD}
              className="w-full rounded-xl border border-white/10 bg-surface-container-high px-3.5 py-2.5 text-sm tracking-widest text-on-surface focus:border-error focus:outline-none focus:ring-2 focus:ring-error/30"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            Keep my account
          </Button>
          <button
            onClick={() => remove.mutate()}
            disabled={!armed || remove.isPending}
            className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remove.isPending ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
