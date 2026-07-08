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
): Promise<MediaUploadResult> {
  // Near-lossless downscale/re-encode for large photos — smaller body = faster
  // upload. Non-photos and small images pass through unchanged.
  const toSend = await compressImage(file);

  const form = new FormData();
  form.append('file', toSend);

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
