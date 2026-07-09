import { mediaSrc } from '@/utils/media';

/**
 * Force a file download in the browser. Fetches the resource as a blob and
 * triggers a "Save As" with the given name. This works cross-origin (e.g. the
 * MinIO object store) where the plain <a download> attribute is ignored.
 * Falls back to opening the URL if the blob fetch is blocked.
 */
/** Download an in-memory string as a text file (e.g. a chat export). */
export function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadFile(rawUrl: string, fileName?: string): Promise<void> {
  const url = mediaSrc(rawUrl);
  const name = fileName || url.split('/').pop()?.split('?')[0] || 'download';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Last resort if the fetch is blocked (CORS/network): let the browser open it.
    window.open(url, '_blank', 'noopener');
  }
}
