import { api } from './client';
import { compressImage } from '@/utils/imageCompress';
import type { MediaUploadResult } from '@/types';

/** Max upload size, kept in sync with the backend multipart limit and the
 *  nginx `client_max_body_size` on /api/ (both 25 MB). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '25 MB';

/**
 * Returns a user-facing error message if the file exceeds the upload limit,
 * or null if it's fine. Lets callers reject oversized files up front with a
 * clear toast instead of a silent 413 from the server.
 */
export function uploadSizeError(file: File): string | null {
  return file.size > MAX_UPLOAD_BYTES ? 'File too large' : null;
}

export async function uploadMedia(
  file: File,
  onProgress?: (percent: number) => void,
  opts: { encrypted?: boolean } = {},
): Promise<MediaUploadResult> {
  // An encrypted body is ALREADY ciphertext — compressing it would corrupt it (and
  // there is nothing to compress: it is indistinguishable from noise). The photo was
  // compressed before it was sealed.
  const toSend = opts.encrypted ? file : await compressImage(file);

  const form = new FormData();
  form.append('file', toSend);
  // Tells the server not to name the object after the file and not to try to build a
  // thumbnail from bytes it cannot read.
  if (opts.encrypted) form.append('encrypted', 'true');

  const { data } = await api.post<MediaUploadResult>('/media/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return data;
}
