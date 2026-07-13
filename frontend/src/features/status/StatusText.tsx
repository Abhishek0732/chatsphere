import { Fragment, useMemo } from 'react';
import { cn } from '@/utils/cn';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Status text with @mentions highlighted, the way a tagged name stands out in an
 * Instagram story. Matches by name (longest first, so "@John Doe" wins over a
 * contact also called "@John"), so a stray "@" in ordinary text never lights up.
 */
export function StatusText({
  text,
  names,
  className,
}: {
  text: string;
  /** Display names of the people tagged in this status. */
  names: string[];
  className?: string;
}) {
  const parts = useMemo(() => {
    if (!text || names.length === 0) return [{ text }];
    const alternatives = [...names]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join('|');
    const re = new RegExp(`@(${alternatives})(?![\\p{L}\\p{N}])`, 'giu');

    const out: { text: string; mention?: boolean }[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      if (at > last) out.push({ text: text.slice(last, at) });
      out.push({ text: m[0], mention: true });
      last = at + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }, [text, names]);

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.mention ? (
          <span key={i} className={cn('rounded bg-white/25 px-1 font-semibold')}>
            {p.text}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </span>
  );
}
