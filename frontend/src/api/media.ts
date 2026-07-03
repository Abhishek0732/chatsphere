import { api } from './client';
import type { MediaUploadResult } from '@/types';

export async function uploadMedia(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MediaUploadResult> {
  const form = new FormData();
  form.append('file', file);

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
