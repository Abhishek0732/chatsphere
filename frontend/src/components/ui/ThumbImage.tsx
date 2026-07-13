import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { mediaSrc, mediaThumb } from '@/utils/media';
import { cn } from '@/utils/cn';

/**
 * An <img> that loads the stored thumbnail and silently falls back to the
 * original when there isn't one — which is the case for every image uploaded
 * before thumbnails existed, and for images already smaller than the thumbnail
 * size (the backend doesn't upscale).
 *
 * The fallback is handled ENTIRELY in here: `onError` is only forwarded to the
 * parent once the ORIGINAL has failed too. Reporting the thumbnail's 404 upwards
 * made Avatar think the photo was broken and render initials instead — so a
 * perfectly good profile picture disappeared from every avatar, while still
 * opening fine in the full-size viewer.
 */
export function ThumbImage({
  url,
  ...props
}: { url?: string | null } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const full = mediaSrc(url);
  const thumb = mediaThumb(url);

  const [src, setSrc] = useState(thumb ?? full);
  const [loaded, setLoaded] = useState(false);
  /** True once we've given up on the thumbnail and are showing the original. */
  const usingFull = useRef(!thumb);

  // A new url (e.g. the user changed their photo) starts again at the thumbnail.
  useEffect(() => {
    setSrc(thumb ?? full);
    setLoaded(false);
    usingFull.current = !thumb;
  }, [thumb, full]);

  return (
    <img
      {...props}
      src={src}
      loading={props.loading ?? 'lazy'}
      decoding={props.decoding ?? 'async'}
      // Shimmer underneath until the pixels arrive, so an image area is never
      // a blank hole while it loads.
      className={cn(props.className, !loaded && 'shimmer')}
      onLoad={(e) => {
        setLoaded(true);
        props.onLoad?.(e);
      }}
      onError={(e) => {
        if (!usingFull.current && full && full !== src) {
          // No thumbnail stored — quietly use the original. This is not an error.
          usingFull.current = true;
          setSrc(full);
          return;
        }
        props.onError?.(e); // the original really is broken
      }}
    />
  );
}
