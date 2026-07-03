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
}

interface OpenOptions {
  fileName?: string;
  circle?: boolean;
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
    set({ current: { name, src, fileName: opts?.fileName, circle: opts?.circle } }),
  close: () => set({ current: null }),
}));
