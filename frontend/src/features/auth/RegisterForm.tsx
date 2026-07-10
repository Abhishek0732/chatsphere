import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, AtSign, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { useRegister } from '@/hooks/useAuth';
import { sendRegisterOtp, verifyRegisterOtp } from '@/api/auth';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/utils/apiError';
import {
  registerDetailsSchema,
  registerPasswordSchema,
  type RegisterDetailsValues,
  type RegisterPasswordValues,
} from './schemas';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/70 transition-all focus:border-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50';

type Step = 'details' | 'otp' | 'password';

export function RegisterForm() {
  const registerMutation = useRegister();
  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<RegisterDetailsValues | null>(null);
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);

  const detailsForm = useForm<RegisterDetailsValues>({
    resolver: zodResolver(registerDetailsSchema),
    defaultValues: { displayName: '', username: '', email: '' },
  });
  const passwordForm = useForm<RegisterPasswordValues>({
    resolver: zodResolver(registerPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const sendOtp = useMutation({
    mutationFn: (email: string) => sendRegisterOtp(email),
    onSuccess: () => {
      setStep('otp');
      toast({ title: 'Verification code sent', description: 'Check your email inbox.', variant: 'success' });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, 'Could not send the code'), variant: 'error' }),
  });

  const verifyOtp = useMutation({
    mutationFn: (vars: { email: string; code: string }) => verifyRegisterOtp(vars.email, vars.code),
    onSuccess: () => {
      setStep('password');
      toast({ title: 'Email verified', variant: 'success' });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, 'Invalid code'), variant: 'error' }),
  });

  const submitDetails = (values: RegisterDetailsValues) => {
    setDetails(values);
    sendOtp.mutate(values.email);
  };

  const submitOtp = () => {
    if (!details || code.trim().length < 4) return;
    verifyOtp.mutate({ email: details.email, code: code.trim() });
  };

  const submitPassword = (values: RegisterPasswordValues) => {
    if (!details) return;
    registerMutation.mutate({
      displayName: details.displayName,
      username: details.username,
      email: details.email,
      password: values.password,
    });
  };

  const field = (
    icon: ReactNode,
    name: keyof RegisterDetailsValues,
    placeholder: string,
    opts: { type?: string; autoComplete?: string } = {},
  ) => (
    <div>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">
          {icon}
        </span>
        <input
          type={opts.type ?? 'text'}
          autoComplete={opts.autoComplete}
          placeholder={placeholder}
          className={inputClass}
          {...detailsForm.register(name)}
        />
      </div>
      {detailsForm.formState.errors[name]?.message && (
        <p className="mt-1 pl-1 text-xs text-error">
          {detailsForm.formState.errors[name]?.message as string}
        </p>
      )}
    </div>
  );

  const submitBtn =
    'glow-button mt-2 rounded-xl bg-primary-container py-3.5 text-base font-semibold text-on-primary-container transition-all active:scale-95 disabled:opacity-70';

  // Step 1 — account details, then send the code.
  if (step === 'details') {
    return (
      <form onSubmit={detailsForm.handleSubmit(submitDetails)} className="flex flex-col gap-3.5">
        {field(<User className="h-5 w-5" />, 'displayName', 'Display name')}
        {field(<AtSign className="h-5 w-5" />, 'username', 'Username')}
        {field(<Mail className="h-5 w-5" />, 'email', 'Email address', {
          type: 'email',
          autoComplete: 'email',
        })}
        <button type="submit" disabled={sendOtp.isPending} className={submitBtn}>
          {sendOtp.isPending ? 'Sending code…' : 'Send verification code'}
        </button>
      </form>
    );
  }

  // Step 2 — enter the emailed OTP.
  if (step === 'otp') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="text-sm text-on-surface-variant">
            Enter the 6-digit code we sent to
            <br />
            <span className="font-semibold text-on-surface">{details?.email}</span>
          </p>
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && submitOtp()}
          inputMode="numeric"
          autoFocus
          placeholder="______"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 text-center text-2xl font-semibold tracking-[0.5em] text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={submitOtp}
          disabled={verifyOtp.isPending || code.length < 4}
          className={submitBtn}
        >
          {verifyOtp.isPending ? 'Verifying…' : 'Verify email'}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep('details')}
            className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="button"
            onClick={() => details && sendOtp.mutate(details.email)}
            disabled={sendOtp.isPending}
            className="font-semibold text-primary hover:underline disabled:opacity-60"
          >
            {sendOtp.isPending ? 'Resending…' : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  // Step 3 — set the password.
  return (
    <form onSubmit={passwordForm.handleSubmit(submitPassword)} className="flex flex-col gap-3.5">
      <p className="text-sm text-on-surface-variant">Email verified. Choose a password to finish.</p>
      <div>
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
          <input
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Password"
            className={inputClass}
            {...passwordForm.register('password')}
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
        {passwordForm.formState.errors.password?.message && (
          <p className="mt-1 pl-1 text-xs text-error">{passwordForm.formState.errors.password.message}</p>
        )}
      </div>
      <div>
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            className={inputClass}
            {...passwordForm.register('confirmPassword')}
          />
        </div>
        {passwordForm.formState.errors.confirmPassword?.message && (
          <p className="mt-1 pl-1 text-xs text-error">
            {passwordForm.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>
      <button type="submit" disabled={registerMutation.isPending} className={submitBtn}>
        {registerMutation.isPending ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
