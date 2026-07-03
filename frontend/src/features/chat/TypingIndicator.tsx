import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';

// Stable empty reference: returning a fresh `[]` from a zustand selector makes
// useSyncExternalStore see a new snapshot every render -> infinite loop (React #185).
const NO_TYPERS: { userId: number; userName: string }[] = [];

export function TypingIndicator({ conversationId }: { conversationId: number }) {
  const myId = useAuthStore((s) => s.user?.id);
  const typers = useChatStore((s) => s.typing[conversationId] ?? NO_TYPERS);
  const others = typers.filter((t) => t.userId !== myId);

  if (others.length === 0) return null;

  const label =
    others.length === 1
      ? `${others[0].userName} is typing`
      : `${others.map((o) => o.userName).join(', ')} are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-slate-500 dark:text-slate-400">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
      </span>
      {label}
    </div>
  );
}
