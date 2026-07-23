import { api } from './client';
import { compressImage } from '@/utils/imageCompress';
import type { MediaUploadResult } from '@/types';

/** Max upload size, kept in sync with the backend multipart limit (100 MB) and
 *  the nginx `client_max_body_size` on /api/ (105 MB, with multipart headroom). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '100 MB';

/**
 * Returns a user-facing error message if the file exceeds the upload limit,
 * or null if it's fine. Lets callers reject oversized files up front with a
 * clear toast instead of a silent 413 from the server.
 */
export function uploadSizeError(file: File): string | null {
  return file.size > MAX_UPLOAD_BYTES ? 'File too large' : null;
}

/**
 * Statuses that mean "the request never really landed" — worth one more try.
 * 502/504 and Cloudflare's own 520-524 are what a tunnel emits when it drops a
 * connection mid-body, which is the common way a multi-megabyte upload dies on
 * a public tunnel while every small JSON request sails through.
 *
 * 429 is deliberately NOT here. It is the server saying "slow down" (our own
 * rate limiter, or a proxy's) — retrying it instantly just spends another token
 * against the same bucket, gets another 429, and lengthens the lockout. The user
 * has to wait out the window, so we surface that instead of hammering.
 */
const RETRIABLE = new Set([408, 425, 500, 502, 503, 504, 520, 521, 522, 523, 524]);

function isRetriable(err: unknown): boolean {
  if (isUploadAbort(err)) return false;
  const status = (err as { response?: { status?: number } })?.response?.status;
  // No response at all = the connection itself failed (dropped tunnel, flaky
  // mobile data). Retry that; a real rejection (413, 429, 401) has a status.
  return status === undefined || RETRIABLE.has(status);
}

export async function uploadMedia(
  file: File,
  onProgress?: (percent: number) => void,
  opts: { encrypted?: boolean; signal?: AbortSignal } = {},
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

  const send = async () => {
    onProgress?.(0);
    const { data } = await api.post<MediaUploadResult>('/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Passed through so a caller can cancel a large in-flight upload (axios aborts
      // the request; a canceled upload throws and is swallowed by the caller).
      signal: opts.signal,
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });
    return data;
  };

  try {
    return await send();
  } catch (err) {
    // One retry, because a dropped connection is not a rejection. The upload is
    // idempotent from the user's point of view: a half-received object is never
    // referenced by a message, so the worst case is an orphan in the store.
    if (!isRetriable(err) || opts.signal?.aborted) throw err;
    return await send();
  }
}

/**
 * Turns a failed upload into something the user can act on.
 *
 * "Upload failed" is useless when the cause is a proxy in front of the app —
 * a public tunnel (Cloudflare, ngrok) drops long request bodies and caps them
 * at 100 MB, and that looks nothing like a rejected file. Say which it was.
 */
export function uploadErrorMessage(err: unknown): string {
  if (isUploadAbort(err)) return 'Canceled';
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === undefined) {
    return 'The connection dropped mid-upload. On a public tunnel, large files often need a retry.';
  }
  if (status === 413) {
    return `Too large for the connection — the limit is ${MAX_UPLOAD_LABEL}, and a public tunnel may cap it lower.`;
  }
  if (status === 429) {
    const retryAfter = Number(
      (err as { response?: { headers?: Record<string, string> } })?.response?.headers?.['retry-after'],
    );
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? `about ${Math.ceil(retryAfter / 60)} min`
      : 'a minute';
    return `Too many uploads in a short time — wait ${wait} and try again.`;
  }
  if (status === 401 || status === 403) return 'Your session expired — sign in again.';
  if (status === 415) return 'That file type is not accepted.';
  if (status >= 500) return `The server or tunnel dropped it (HTTP ${status}). Try again.`;
  return `Upload rejected (HTTP ${status}).`;
}

/** True when an error is an aborted (user-canceled) upload rather than a failure. */
export function isUploadAbort(err: unknown): boolean {
  return (
    (err as { code?: string })?.code === 'ERR_CANCELED' ||
    (err as { name?: string })?.name === 'CanceledError' ||
    (err as { name?: string })?.name === 'AbortError'
  );
}
