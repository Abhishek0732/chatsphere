import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { paletteFromHex, darkenForWallpaper } from '@/utils/palette';

export type Theme = 'light' | 'dark' | 'system';

/** Accent color palettes (see `[data-accent]` sets in index.css). */
export type AccentKey =
  | 'whatsapp'
  | 'indigo'
  | 'blurple'
  | 'emerald'
  | 'blue'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'graphite';
/** Chat wallpapers (see `[data-wallpaper]` sets in index.css). */
export type WallpaperKey = 'doodle' | 'plain' | 'mint' | 'sky' | 'dusk';
export type FontKey = 'inter' | 'system' | 'rounded' | 'serif' | 'mono';
export type TextSizeKey = 'sm' | 'md' | 'lg' | 'xl';
export type RadiusKey = 'sharp' | 'default' | 'round';
export type BackgroundKey = 'aurora' | 'vivid' | 'mesh' | 'minimal';

export const ACCENTS: { key: AccentKey; label: string; swatch: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', swatch: '#25d366' },
  { key: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { key: 'blurple', label: 'Blurple', swatch: '#5865f2' },
  { key: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { key: 'blue', label: 'Blue', swatch: '#2563eb' },
  { key: 'emerald', label: 'Emerald', swatch: '#059669' },
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

export const FONTS: { key: FontKey; label: string; stack: string }[] = [
  {
    key: 'inter',
    label: 'Inter',
    stack: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  {
    key: 'system',
    label: 'System',
    stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    key: 'rounded',
    label: 'Rounded',
    stack: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Nunito, system-ui, sans-serif",
  },
  { key: 'serif', label: 'Serif', stack: "ui-serif, Georgia, Cambria, 'Times New Roman', serif" },
  {
    key: 'mono',
    label: 'Mono',
    stack: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  },
];

export const TEXT_SIZES: { key: TextSizeKey; label: string; px: string }[] = [
  { key: 'sm', label: 'Compact', px: '15px' },
  { key: 'md', label: 'Default', px: '16px' },
  { key: 'lg', label: 'Large', px: '17.5px' },
  { key: 'xl', label: 'Huge', px: '19px' },
];

export const RADII: { key: RadiusKey; label: string; panel: string; field: string }[] = [
  { key: 'sharp', label: 'Sharp', panel: '12px', field: '10px' },
  { key: 'default', label: 'Default', panel: '20px', field: '14px' },
  { key: 'round', label: 'Round', panel: '30px', field: '18px' },
];

export const BACKGROUNDS: { key: BackgroundKey; label: string }[] = [
  { key: 'aurora', label: 'Aurora' },
  { key: 'vivid', label: 'Vivid' },
  { key: 'mesh', label: 'Mesh' },
  { key: 'minimal', label: 'Minimal' },
];

const DEFAULTS = {
  accent: 'whatsapp' as AccentKey,
  wallpaper: 'doodle' as WallpaperKey,
  font: 'inter' as FontKey,
  textSize: 'md' as TextSizeKey,
  radius: 'default' as RadiusKey,
  background: 'minimal' as BackgroundKey,
  customAccent: null as string | null,
  customWallpaper: null as string | null,
};

const BRAND_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

const root = () => document.documentElement;

/** Apply/remove the `dark` class on <html>. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  root().classList.toggle('dark', isDark);
}

export function applyAccent(accent: AccentKey, customAccent: string | null): void {
  if (typeof document === 'undefined') return;
  const el = root();
  if (customAccent) {
    const p = paletteFromHex(customAccent);
    for (const stop of BRAND_STOPS) el.style.setProperty(`--brand-${stop}`, p.stops[stop]);
    el.style.setProperty('--grad-from', p.gradFrom);
    el.style.setProperty('--grad-to', p.gradTo);
    el.setAttribute('data-accent', 'custom');
  } else {
    for (const stop of BRAND_STOPS) el.style.removeProperty(`--brand-${stop}`);
    el.style.removeProperty('--grad-from');
    el.style.removeProperty('--grad-to');
    el.setAttribute('data-accent', accent);
  }
}

export function applyWallpaper(wallpaper: WallpaperKey, customWallpaper: string | null): void {
  if (typeof document === 'undefined') return;
  const el = root();
  if (customWallpaper) {
    el.style.setProperty('--chat-bg', customWallpaper);
    el.style.setProperty('--chat-bg-dark', darkenForWallpaper(customWallpaper));
    el.style.setProperty('--chat-dot', 'transparent');
    el.style.setProperty('--chat-dot-dark', 'transparent');
    el.setAttribute('data-wallpaper', 'custom');
  } else {
    for (const v of ['--chat-bg', '--chat-bg-dark', '--chat-dot', '--chat-dot-dark'])
      el.style.removeProperty(v);
    el.setAttribute('data-wallpaper', wallpaper);
  }
}

export function applyFont(font: FontKey): void {
  if (typeof document === 'undefined') return;
  const stack = FONTS.find((f) => f.key === font)?.stack ?? FONTS[0].stack;
  root().style.setProperty('--font-sans', stack);
}

export function applyTextSize(size: TextSizeKey): void {
  if (typeof document === 'undefined') return;
  const px = TEXT_SIZES.find((s) => s.key === size)?.px ?? '16px';
  root().style.fontSize = px;
}

export function applyRadius(radius: RadiusKey): void {
  if (typeof document === 'undefined') return;
  const r = RADII.find((x) => x.key === radius) ?? RADII[1];
  root().style.setProperty('--radius-panel', r.panel);
  root().style.setProperty('--radius-field', r.field);
}

export function applyBackground(bg: BackgroundKey): void {
  if (typeof document === 'undefined') return;
  root().setAttribute('data-bg', bg);
}

interface ThemeState {
  theme: Theme;
  accent: AccentKey;
  wallpaper: WallpaperKey;
  font: FontKey;
  textSize: TextSizeKey;
  radius: RadiusKey;
  background: BackgroundKey;
  customAccent: string | null;
  customWallpaper: string | null;

  setTheme: (theme: Theme) => void;
  toggle: () => void;
  setAccent: (accent: AccentKey) => void;
  setCustomAccent: (hex: string) => void;
  setWallpaper: (wallpaper: WallpaperKey) => void;
  setCustomWallpaper: (hex: string) => void;
  setFont: (font: FontKey) => void;
  setTextSize: (size: TextSizeKey) => void;
  setRadius: (radius: RadiusKey) => void;
  setBackground: (bg: BackgroundKey) => void;
  resetAppearance: () => void;
  /** Kept for API compatibility (per-user chat theme). */
  loadForUser: (userId: number | string | null) => void;
}

/** Apply the whole appearance snapshot to the DOM. */
function applyAll(s: {
  theme: Theme;
  accent: AccentKey;
  customAccent: string | null;
  wallpaper: WallpaperKey;
  customWallpaper: string | null;
  font: FontKey;
  textSize: TextSizeKey;
  radius: RadiusKey;
  background: BackgroundKey;
}): void {
  applyTheme(s.theme);
  applyAccent(s.accent, s.customAccent);
  applyWallpaper(s.wallpaper, s.customWallpaper);
  applyFont(s.font);
  applyTextSize(s.textSize);
  applyRadius(s.radius);
  applyBackground(s.background);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      ...DEFAULTS,

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggle: () => {
        const current = get().theme;
        const resolved = current === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : current;
        const next: Theme = resolved === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },

      setAccent: (accent) => {
        applyAccent(accent, null);
        set({ accent, customAccent: null });
      },
      setCustomAccent: (hex) => {
        applyAccent(get().accent, hex);
        set({ customAccent: hex });
      },
      setWallpaper: (wallpaper) => {
        applyWallpaper(wallpaper, null);
        set({ wallpaper, customWallpaper: null });
      },
      setCustomWallpaper: (hex) => {
        applyWallpaper(get().wallpaper, hex);
        set({ customWallpaper: hex });
      },
      setFont: (font) => {
        applyFont(font);
        set({ font });
      },
      setTextSize: (textSize) => {
        applyTextSize(textSize);
        set({ textSize });
      },
      setRadius: (radius) => {
        applyRadius(radius);
        set({ radius });
      },
      setBackground: (background) => {
        applyBackground(background);
        set({ background });
      },
      resetAppearance: () => {
        set({ ...DEFAULTS });
        applyAll({ theme: get().theme, ...DEFAULTS });
      },

      loadForUser: () => {
        // Appearance is now global per browser; nothing per-user to load.
      },
    }),
    {
      name: 'chatsphere-theme',
      version: 3,
      // Move users still on an old default accent to the current WhatsApp-green
      // default (but keep any accent they deliberately chose / any custom color).
      migrate: (persisted: unknown, version: number) => {
        const st = (persisted ?? {}) as {
          accent?: AccentKey;
          customAccent?: string | null;
          background?: BackgroundKey;
        };
        const oldDefaults: AccentKey[] = ['violet', 'blurple', 'indigo'];
        const wasDefault = !st.accent || oldDefaults.includes(st.accent);
        if (version < 3 && wasDefault && !st.customAccent) {
          st.accent = 'whatsapp';
          st.background = 'minimal';
        }
        return st;
      },
      onRehydrateStorage: () => (state) => {
        applyAll({
          theme: state?.theme ?? 'system',
          accent: state?.accent ?? DEFAULTS.accent,
          customAccent: state?.customAccent ?? null,
          wallpaper: state?.wallpaper ?? DEFAULTS.wallpaper,
          customWallpaper: state?.customWallpaper ?? null,
          font: state?.font ?? DEFAULTS.font,
          textSize: state?.textSize ?? DEFAULTS.textSize,
          radius: state?.radius ?? DEFAULTS.radius,
          background: state?.background ?? DEFAULTS.background,
        });
      },
    },
  ),
);
