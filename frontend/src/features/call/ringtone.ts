/**
 * Tiny WebAudio ring synth — no audio asset, no bundle weight. The incoming ring
 * is one of several selectable tones (Settings › Ringtone); outgoing is a softer
 * ringback. Best effort under autoplay policies (outgoing follows a click, so it's
 * allowed; incoming resumes the context and tries).
 *
 * A browser can't use the phone's SYSTEM ringtone — there's no web API for it — so
 * these are self-contained synthesized tones the user picks from.
 */
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

/** A note in a tone: frequency (Hz), start offset (s), duration (s), peak gain. */
type Note = [freq: number, start: number, dur: number, peak?: number];

export interface RingtoneDef {
  id: string;
  label: string;
  wave: OscillatorType;
  /** How often the pattern repeats while ringing. */
  loopMs: number;
  notes: Note[];
}

/** The selectable incoming-call tones. All synthesized — nothing to download. */
export const RINGTONES: RingtoneDef[] = [
  { id: 'classic', label: 'Classic', wave: 'sine', loopMs: 2000, notes: [[660, 0, 0.32], [880, 0.38, 0.32]] },
  {
    id: 'marimba',
    label: 'Marimba',
    wave: 'triangle',
    loopMs: 2400,
    notes: [[523, 0, 0.16], [659, 0.16, 0.16], [784, 0.32, 0.16], [1047, 0.48, 0.22]],
  },
  {
    id: 'digital',
    label: 'Digital',
    wave: 'square',
    loopMs: 1600,
    notes: [[988, 0, 0.1, 0.07], [988, 0.16, 0.1, 0.07], [1319, 0.34, 0.14, 0.07]],
  },
  {
    id: 'chime',
    label: 'Chime',
    wave: 'sine',
    loopMs: 3000,
    notes: [[880, 0, 0.5, 0.12], [1320, 0.12, 0.7, 0.1]],
  },
  {
    id: 'pulse',
    label: 'Pulse',
    wave: 'sine',
    loopMs: 1800,
    notes: [[720, 0, 0.14], [720, 0.22, 0.14], [720, 0.44, 0.14]],
  },
  {
    id: 'ascend',
    label: 'Ascend',
    wave: 'triangle',
    loopMs: 2600,
    notes: [[587, 0, 0.18], [740, 0.2, 0.18], [880, 0.4, 0.18], [1175, 0.6, 0.26]],
  },
];

export const DEFAULT_RINGTONE = 'classic';

/** Softer descending ringback for the caller's side (not user-selectable). */
const RINGBACK: RingtoneDef = {
  id: 'ringback',
  label: 'Ringback',
  wave: 'sine',
  loopMs: 3000,
  notes: [[440, 0, 0.9, 0.07]],
};

function toneById(id: string | undefined): RingtoneDef {
  return RINGTONES.find((r) => r.id === id) ?? RINGTONES[0];
}

function ensureCtx(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

function note(wave: OscillatorType, freq: number, start: number, dur: number, peak = 0.14): void {
  const c = ensureCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/** Schedule one pass of a tone's pattern, starting at the context's current time. */
function playPattern(def: RingtoneDef): void {
  const c = ensureCtx();
  const t = c.currentTime;
  for (const [freq, start, dur, peak] of def.notes) {
    note(def.wave, freq, t + start, dur, peak);
  }
}

/**
 * Start ringing. For an incoming call, `toneId` selects which tone plays (the
 * user's chosen ringtone); outgoing always uses the ringback.
 */
export function startRingtone(mode: 'incoming' | 'outgoing', toneId?: string): void {
  stopRingtone();
  const c = ensureCtx();
  if (c.state === 'suspended') void c.resume();
  const def = mode === 'incoming' ? toneById(toneId) : RINGBACK;
  playPattern(def);
  timer = setInterval(() => playPattern(def), def.loopMs);
}

/** Play a tone once, for previewing in Settings. */
export function previewRingtone(toneId: string): void {
  stopRingtone();
  const c = ensureCtx();
  if (c.state === 'suspended') void c.resume();
  playPattern(toneById(toneId));
}

export function stopRingtone(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
