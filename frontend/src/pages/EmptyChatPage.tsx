import { MessageCircle } from 'lucide-react';

export function EmptyChatPage() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center dark:from-slate-950 dark:to-slate-900">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-400/10 blur-3xl" />

      <div className="relative flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-glow ring-8 ring-brand-500/10">
        <MessageCircle className="h-9 w-9" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-brand-gradient">ChatSphere</h2>
      <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
        Select a conversation to start messaging, or head to Contacts to start a new chat.
      </p>
    </div>
  );
}
