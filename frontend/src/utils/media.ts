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
 */
export function mediaSrc(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const u = new URL(url);
    return `/media${u.pathname}`;
  } catch {
    return url;
  }
}
