import { useState, type ImgHTMLAttributes } from 'react';
import { mediaSrc, mediaThumb } from '@/utils/media';

/**
 * An <img> that loads the stored thumbnail and silently falls back to the
 * original if there isn't one — which is the case for every image uploaded
 * before thumbnails existed, so old chats keep working untouched.
 */
export function ThumbImage({
  url,
  ...props
}: { url?: string | null } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const thumb = mediaThumb(url);
  const [src, setSrc] = useState(thumb ?? mediaSrc(url));

  return (
    <img
      {...props}
      src={src}
      loading={props.loading ?? 'lazy'}
      decoding={props.decoding ?? 'async'}
      onError={(e) => {
        const full = mediaSrc(url);
        if (src !== full) setSrc(full); // no thumbnail stored — use the original
        props.onError?.(e);
      }}
    />
  );
}
