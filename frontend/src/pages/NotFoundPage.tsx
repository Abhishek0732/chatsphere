import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="app-bg relative flex min-h-full flex-col items-center justify-center gap-5 overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />

      <div className="relative flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-glow ring-8 ring-brand-500/10">
        <Compass className="h-9 w-9" />
      </div>

      <h1 className="text-6xl font-black tracking-tight text-brand-gradient">404</h1>
      <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
        This page wandered off. Let’s get you back to your conversations.
      </p>

      <Link to="/">
        <Button className="shadow-glow">Back to chats</Button>
      </Link>
    </div>
  );
}
