/** Tiny synthesized sound effects (no audio files needed). */
let ctx: AudioContext | null = null;
let muted = false;
let retro = false;

/** Retro skin: square-wave chiptune blips instead of soft tones. */
export function setRetroSound(on: boolean) {
  retro = on;
}

export function setMuted(m: boolean) {
  muted = m;
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = retro ? 'square' : type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(retro ? vol * 0.45 : vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  select: () => tone(660, 0, 0.08, 'triangle', 0.12),
  nope: () => tone(220, 0, 0.12, 'triangle', 0.1, 180),
  pop: (size: number) => {
    const base = 400 + Math.min(size, 20) * 30;
    for (let i = 0; i < Math.min(size, 6); i++) tone(base + i * 60, i * 0.035, 0.1, 'sine', 0.12, base * 1.5);
  },
  gift: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.18, 'triangle', 0.12)),
  boom: () => {
    tone(160, 0, 0.4, 'sawtooth', 0.18, 40);
    tone(90, 0.02, 0.5, 'square', 0.1, 30);
  },
  paint: () => tone(500, 0, 0.25, 'sine', 0.14, 1000),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.14)),
  done: () => [659, 587, 523].forEach((f, i) => tone(f, i * 0.14, 0.25, 'triangle', 0.12)),
};
