// Curated, royalty-free music library for status (messenger-style).
// Tracks are original loops shipped as static assets under /public/music, so
// they're served same-origin, CDN-cacheable, and add zero backend load at scale.

/** A chosen track — from the library or the user's own device. */
export interface MusicSelection {
  url: string;
  title: string;
  artist: string;
  durationMs: number;
  /** Where in the track playback starts (ms) — a scrubbed segment. Defaults to 0. */
  startMs?: number;
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
  {
    id: 'hip-hop-nights',
    title: 'Hip-Hop Nights',
    artist: 'Boom Bap',
    genre: 'Hip-Hop',
    emoji: '🎤',
    cover: 'from-zinc-600 to-slate-900',
    url: '/music/hip-hop-nights.wav',
    durationMs: 11563,
  },
  {
    id: 'slow-dance',
    title: 'Slow Dance',
    artist: 'Velvet Heart',
    genre: 'R&B',
    emoji: '💕',
    cover: 'from-rose-400 to-pink-600',
    url: '/music/slow-dance.wav',
    durationMs: 13733,
  },
  {
    id: 'power-up',
    title: 'Power Up',
    artist: 'Pulse Drive',
    genre: 'EDM',
    emoji: '🔥',
    cover: 'from-red-500 to-orange-600',
    url: '/music/power-up.wav',
    durationMs: 7900,
  },
  {
    id: 'smooth-jazz',
    title: 'Smooth Jazz',
    artist: 'Blue Note',
    genre: 'Jazz',
    emoji: '🎷',
    cover: 'from-blue-500 to-indigo-700',
    url: '/music/smooth-jazz.wav',
    durationMs: 10400,
  },
  {
    id: 'study-flow',
    title: 'Study Flow',
    artist: 'Focus Loop',
    genre: 'Chillhop',
    emoji: '📚',
    cover: 'from-teal-500 to-emerald-700',
    url: '/music/study-flow.wav',
    durationMs: 12400,
  },
  {
    id: 'island-breeze',
    title: 'Island Breeze',
    artist: 'Palm Coast',
    genre: 'Tropical',
    emoji: '🏝️',
    cover: 'from-lime-400 to-cyan-500',
    url: '/music/island-breeze.wav',
    durationMs: 10000,
  },
  {
    id: 'cinematic-rise',
    title: 'Cinematic Rise',
    artist: 'Aurora Score',
    genre: 'Cinematic',
    emoji: '🎬',
    cover: 'from-purple-500 to-slate-900',
    url: '/music/cinematic-rise.wav',
    durationMs: 14114,
  },
  {
    id: 'happy-days',
    title: 'Happy Days',
    artist: 'Sunbeam',
    genre: 'Feel-Good',
    emoji: '😄',
    cover: 'from-yellow-400 to-orange-500',
    url: '/music/happy-days.wav',
    durationMs: 8676,
  },
];
