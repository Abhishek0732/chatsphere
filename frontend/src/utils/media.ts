/**
 * Resolve a stored media reference to a URL the browser can actually load.
 *
 * Uploaded objects are served same-origin through the frontend's nginx `/media/`
 * proxy, so they work identically over localhost, a LAN IP, or an HTTPS tunnel
 * (Cloudflare, ngrok, …) with no host baked in and no mixed-content issues.
 *
 *  - New uploads are already relative ("/media/…")            → returned as-is.
 *  - blob:/data: previews (freshly picked, not yet uploaded)  → returned as-is.
 *  - Legacy absolute MinIO URLs ("http://host:9000/bucket/…") → rewritten to the
 *    same-origin "/media/bucket/…" path so old messages keep working.
 *  - Any OTHER absolute URL (e.g. a catalogue song's preview clip or its cover
 *    art, which live on an external CDN) → returned untouched. Rewriting those
 *    to /media would point them at our own storage, where they don't exist.
 */
export function mediaSrc(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const u = new URL(url);
    const isMinio = u.port === '9000' || u.pathname.startsWith('/chatsphere-media/');
    return isMinio ? `/media${u.pathname}` : url;
  } catch {
    return url;
  }
}

/**
 * URL of the stored thumbnail for an uploaded image, by convention (the backend
 * writes "<object>.thumb.jpg" beside every image it stores).
 *
 * Small renders — avatars, grid tiles, status rings, chat bubbles — used to load
 * the FULL-SIZE original: a 3MB photo downloaded into a 100px tile, by every
 * member of the group, every time it wasn't in cache. Returns null when there
 * can't be a thumbnail (a video, or an image uploaded before thumbnails existed),
 * so callers fall back to the original.
 */
export function mediaThumb(url?: string | null): string | null {
  if (!url) return null;
  const src = mediaSrc(url);
  if (!src.startsWith('/media/')) return null; // external (e.g. catalogue art)
  if (/\.(mp4|webm|mov|m4v|mp3|wav|m4a|ogg|pdf|zip)$/i.test(src)) return null;
  return `${src}.thumb.jpg`;
}
