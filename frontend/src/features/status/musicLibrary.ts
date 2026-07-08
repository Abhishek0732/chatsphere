// Curated, royalty-free music library for status (WhatsApp-style).
// Tracks are original loops shipped as static assets under /public/music, so
// they're served same-origin, CDN-cacheable, and add zero backend load at scale.

/** A chosen track — from the library or the user's own device. */
export interface MusicSelection {
  url: string;
  title: string;
  artist: string;
  durationMs: number;
}

export interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  /** Emoji used as lightweight cover art (no image asset to download). */
  emoji: string;
  /** Tailwind gradient classes for the cover tile. */
  cover: string;
  /** Same-origin static URL. */
  url: string;
  durationMs: number;
}

export const MUSIC_LIBRARY: LibraryTrack[] = [
  {
    id: 'lofi-chill',
    title: 'Lo-Fi Chill',
    artist: 'Mellow Beats',
    genre: 'Lo-Fi',
    emoji: '🎧',
    cover: 'from-violet-500 to-indigo-600',
    url: '/music/lofi-chill.wav',
    durationMs: 13373,
  },
  {
    id: 'sunset-drive',
    title: 'Sunset Drive',
    artist: 'Neon Skyline',
    genre: 'Synthwave',
    emoji: '🌆',
    cover: 'from-orange-400 to-pink-600',
    url: '/music/sunset-drive.wav',
    durationMs: 10835,
  },
  {
    id: 'midnight',
    title: 'Midnight',
    artist: 'Blue Hour',
    genre: 'Ambient',
    emoji: '🌙',
    cover: 'from-indigo-500 to-slate-800',
    url: '/music/midnight.wav',
    durationMs: 14518,
  },
  {
    id: 'piano-dreams',
    title: 'Piano Dreams',
    artist: 'Aria Keys',
    genre: 'Piano',
    emoji: '🎹',
    cover: 'from-slate-400 to-slate-700',
    url: '/music/piano-dreams.wav',
    durationMs: 12400,
  },
  {
    id: 'ocean-waves',
    title: 'Ocean Waves',
    artist: 'Calm Tides',
    genre: 'Chill',
    emoji: '🌊',
    cover: 'from-cyan-400 to-blue-600',
    url: '/music/ocean-waves.wav',
    durationMs: 16400,
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour',
    artist: 'Warm Light',
    genre: 'Pop',
    emoji: '☀️',
    cover: 'from-amber-400 to-orange-600',
    url: '/music/golden-hour.wav',
    durationMs: 9631,
  },
  {
    id: 'neon-nights',
    title: 'Neon Nights',
    artist: 'Synth City',
    genre: 'Electronic',
    emoji: '🕹️',
    cover: 'from-fuchsia-500 to-purple-700',
    url: '/music/neon-nights.wav',
    durationMs: 8971,
  },
  {
    id: 'morning-coffee',
    title: 'Morning Coffee',
    artist: 'Daybreak',
    genre: 'Acoustic',
    emoji: '☕',
    cover: 'from-emerald-400 to-teal-600',
    url: '/music/morning-coffee.wav',
    durationMs: 11309,
  },
];
