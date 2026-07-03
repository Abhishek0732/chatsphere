import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Optional navigation target when the toast is clicked. */
  href?: string;
  duration: number;
}

/**
 * What callers pass in. `id`, `variant`, and `duration` are all optional here
 * (they're defaulted in `push`), while the stored {@link Toast} always has them.
 */
export type ToastInput = Omit<Toast, 'id' | 'variant' | 'duration'> & {
  id?: string;
  variant?: ToastVariant;
  duration?: number;
};

interface ToastState {
  toasts: Toast[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => {
    const id = toast.id ?? `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const full: Toast = {
      id,
      title: toast.title,
      description: toast.description,
      variant: toast.variant ?? 'default',
      href: toast.href,
      duration: toast.duration ?? 4000,
    };
    set((state) => ({ toasts: [...state.toasts, full] }));
    if (full.duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, full.duration);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Non-hook helper for firing toasts from plain modules. */
export const toast = (t: ToastInput) => useToastStore.getState().push(t);
