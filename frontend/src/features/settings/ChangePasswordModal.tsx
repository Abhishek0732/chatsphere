import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { changePassword } from '@/api/auth';
import { rewrapForNewPassword } from '@/services/e2ee';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/utils/apiError';
import { changePasswordSchema, type ChangePasswordValues } from '@/features/auth/schemas';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-3.5 pr-11 text-sm text-on-surface placeholder:text-on-surface-variant/70 transition-all focus:border-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50';

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  // Clear the fields whenever the modal is (re)opened.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const change = useMutation({
    mutationFn: async (v: ChangePasswordValues) => {
      await changePassword(v.currentPassword, v.newPassword);
      // Re-wrap the encryption key under the NEW password. The private key is stored
      // wrapped by a key derived from the password, so without this the user would
      // lock themselves out of their own encrypted history simply by changing it.
      // The key pair itself is unchanged, so nothing anyone else can read is affected.
      await rewrapForNewPassword(v.newPassword);
    },
    onSuccess: () => {
      toast({ title: 'Password changed', variant: 'success' });
      onClose();
    },
    onError: (err) => toast({ title: apiErrorMessage(err, 'Could not change password'), variant: 'error' }),
  });

  const err = (name: keyof ChangePasswordValues) =>
    errors[name]?.message ? <p className="mt-1 pl-1 text-xs text-error">{errors[name]?.message}</p> : null;

  return (
    <Modal open={open} onClose={onClose} title="Change password">
      <form onSubmit={handleSubmit((v) => change.mutate(v))} className="space-y-4">
        <p className="text-sm text-on-surface-variant">
          For your security, you'll be signed out of other devices after changing your password.
        </p>

        <div>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Current password"
              className={inputClass}
              {...register('currentPassword')}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
              aria-label={show ? 'Hide passwords' : 'Show passwords'}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {err('currentPassword')}
        </div>

        <div>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="New password"
            className={inputClass}
            {...register('newPassword')}
          />
          {err('newPassword')}
        </div>

        <div>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className={inputClass}
            {...register('confirmPassword')}
          />
          {err('confirmPassword')}
        </div>

        <button
          type="submit"
          disabled={change.isPending}
          className="glow-button w-full rounded-xl bg-primary-container py-3 text-base font-semibold text-on-primary-container transition-all active:scale-95 disabled:opacity-70"
        >
          {change.isPending ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Modal>
  );
}
