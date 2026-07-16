import { Fragment, useMemo } from 'react';
import { cn } from '@/utils/cn';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The literal names an @mention can spell: every member, plus "@All"/"@Everyone". */
export function mentionNamesOf(memberNames: string[]): string[] {
  return [...memberNames, 'All', 'Everyone'];
}

interface Part {
  text: string;
  /** The mentioned name, when this part is an @mention. */
  name?: string;
}

/**
 * Split message text into plain runs and @mention runs. Mentions are matched by
 * name (longest first, so "@John Doe" wins over a member also called "@John"),
 * which is why "@" typed as ordinary punctuation never lights up.
 */
function splitMentions(content: string, names: string[]): Part[] {
  if (!content || names.length === 0) return [{ text: content }];
  const alternatives = [...names]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|');
  const re = new RegExp(`@(${alternatives})(?![\\p{L}\\p{N}])`, 'giu');

  const parts: Part[] = [];
  let last = 0;
  for (const m of content.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: content.slice(last, at) });
    parts.push({ text: m[0], name: m[1] });
    last = at + m[0].length;
  }
  if (last < content.length) parts.push({ text: content.slice(last) });
  return parts;
}

/**
 * Message text with @mentions highlighted (messenger-style). A mention of ME —
 * by name, or via @All — is highlighted more strongly than a mention of someone
 * else, so it's obvious at a glance that a message wants my attention.
 */
export function MessageText({
  content,
  mentionNames,
  myName,
  mine,
  className,
}: {
  content: string;
  /** Names that may be mentioned in this conversation (empty in direct chats). */
  mentionNames: string[];
  myName?: string;
  /** Rendered inside my own (accent-gradient) bubble. */
  mine: boolean;
  className?: string;
}) {
  const parts = useMemo(() => splitMentions(content, mentionNames), [content, mentionNames]);

  return (
    <p className={cn('whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]', className)}>
      {parts.map((p, i) => {
        if (!p.name) return <Fragment key={i}>{p.text}</Fragment>;
        const lower = p.name.toLowerCase();
        const aboutMe =
          lower === 'all' ||
          lower === 'everyone' ||
          (!!myName && lower === myName.toLowerCase());
        return (
          <span
            key={i}
            className={cn(
              'rounded px-0.5 font-semibold',
              mine
                ? 'bg-white/20'
                : aboutMe
                  ? 'bg-primary/20 text-primary'
                  : 'text-primary',
            )}
          >
            {p.text}
          </span>
        );
      })}
    </p>
  );
}
