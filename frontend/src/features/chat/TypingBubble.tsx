/**
 * messenger-style animated "···" bubble shown at the bottom of an open thread
 * while the other participant(s) are typing. In a group it also names who.
 */
export function TypingBubble({ label }: { label?: string }) {
  return (
    <div className="flex w-full justify-start">
      <div className="message-received animate-pop-in flex items-center gap-2 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm">
        {label && (
          <span className="text-xs font-medium text-brand-600 dark:text-brand-400">{label}</span>
        )}
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-slate-400 [animation-delay:0ms] dark:bg-slate-500" />
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-slate-400 [animation-delay:150ms] dark:bg-slate-500" />
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-slate-400 [animation-delay:300ms] dark:bg-slate-500" />
        </span>
      </div>
    </div>
  );
}
