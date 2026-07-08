import { Logo } from '@/components/ui/Logo';
import { LoginForm } from '@/features/auth/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export function LoginPage() {
  return (
    <div className="app-bg relative flex min-h-full items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm animate-scale-in rounded-panel border border-white/50 bg-white/80 p-8 shadow-elevated backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Logo className="h-14 w-14 shadow-lg" />
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
