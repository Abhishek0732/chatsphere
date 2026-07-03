import { create } from 'zustand';

interface ViewerData {
  /** Display name / caption — also the initials fallback when there's no image. */
  name: string;
  /** Image URL, if present. */
  src?: string;
  /** Suggested filename when downloading (defaults to the URL's last segment). */
  fileName?: string;
}

interface ImageViewerState {
  current: ViewerData | null;
  open: (name: string, src?: string, fileName?: string) => void;
  close: () => void;
}

/**
 * Global, single-instance image lightbox. Any avatar or image attachment can
 * call `useImageViewer.getState().open(name, src, fileName)` to show the picture
 * full-screen with a download option.
 */
export const useImageViewer = create<ImageViewerState>((set) => ({
  current: null,
  open: (name, src, fileName) => set({ current: { name, src, fileName } }),
  close: () => set({ current: null }),
}));
