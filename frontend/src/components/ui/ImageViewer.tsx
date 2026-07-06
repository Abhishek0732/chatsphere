import { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useImageViewer } from '@/store/imageViewerStore';
import { downloadFile } from '@/utils/download';
import { initials } from '@/utils/format';
import { mediaSrc } from '@/utils/media';

/**
 * Full-screen lightbox for profile pictures. Mounted once at the app root;
 * driven by the global image-viewer store. Closes on backdrop click, the X
 * button, or Escape.
 */
export function ImageViewer() {
  const current = useImageViewer((s) => s.current);
  const close = useImageViewer((s) => s.close);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, close]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`${current.name} profile picture`}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        {current.src && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void downloadFile(current.src!, current.fileName);
            }}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/20 hover:text-white"
            aria-label="Download"
          >
            <Download className="h-5 w-5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        )}
        <button
          onClick={close}
          className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Stop propagation so clicking the image itself doesn't close the viewer. */}
      <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        {current.src ? (
          current.circle ? (
            // Profile pictures: fixed square cropped to a circle, so every
            // avatar looks consistent regardless of the source aspect ratio.
            <img
              src={mediaSrc(current.src)}
              alt={current.name}
              className="h-64 w-64 rounded-full object-cover shadow-2xl sm:h-80 sm:w-80"
            />
          ) : (
            <img
              src={mediaSrc(current.src)}
              alt={current.name}
              className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            />
          )
        ) : (
          <div className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-6xl font-semibold text-white shadow-2xl">
            {initials(current.name)}
          </div>
        )}
        <p className="text-lg font-medium text-white">{current.name}</p>
      </div>
    </div>
  );
}
