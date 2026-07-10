import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useLogin } from '@/hooks/useAuth';
import { loginSchema, type LoginFormValues } from './schemas';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/70 transition-all focus:border-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50';

export function LoginForm() {
  const login = useLogin();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { usernameOrEmail: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => login.mutate(values);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <div className="group relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
          <input
            autoComplete="username"
            placeholder="Email or username"
            className={inputClass}
            {...register('usernameOrEmail')}
          />
        </div>
        {errors.usernameOrEmail?.message && (
          <p className="mt-1 pl-1 text-xs text-error">{errors.usernameOrEmail.message}</p>
        )}
      </div>

      <div>
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
          <input
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
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
        <div className="mt-1.5 text-right">
          <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>

      <button
        type="submit"
        disabled={login.isPending}
        className="glow-button mt-2 rounded-xl bg-primary-container py-3.5 text-base font-semibold text-on-primary-container transition-all active:scale-95 disabled:opacity-70"
      >
        {login.isPending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
