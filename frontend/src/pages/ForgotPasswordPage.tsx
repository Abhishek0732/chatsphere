import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { forgotPassword } from '@/api/auth';
import { Logo } from '@/components/ui/Logo';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/70 transition-all focus:border-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50';

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const forgot = useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onSuccess: (_data, email) => setSentTo(email),
  });

  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto bg-surface p-6 text-on-surface">
      <div className="w-full max-w-sm py-8">
        <header className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 h-16 w-16 shadow-lg ring-1 ring-white/10" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">ChatSphere</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Reset your password</p>
        </header>

        <div className="glass-card flex flex-col gap-6 rounded-3xl p-6">
          {sentTo ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MailCheck className="h-7 w-7" />
              </span>
              <h2 className="text-xl font-semibold text-on-surface">Check your email</h2>
              <p className="text-sm text-on-surface-variant">
                If an account exists for <span className="font-semibold text-on-surface">{sentTo}</span>,
                we've sent a link to reset your password. The link expires in 30 minutes.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-on-surface">Forgot password?</h2>
                <p className="text-sm text-on-surface-variant">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>
              <form onSubmit={handleSubmit((v) => forgot.mutate(v.email))} className="flex flex-col gap-4">
                <div>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="Email address"
                      className={inputClass}
                      {...register('email')}
                    />
                  </div>
                  {errors.email?.message && (
                    <p className="mt-1 pl-1 text-xs text-error">{errors.email.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={forgot.isPending}
                  className="glow-button mt-1 rounded-xl bg-primary-container py-3.5 text-base font-semibold text-on-primary-container transition-all active:scale-95 disabled:opacity-70"
                >
                  {forgot.isPending ? 'Sending…' : 'Send reset link'}
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
