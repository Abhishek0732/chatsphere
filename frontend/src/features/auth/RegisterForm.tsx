import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useRegister } from '@/hooks/useAuth';
import { registerSchema, type RegisterFormValues } from './schemas';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/70 transition-all focus:border-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50';

export function RegisterForm() {
  const registerMutation = useRegister();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', username: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = (values: RegisterFormValues) =>
    registerMutation.mutate({
      displayName: values.displayName,
      username: values.username,
      email: values.email,
      password: values.password,
    });

  const field = (
    icon: ReactNode,
    name: keyof RegisterFormValues,
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
          {...register(name)}
        />
      </div>
      {errors[name]?.message && (
        <p className="mt-1 pl-1 text-xs text-error">{errors[name]?.message as string}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
      {field(<User className="h-5 w-5" />, 'displayName', 'Display name')}
      {field(<AtSign className="h-5 w-5" />, 'username', 'Username')}
      {field(<Mail className="h-5 w-5" />, 'email', 'Email address', {
        type: 'email',
        autoComplete: 'email',
      })}

      <div>
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
          <input
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Password"
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

      {field(<Lock className="h-5 w-5" />, 'confirmPassword', 'Confirm password', {
        type: 'password',
        autoComplete: 'new-password',
      })}

      <button
        type="submit"
        disabled={registerMutation.isPending}
        className="glow-button mt-2 rounded-xl bg-primary-container py-3.5 text-base font-semibold text-on-primary-container transition-all active:scale-95 disabled:opacity-70"
      >
        {registerMutation.isPending ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
