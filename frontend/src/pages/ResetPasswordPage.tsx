import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { resetPassword } from '@/api/auth';
import { Logo } from '@/components/ui/Logo';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/utils/apiError';
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/schemas';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-11 text-sm text-on-surface placeholder:text-on-surface-variant/70 transition-all focus:border-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const reset = useMutation({
    mutationFn: (password: string) => resetPassword(token, password),
    onSuccess: () => {
      toast({ title: 'Password updated', description: 'You can now sign in.', variant: 'success' });
      navigate('/login', { replace: true });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, 'Could not reset password'), variant: 'error' }),
  });

  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto bg-surface p-6 text-on-surface">
      <div className="w-full max-w-sm py-8">
        <header className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 h-16 w-16 shadow-lg ring-1 ring-white/10" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">ChatSphere</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Choose a new password</p>
        </header>

        <div className="glass-card flex flex-col gap-6 rounded-3xl p-6">
          {!token ? (
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-semibold text-on-surface">Invalid reset link</h2>
              <p className="text-sm text-on-surface-variant">
                This link is missing its token. Please request a new reset email.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-on-surface">Set a new password</h2>
                <p className="text-sm text-on-surface-variant">Enter and confirm your new password.</p>
              </div>
              <form onSubmit={handleSubmit((v) => reset.mutate(v.password))} className="flex flex-col gap-4">
                <div>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="New password"
                      className={inputClass}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-primary"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password?.message && (
                    <p className="mt-1 pl-1 text-xs text-error">{errors.password.message}</p>
                  )}
                </div>
                <div>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Confirm new password"
                      className={inputClass}
                      {...register('confirmPassword')}
                    />
                  </div>
                  {errors.confirmPassword?.message && (
                    <p className="mt-1 pl-1 text-xs text-error">{errors.confirmPassword.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={reset.isPending}
                  className="glow-button mt-1 rounded-xl bg-primary-container py-3.5 text-base font-semibold text-on-primary-container transition-all active:scale-95 disabled:opacity-70"
                >
                  {reset.isPending ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-sm">
          <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
