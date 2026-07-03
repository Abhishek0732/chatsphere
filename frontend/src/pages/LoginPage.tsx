import { MessageCircle } from 'lucide-react';
import { LoginForm } from '@/features/auth/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export function LoginPage() {
  return (
    <div className="relative flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to ChatSphere</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
