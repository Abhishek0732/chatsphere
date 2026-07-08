/**
 * Tiny WebAudio ring synth — no audio asset, no bundle weight. Plays a classic
 * two-blip ring for incoming calls and a softer ringback for outgoing. Best
 * effort under autoplay policies (outgoing follows a click, so it's allowed;
 * incoming resumes the context and tries).
 */
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

function blip(freq: number, start: number, dur: number, peak = 0.14): void {
  const c = ensureCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

export function startRingtone(mode: 'incoming' | 'outgoing'): void {
  stopRingtone();
  const c = ensureCtx();
  if (c.state === 'suspended') void c.resume();
  const play = () => {
    const t = c.currentTime;
    if (mode === 'incoming') {
      blip(660, t, 0.32);
      blip(880, t + 0.38, 0.32);
    } else {
      blip(440, t, 0.9, 0.07);
    }
  };
  play();
  timer = setInterval(play, mode === 'incoming' ? 2000 : 3000);
}

export function stopRingtone(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
