import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useImageViewer } from '@/store/imageViewerStore';
import { downloadFile } from '@/utils/download';
import { cn } from '@/utils/cn';
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
  const items = useImageViewer((s) => s.items);
  const index = useImageViewer((s) => s.index);
  const next = useImageViewer((s) => s.next);
  const prev = useImageViewer((s) => s.prev);
  const [obscured, setObscured] = useState(false);

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const isGallery = items.length > 1;

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, close, next, prev]);

  // Screenshot deterrent for a protected photo: blur it whenever the tab is
  // backgrounded or a screenshot key is pressed, so a casual capture is blurred.
  // (The web has no true screenshot block — this is best-effort, like modern messengers.)
  const isProtected = !!current?.protected;
  useEffect(() => {
    if (!isProtected) {
      setObscured(false);
      return;
    }
    const hide = () => setObscured(true);
    const show = () => setObscured(false);
    const onVisibility = () => (document.hidden ? hide() : show());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || ((e.metaKey || e.ctrlKey) && e.shiftKey)) {
        hide();
        window.setTimeout(show, 1500);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      window.removeEventListener('keydown', onKey);
    };
  }, [isProtected]);

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
        {/* Download is hidden for protected photos. */}
        {current.src && !isProtected && (
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

      {/* Prev / next arrows for a gallery. */}
      {isGallery && hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white/90 transition hover:bg-white/20 hover:text-white sm:left-4"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {isGallery && hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white/90 transition hover:bg-white/20 hover:text-white sm:right-4"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Stop propagation so clicking the image itself doesn't close the viewer. */}
      <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        {current.src ? (
          current.circle ? (
            // Profile pictures: fixed square cropped to a circle, so every
            // avatar looks consistent regardless of the source aspect ratio.
            <img
              src={mediaSrc(current.src)}
              alt={current.name}
              draggable={isProtected ? false : undefined}
              onContextMenu={isProtected ? (e) => e.preventDefault() : undefined}
              className={cn(
                'h-64 w-64 rounded-full object-cover shadow-2xl transition sm:h-80 sm:w-80',
                isProtected && 'select-none [-webkit-touch-callout:none]',
                obscured && 'scale-105 blur-2xl',
              )}
            />
          ) : (
            <img
              src={mediaSrc(current.src)}
              alt={current.name}
              draggable={isProtected ? false : undefined}
              onContextMenu={isProtected ? (e) => e.preventDefault() : undefined}
              className={cn(
                'max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl transition',
                isProtected && 'select-none [-webkit-touch-callout:none]',
                obscured && 'scale-105 blur-2xl',
              )}
            />
          )
        ) : (
          <div className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-6xl font-semibold text-white shadow-2xl">
            {initials(current.name)}
          </div>
        )}
        <p className="text-lg font-medium text-white">{current.name}</p>
        {isGallery && (
          <span className="text-sm font-medium text-white/60">
            {index + 1} / {items.length}
          </span>
        )}
      </div>
    </div>
  );
}
