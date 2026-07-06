import { Outlet, useLocation } from 'react-router-dom';
import { ConversationList } from '@/features/chat/ConversationList';
import { cn } from '@/utils/cn';

/**
 * Two-pane chat layout. On mobile it shows either the conversation list or the
 * active thread (routed via <Outlet />), never both.
 */
export function ChatShell() {
  const location = useLocation();
  const isThread = location.pathname.startsWith('/chat/');

  return (
    <div className="flex h-full w-full">
      {/* Conversation list */}
      <aside
        className={cn(
          'glass-panel h-full w-full flex-col border-r border-white/40 dark:border-white/5 md:flex md:w-80 lg:w-96',
          isThread ? 'hidden md:flex' : 'flex',
        )}
      >
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
