import { MessageCircle } from 'lucide-react';
import { LoginForm } from '@/features/auth/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export function LoginPage() {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Decorative floating accent blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-float rounded-full bg-brand-400/30 blur-3xl dark:bg-brand-600/20" />
      <div
        className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 animate-float rounded-full bg-brand-500/20 blur-3xl dark:bg-brand-500/10"
        style={{ animationDelay: '2s' }}
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm animate-scale-in rounded-3xl border border-white/60 bg-white/80 p-8 shadow-soft backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sign in to <span className="font-semibold text-brand-gradient">ChatSphere</span>
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
