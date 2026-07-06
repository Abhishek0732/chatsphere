import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

/** Accent color palettes (see `[data-accent]` sets in index.css). */
export type AccentKey = 'emerald' | 'blue' | 'violet' | 'rose' | 'amber' | 'graphite';
/** Chat wallpapers (see `[data-wallpaper]` sets in index.css). */
export type WallpaperKey = 'doodle' | 'plain' | 'mint' | 'sky' | 'dusk';

export const ACCENTS: { key: AccentKey; label: string; swatch: string }[] = [
  { key: 'emerald', label: 'Emerald', swatch: '#059669' },
  { key: 'blue', label: 'Blue', swatch: '#2563eb' },
  { key: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { key: 'rose', label: 'Rose', swatch: '#e11d48' },
  { key: 'amber', label: 'Amber', swatch: '#d97706' },
  { key: 'graphite', label: 'Graphite', swatch: '#475569' },
];

export const WALLPAPERS: {
  key: WallpaperKey;
  label: string;
  light: string;
  dark: string;
}[] = [
  { key: 'doodle', label: 'Doodle', light: '#efeae2', dark: '#0b141a' },
  { key: 'plain', label: 'Plain', light: '#f4f2ee', dark: '#0e1a1f' },
  { key: 'mint', label: 'Mint', light: '#e6f3ec', dark: '#0a1a13' },
  { key: 'sky', label: 'Sky', light: '#e8f0fb', dark: '#0a141f' },
  { key: 'dusk', label: 'Dusk', light: '#efe9f7', dark: '#150f1f' },
];

const DEFAULT_ACCENT: AccentKey = 'violet';
const DEFAULT_WALLPAPER: WallpaperKey = 'doodle';

interface Prefs {
  accent: AccentKey;
  wallpaper: WallpaperKey;
}

interface ThemeState {
  /** Light/dark mode — kept global (per browser). */
  theme: Theme;
  /** Active accent + wallpaper for the currently-loaded user. */
  accent: AccentKey;
  wallpaper: WallpaperKey;
  /** Per-user chat-theme preferences, keyed by user id (or "guest"). */
  byUser: Record<string, Prefs>;
  currentUserKey: string;

  setTheme: (theme: Theme) => void;
  toggle: () => void;
  setAccent: (accent: AccentKey) => void;
  setWallpaper: (wallpaper: WallpaperKey) => void;
  /** Load and apply the chat theme for a given user (call on login/logout). */
  loadForUser: (userId: number | string | null) => void;
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Apply/remove the `dark` class on <html>. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
}

export function applyAccent(accent: AccentKey): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-accent', accent);
}

export function applyWallpaper(wallpaper: WallpaperKey): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-wallpaper', wallpaper);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      accent: DEFAULT_ACCENT,
      wallpaper: DEFAULT_WALLPAPER,
      byUser: {},
      currentUserKey: 'guest',

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggle: () => {
        const current = get().theme;
        // Resolve "system" to its concrete value first, then flip.
        const resolved = current === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : current;
        const next: Theme = resolved === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },

      setAccent: (accent) => {
        applyAccent(accent);
        const key = get().currentUserKey;
        set((s) => ({
          accent,
          byUser: { ...s.byUser, [key]: { accent, wallpaper: s.wallpaper } },
        }));
      },
      setWallpaper: (wallpaper) => {
        applyWallpaper(wallpaper);
        const key = get().currentUserKey;
        set((s) => ({
          wallpaper,
          byUser: { ...s.byUser, [key]: { accent: s.accent, wallpaper } },
        }));
      },

      loadForUser: (userId) => {
        const key = userId == null ? 'guest' : String(userId);
        const prefs = get().byUser[key] ?? {
          accent: DEFAULT_ACCENT,
          wallpaper: DEFAULT_WALLPAPER,
        };
        applyAccent(prefs.accent);
        applyWallpaper(prefs.wallpaper);
        set({ accent: prefs.accent, wallpaper: prefs.wallpaper, currentUserKey: key });
      },
    }),
    {
      name: 'chatsphere-theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? 'system');
        applyAccent(state?.accent ?? DEFAULT_ACCENT);
        applyWallpaper(state?.wallpaper ?? DEFAULT_WALLPAPER);
      },
    },
  ),
);
