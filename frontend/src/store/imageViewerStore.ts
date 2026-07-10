import { create } from 'zustand';

export interface ViewerData {
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

/** A single navigable image in a gallery. */
export interface GalleryImage {
  name: string;
  src?: string;
}

interface ImageViewerState {
  /** The set currently open (one item for a single image, many for a gallery). */
  items: ViewerData[];
  index: number;
  current: ViewerData | null;
  open: (name: string, src?: string, opts?: OpenOptions) => void;
  /** Open a navigable gallery starting at `index`. */
  openGallery: (images: GalleryImage[], index: number) => void;
  next: () => void;
  prev: () => void;
  close: () => void;
}

/**
 * Global, single-instance image lightbox. Any avatar or image attachment can
 * call `useImageViewer.getState().open(name, src, opts)` to show one picture, or
 * `openGallery(images, index)` to show a set the user can page through with the
 * arrows / arrow keys. `current` always reflects `items[index]`.
 */
export const useImageViewer = create<ImageViewerState>((set, get) => ({
  items: [],
  index: 0,
  current: null,
  open: (name, src, opts) => {
    const item: ViewerData = {
      name,
      src,
      fileName: opts?.fileName,
      circle: opts?.circle,
      protected: opts?.protected,
    };
    set({ items: [item], index: 0, current: item });
  },
  openGallery: (images, index) => {
    if (images.length === 0) return;
    const i = Math.min(Math.max(index, 0), images.length - 1);
    set({ items: images, index: i, current: images[i] });
  },
  next: () => {
    const { items, index } = get();
    if (index < items.length - 1) set({ index: index + 1, current: items[index + 1] });
  },
  prev: () => {
    const { items, index } = get();
    if (index > 0) set({ index: index - 1, current: items[index - 1] });
  },
  close: () => set({ items: [], index: 0, current: null }),
}));
