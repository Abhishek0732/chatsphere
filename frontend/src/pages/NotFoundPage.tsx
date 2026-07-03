import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-5xl font-bold text-brand-600">404</h1>
      <p className="text-slate-500 dark:text-slate-400">This page could not be found.</p>
      <Link to="/">
        <Button>Back to chats</Button>
      </Link>
    </div>
  );
}
