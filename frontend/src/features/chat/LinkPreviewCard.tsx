import { useState } from 'react';
import { cn } from '@/utils/cn';
import type { LinkPreview } from '@/types';

/**
 * A compact Open Graph card rendered under a message that contains a link. The
 * preview is unfurled server-side (the client never fetches the third-party page),
 * so all we do here is lay out title/description/thumbnail and open the link.
 */
export function LinkPreviewCard({ preview, mine }: { preview: LinkPreview; mine: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  const host = safeHost(preview.url);

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-1 block overflow-hidden rounded-xl border text-left transition hover:brightness-105',
        mine ? 'border-white/20 bg-white/10' : 'border-black/5 bg-black/5 dark:border-white/10 dark:bg-white/5',
      )}
    >
      {preview.imageUrl && imgOk && (
        <img
          src={preview.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgOk(false)}
          className="max-h-44 w-full object-cover"
        />
      )}
      <div className="px-3 py-2">
        <p className={cn('truncate text-[11px] uppercase tracking-wide', mine ? 'text-white/70' : 'text-on-surface-variant')}>
          {preview.siteName || host}
        </p>
        {preview.title && (
          <p className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere]">{preview.title}</p>
        )}
        {preview.description && (
          <p className={cn('mt-0.5 line-clamp-2 text-xs [overflow-wrap:anywhere]', mine ? 'text-white/80' : 'text-on-surface-variant')}>
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
