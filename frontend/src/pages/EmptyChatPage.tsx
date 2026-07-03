import { MessageCircle } from 'lucide-react';

export function EmptyChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center dark:bg-slate-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-100 text-brand-600 dark:bg-brand-900/30">
        <MessageCircle className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold">ChatSphere</h2>
      <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
        Select a conversation to start messaging, or head to Contacts to start a new chat.
      </p>
    </div>
  );
}
