import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { LoginForm } from '@/features/auth/LoginForm';

export function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto bg-surface p-6 text-on-surface">
      <div className="w-full max-w-sm py-8">
        <header className="mb-10 flex flex-col items-center text-center">
          <Logo className="mb-4 h-16 w-16 shadow-lg ring-1 ring-white/10" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">ChatSphere</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Connect beyond boundaries</p>
        </header>

        <div className="glass-card flex flex-col gap-6 rounded-3xl p-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-on-surface">Welcome back</h2>
            <p className="text-sm text-on-surface-variant">Sign in to continue your conversations</p>
          </div>
          <LoginForm />
        </div>

        <p className="mt-8 text-center text-sm text-on-surface-variant">
          Don't have an account?
          <Link to="/register" className="ml-1.5 font-semibold text-primary hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
