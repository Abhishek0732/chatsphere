import { create } from 'zustand';

interface ViewerData {
  /** Display name / caption — also the initials fallback when there's no image. */
  name: string;
  /** Image URL, if present. */
  src?: string;
  /** Suggested filename when downloading (defaults to the URL's last segment). */
  fileName?: string;
  /** Render as a circle (profile pictures) vs. a rectangle (message images). */
  circle?: boolean;
  /**
   * The PICTURED user enabled protection AND the current user isn't the owner —
   * so hide download + deter screenshots. The owner always sees their own photo
   * unprotected (they can download it); only other viewers are restricted.
   */
  protected?: boolean;
}

interface OpenOptions {
  fileName?: string;
  circle?: boolean;
  protected?: boolean;
}

interface ImageViewerState {
  current: ViewerData | null;
  open: (name: string, src?: string, opts?: OpenOptions) => void;
  close: () => void;
}

/**
 * Global, single-instance image lightbox. Any avatar or image attachment can
 * call `useImageViewer.getState().open(name, src, opts)` to show the picture
 * full-screen with a download option. Pass `{ circle: true }` for profile
 * pictures so every avatar renders as a consistent circle.
 */
export const useImageViewer = create<ImageViewerState>((set) => ({
  current: null,
  open: (name, src, opts) =>
    set({
      current: {
        name,
        src,
        fileName: opts?.fileName,
        circle: opts?.circle,
        protected: opts?.protected,
      },
    }),
  close: () => set({ current: null }),
}));
