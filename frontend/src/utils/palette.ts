// Turns a single base color into a full 50–900 brand scale plus a matching
// two-tone gradient, so a user's custom accent propagates through every
// `brand-*` token in the app. Output stops are "r g b" strings to feed the
// CSS variables that Tailwind reads via rgb(var(--brand-500) / <alpha>).

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Lightness ramp mirroring how a Tailwind-style scale steps; light stops are
// slightly desaturated so 50/100 don't look neon.
const RAMP: { stop: number; l: number; sMul: number }[] = [
  { stop: 50, l: 0.97, sMul: 0.4 },
  { stop: 100, l: 0.94, sMul: 0.55 },
  { stop: 200, l: 0.86, sMul: 0.72 },
  { stop: 300, l: 0.77, sMul: 0.85 },
  { stop: 400, l: 0.66, sMul: 0.95 },
  { stop: 500, l: 0.56, sMul: 1 },
  { stop: 600, l: 0.48, sMul: 1 },
  { stop: 700, l: 0.4, sMul: 0.98 },
  { stop: 800, l: 0.32, sMul: 0.94 },
  { stop: 900, l: 0.26, sMul: 0.9 },
];

export interface Palette {
  /** stop -> "r g b" */
  stops: Record<number, string>;
  gradFrom: string;
  gradTo: string;
}

export function paletteFromHex(hex: string): Palette {
  const [h, s0] = rgbToHsl(hexToRgb(hex));
  const s = Math.max(s0, 0.35); // ensure some vividness even from muted picks
  const stops: Record<number, string> = {};
  for (const { stop, l, sMul } of RAMP) {
    const [r, g, b] = hslToRgb(h, Math.min(s * sMul, 1), l);
    stops[stop] = `${r} ${g} ${b}`;
  }
  // Single-hue shading (no rainbow): light 500 → slightly darker 600.
  const gradFrom = toHex(hslToRgb(h, Math.min(s, 1), 0.56));
  const gradTo = toHex(hslToRgb(h, Math.min(s, 1), 0.47));
  return { stops, gradFrom, gradTo };
}

/** Derive a sensible darker companion for a custom chat-wallpaper color. */
export function darkenForWallpaper(hex: string): string {
  const [h, s] = rgbToHsl(hexToRgb(hex));
  return toHex(hslToRgb(h, Math.min(s * 0.9, 1), 0.09));
}
