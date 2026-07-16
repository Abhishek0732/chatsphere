import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AtSign } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import type { User } from '@/types';

const LIMIT = 6;

/**
 * The `@…` the caret sits in, if any: an `@` that starts a word, followed by at
 * most two words — enough to type "@John D" and still match "John Doe".
 */
const MENTION_RE = /(?:^|\s)@([^\s@]{0,24}(?:\s[^\s@]{0,24})?)$/;

/** Which of the tagged people are still actually named in the text. */
export function mentionsIn(text: string, tagged: Map<string, number>): number[] {
  const ids = new Set<number>();
  tagged.forEach((id, token) => {
    if (text.includes(token)) ids.add(id);
  });
  return [...ids];
}

/**
 * A text field that tags people with "@" — the way Instagram and modern messengers let
 * you mention someone in a story. Renders as a textarea or a single-line input;
 * the picker lists the given people (your contacts) and inserts "@Their Name".
 *
 * `tagged` is a token -> userId map the caller owns, so on submit it can drop
 * any mention whose text the user has since deleted.
 */
export function MentionField({
  value,
  onChange,
  people,
  tagged,
  multiline,
  placeholder,
  rows = 3,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  people: User[];
  tagged: React.MutableRefObject<Map<string, number>>;
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  const candidates = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.trim().toLowerCase();
    return people
      .filter((p) => !q || p.displayName.toLowerCase().includes(q))
      .slice(0, LIMIT);
  }, [mention, people]);

  const open = candidates.length > 0;

  const detect = (text: string, caret: number) => {
    const m = MENTION_RE.exec(text.slice(0, caret));
    if (!m) {
      setMention(null);
      return;
    }
    setMention({ start: caret - m[1].length - 1, query: m[1] });
    setIndex(0);
  };

  const insert = (u: User) => {
    if (!mention) return;
    const token = `@${u.displayName}`;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    tagged.current.set(token, u.id);
    onChange(`${before}${token} ${after}`);
    setMention(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        const pos = before.length + token.length + 1;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => (i + 1) % candidates.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => (i - 1 + candidates.length) % candidates.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insert(candidates[index] ?? candidates[0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMention(null);
    }
  };

  const shared = {
    ref,
    value,
    placeholder,
    autoFocus,
    onKeyDown,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(e.target.value);
      detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
    },
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const el = e.currentTarget;
      detect(el.value, el.selectionStart ?? el.value.length);
    },
    className,
  };

  return (
    <div className="relative">
      {multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} />}

      {open && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-xl border border-white/10 bg-surface-container/95 shadow-2xl backdrop-blur-xl">
          <p className="flex items-center gap-1.5 border-b border-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            <AtSign className="h-3.5 w-3.5" /> Mention
          </p>
          <ul className="max-h-44 overflow-y-auto scrollbar-thin">
            {candidates.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  // mousedown, not click: the field must not lose the caret first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insert(p);
                  }}
                  onMouseEnter={() => setIndex(i)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left transition',
                    i === index ? 'bg-white/10' : 'hover:bg-white/5',
                  )}
                >
                  <Avatar name={p.displayName} src={p.avatarUrl} size="sm" className="h-7 w-7 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                    {p.displayName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
