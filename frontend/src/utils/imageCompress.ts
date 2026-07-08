/**
 * High-quality, near-lossless image compression before upload.
 *
 * Goal: cut upload size (and therefore upload time) WITHOUT a visible quality
 * drop. So we are deliberately conservative:
 *   - Only touch real photo formats we can safely re-encode (JPEG / WebP).
 *     PNG/GIF/SVG/HEIC and every non-image pass through untouched.
 *   - Only downscale images larger than 2560px on the long edge — far above any
 *     phone/desktop viewing size, so the change is imperceptible. Never upscale.
 *   - Re-encode at JPEG quality 0.92 (high). EXIF orientation is respected.
 *   - If the result isn't actually smaller (already-optimized image), keep the
 *     ORIGINAL file — we never trade quality for nothing.
 *
 * Any failure falls back to the original file, so this can never block a send.
 */

// Long-edge cap. 2560px is sharper than a 1440p display; downscaling above this
// is not visible on a phone or in a chat bubble.
const MAX_EDGE = 2560;
// Below this size we don't bother — re-encoding tiny images risks a net loss.
const SKIP_BELOW_BYTES = 512 * 1024;
const QUALITY = 0.92;

export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|webp)$/i.test(file.type)) return file;
  if (file.size < SKIP_BELOW_BYTES) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    // Only use it if we actually saved bytes; otherwise keep the original.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
