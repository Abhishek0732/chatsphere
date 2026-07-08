// Procedural royalty-free music generator for ChatSphere's status music library.
// Pure Node (no deps): synthesizes short melodic loops and writes 16-bit PCM WAV.
// Original content — no licensing concerns; small, static, CDN-cacheable assets.
//
// Usage (Docker, no host installs):
//   docker run --rm -e OUT_DIR=/out -e SKIP_EXISTING=1 \
//     -v "$PWD/frontend/scripts":/work:ro -v "$PWD/frontend/public/music":/out \
//     -w /work node:20-alpine node gen-music.mjs
//
//   SKIP_EXISTING=1  -> only render tracks whose .wav isn't already on disk
//                       (keeps previously-committed files byte-for-byte stable).
//
// To add a track: append an entry to TRACKS below and to MUSIC_LIBRARY in
// src/features/status/musicLibrary.ts (matching `file` <-> `url`), then run this.
import { writeFileSync, existsSync } from 'node:fs';

const SR = 22050; // sample rate (mono) — small files, fine for background music
const OUT = process.env.OUT_DIR || '/out';
const SKIP_EXISTING = process.env.SKIP_EXISTING === '1';

// ---- helpers ---------------------------------------------------------------
const A4 = 440;
const mf = (n) => A4 * Math.pow(2, (n - 69) / 12); // midi -> frequency
const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function midi(name) {
  const m = name.match(/^([A-G]#?)(-?\d)$/);
  return NAMES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}
const clamp = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);

function env(t, dur, a, d, s, r) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / r);
  return 0;
}
function tone(ph, harmonics) {
  let v = 0;
  for (let h = 0; h < harmonics.length; h++) v += harmonics[h] * Math.sin(ph * (h + 1));
  return v;
}
const chord = (root, iv) => iv.map((i) => root + i);
const MAJ = [0, 4, 7];
const MIN = [0, 3, 7];
const MAJ7 = [0, 4, 7, 11];
const MIN7 = [0, 3, 7, 10];
const ADD9 = [0, 4, 7, 14];

// ---- track definitions -----------------------------------------------------
const TRACKS = [
  { file: 'lofi-chill.wav', bpm: 74, drums: true, swing: 0.12, pad: [0.5, 0.22, 0.12, 0.06], lead: [0.6, 0.15],
    prog: [['C3', MAJ7], ['A2', MIN7], ['F2', MAJ7], ['G2', ADD9]] },
  { file: 'sunset-drive.wav', bpm: 92, drums: true, swing: 0, pad: [0.45, 0.28, 0.14, 0.07], lead: [0.5, 0.22, 0.08],
    prog: [['D3', ADD9], ['A2', MAJ], ['B2', MIN7], ['G2', MAJ7]] },
  { file: 'midnight.wav', bpm: 68, drums: false, swing: 0, pad: [0.55, 0.3, 0.16, 0.09], lead: [0.4, 0.18],
    prog: [['A2', MIN7], ['E2', MIN7], ['F2', MAJ7], ['G2', MAJ]] },
  { file: 'piano-dreams.wav', bpm: 80, drums: false, swing: 0.08, pad: [0.7, 0.12, 0.05], lead: [0.75, 0.1],
    prog: [['C3', MAJ], ['G2', ADD9], ['A2', MIN7], ['F2', MAJ7]] },
  { file: 'ocean-waves.wav', bpm: 60, drums: false, swing: 0, pad: [0.5, 0.3, 0.2, 0.12, 0.06], lead: [0, 0],
    prog: [['D3', ADD9], ['F3', MAJ7], ['A2', MIN7], ['C3', MAJ7]] },
  { file: 'golden-hour.wav', bpm: 104, drums: true, swing: 0.1, pad: [0.4, 0.24, 0.12, 0.06], lead: [0.55, 0.2, 0.08],
    prog: [['E3', ADD9], ['B2', MIN7], ['C3', MAJ7], ['A2', MAJ7]] },
  { file: 'neon-nights.wav', bpm: 112, drums: true, swing: 0, pad: [0.3, 0.3, 0.22, 0.14, 0.08], lead: [0.5, 0.3, 0.15], saw: true,
    prog: [['F3', MIN7], ['C3', MIN7], ['G2', MIN7], ['A2', MAJ7]] },
  { file: 'morning-coffee.wav', bpm: 88, drums: true, swing: 0.14, pad: [0.45, 0.2, 0.1], lead: [0.6, 0.18, 0.06],
    prog: [['G3', MAJ], ['E3', MIN7], ['C3', MAJ7], ['D3', ADD9]] },

  // ---- second batch ----
  { file: 'hip-hop-nights.wav', bpm: 86, drums: true, swing: 0.16, pad: [0.5, 0.2, 0.1], lead: [0.5, 0.12],
    prog: [['A2', MIN7], ['D3', MIN7], ['F2', MAJ7], ['E2', MIN7]] },
  { file: 'slow-dance.wav', bpm: 72, drums: true, swing: 0.06, pad: [0.55, 0.28, 0.14, 0.07], lead: [0.6, 0.15],
    prog: [['F2', MAJ7], ['A2', MIN7], ['D3', MIN7], ['G2', ADD9]] },
  { file: 'power-up.wav', bpm: 128, drums: true, swing: 0, pad: [0.35, 0.3, 0.2, 0.12], lead: [0.5, 0.3, 0.15], saw: true,
    prog: [['C3', MIN7], ['G2', MIN7], ['A2', MAJ7], ['F2', MAJ7]] },
  { file: 'smooth-jazz.wav', bpm: 96, drums: true, swing: 0.2, pad: [0.45, 0.25, 0.14, 0.08], lead: [0.55, 0.2, 0.08],
    prog: [['D3', MIN7], ['G2', MAJ7], ['C3', MAJ7], ['A2', MIN7]] },
  { file: 'study-flow.wav', bpm: 80, drums: true, swing: 0.12, pad: [0.5, 0.22, 0.12, 0.06], lead: [0.55, 0.15],
    prog: [['E3', MIN7], ['C3', MAJ7], ['G2', ADD9], ['D3', MAJ7]] },
  { file: 'island-breeze.wav', bpm: 100, drums: true, swing: 0.08, pad: [0.4, 0.24, 0.12], lead: [0.6, 0.2, 0.08],
    prog: [['G3', MAJ], ['D3', ADD9], ['E3', MIN7], ['C3', MAJ7]] },
  { file: 'cinematic-rise.wav', bpm: 70, drums: false, swing: 0, pad: [0.5, 0.3, 0.2, 0.12, 0.06], lead: [0, 0],
    prog: [['A2', MIN7], ['F2', MAJ7], ['C3', ADD9], ['G2', MAJ7]] },
  { file: 'happy-days.wav', bpm: 116, drums: true, swing: 0.1, pad: [0.42, 0.24, 0.12, 0.06], lead: [0.6, 0.22, 0.08],
    prog: [['C3', MAJ], ['G2', MAJ], ['A2', MIN7], ['F2', ADD9]] },
];

// ---- synth ------------------------------------------------------------------
function render(t) {
  const spb = 60 / t.bpm;
  const beatsPerBar = 4;
  const barsCount = t.prog.length;
  const dur = barsCount * beatsPerBar * spb + 0.4;
  const N = Math.ceil(dur * SR);
  const buf = new Float32Array(N);
  const delaySamples = Math.floor(0.28 * SR);
  const delay = new Float32Array(N + delaySamples + 1);

  const add = (start, len, gain, fn) => {
    const s0 = Math.floor(start * SR);
    const s1 = Math.min(N, Math.floor((start + len) * SR));
    for (let i = s0; i < s1; i++) buf[i] += gain * fn((i - s0) / SR);
  };
  const noiseHat = (start, gain) => {
    const s0 = Math.floor(start * SR);
    const len = Math.floor(0.05 * SR);
    let last = 0;
    for (let i = s0; i < Math.min(N, s0 + len); i++) {
      const lt = (i - s0) / SR;
      const n = Math.random() * 2 - 1;
      last = last * 0.6 + n * 0.4;
      buf[i] += gain * (n - last) * Math.exp(-lt * 90);
    }
  };
  const kick = (start, gain) => add(start, 0.28, gain, (lt) => {
    const f = 120 * Math.exp(-lt * 22) + 45;
    return Math.sin(2 * Math.PI * f * lt) * Math.exp(-lt * 7);
  });

  for (let bar = 0; bar < barsCount; bar++) {
    const [rootName, iv] = t.prog[bar];
    const root = midi(rootName);
    const notes = chord(root, iv);
    const barStart = bar * beatsPerBar * spb;

    for (const nm of notes) {
      const f = mf(nm);
      add(barStart, beatsPerBar * spb, 0.16, (lt) => {
        const e = env(lt, beatsPerBar * spb, 0.35, 0.2, 0.85, 0.5);
        const harm = t.saw ? [0.5, 0.35, 0.25, 0.16, 0.1] : t.pad;
        const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * lt);
        return e * tone(2 * Math.PI * f * lt * vib, harm);
      });
    }

    const bassMidi = root - 12;
    for (const beat of [0, 2]) {
      const st = barStart + beat * spb;
      const f = mf(bassMidi);
      add(st, spb * 1.6, 0.5, (lt) => {
        const e = env(lt, spb * 1.6, 0.006, 0.12, 0.5, 0.3);
        return e * (Math.sin(2 * Math.PI * f * lt) + 0.25 * Math.sin(4 * Math.PI * f * lt));
      });
    }

    if (t.lead[0] > 0) {
      const arp = [...notes, notes[1] + 12, notes[0] + 12];
      const eighth = spb / 2;
      for (let e8 = 0; e8 < beatsPerBar * 2; e8++) {
        const swing = e8 % 2 === 1 ? t.swing * eighth : 0;
        const st = barStart + e8 * eighth + swing;
        const f = mf(arp[e8 % arp.length] + 12);
        add(st, eighth * 1.3, 0.14, (lt) => {
          const e = env(lt, eighth * 1.3, 0.005, 0.05, 0.3, 0.12);
          return e * tone(2 * Math.PI * f * lt, t.lead);
        });
      }
    }

    if (t.drums) {
      for (let beat = 0; beat < beatsPerBar; beat++) {
        if (beat % 2 === 0) kick(barStart + beat * spb, 0.6);
        noiseHat(barStart + beat * spb + spb / 2, 0.12);
        if (beat === 1 || beat === 3) noiseHat(barStart + beat * spb, 0.18);
      }
    }
  }

  for (let i = 0; i < N; i++) {
    const wet = buf[i] + (i >= delaySamples ? delay[i - delaySamples] * 0.32 : 0);
    delay[i] = wet;
    buf[i] = buf[i] * 0.8 + (i >= delaySamples ? delay[i - delaySamples] * 0.28 : 0);
  }

  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const norm = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < N; i++) buf[i] = clamp(Math.tanh(buf[i] * norm * 1.1));

  const fade = Math.floor(0.03 * SR);
  for (let i = 0; i < fade; i++) {
    buf[i] *= i / fade;
    buf[N - 1 - i] *= i / fade;
  }
  return { buf, dur };
}

function writeWav(path, buf) {
  const N = buf.length;
  const bytes = Buffer.alloc(44 + N * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + N * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), 44 + i * 2);
  writeFileSync(path, bytes);
}

const meta = [];
for (const t of TRACKS) {
  const path = `${OUT}/${t.file}`;
  if (SKIP_EXISTING && existsSync(path)) {
    console.log(`skip ${t.file} (exists)`);
    continue;
  }
  const { buf, dur } = render(t);
  writeWav(path, buf);
  meta.push({ file: t.file, durationMs: Math.round(dur * 1000) });
  console.log(`wrote ${t.file}  ${dur.toFixed(1)}s  ${(buf.length * 2 / 1024).toFixed(0)}KB`);
}
console.log('DURATIONS=' + JSON.stringify(meta));
