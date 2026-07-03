import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SquarePen } from 'lucide-react';
import { ConversationList } from '@/features/chat/ConversationList';
import { cn } from '@/utils/cn';

/**
 * Two-pane chat layout. On mobile it shows either the conversation list or the
 * active thread (routed via <Outlet />), never both.
 */
export function ChatShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isThread = location.pathname.startsWith('/chat/');

  return (
    <div className="flex h-full w-full">
      {/* Conversation list */}
      <aside
        className={cn(
          'h-full w-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex md:w-80 lg:w-96',
          isThread ? 'hidden md:flex' : 'flex',
        )}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h1 className="text-lg font-bold text-brand-600">ChatSphere</h1>
          <button
            onClick={() => navigate('/contacts')}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="New chat"
          >
            <SquarePen className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <ConversationList />
        </div>
      </aside>

      {/* Thread / empty state */}
      <section
        className={cn(
          'h-full min-w-0 flex-1',
          isThread ? 'flex' : 'hidden md:flex',
        )}
      >
        <div className="h-full w-full">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
