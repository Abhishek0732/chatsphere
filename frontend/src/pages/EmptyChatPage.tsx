import { Logo } from '@/components/ui/Logo';

export function EmptyChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Logo className="h-16 w-16 shadow-lg ring-1 ring-white/10" />
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          ChatSphere
        </h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          Select a conversation to start messaging, or head to Updates to start a new chat.
        </p>
      </div>
    </div>
  );
}
