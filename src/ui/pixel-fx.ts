import { clearFrame, composite, createFrame, createFx, FxInstance, PixelFrame } from 'pixelfx';
import * as collectBurst from 'pixelfx/fx/pickups/collect-burst';
import * as poof from 'pixelfx/fx/spawn/poof';
import * as cartoonPow from 'pixelfx/fx/explosions/cartoon-pow';
import * as fireworkBurst from 'pixelfx/fx/explosions/firework-burst';
import * as confetti from 'pixelfx/fx/ui/confetti';

/**
 * Pixel-art effects from pixelfx (MIT, github.com/patch-gg/pixelfx), drawn on a low-resolution
 * canvas laid over the board and scaled up with crisp pixels. The canvas only animates while an
 * effect is playing.
 */

/** Each effect is drawn from its origin; `dy` moves the origin so the effect is centred on the spot. */
const EFFECTS = {
  burst: { mod: collectBurst, dy: 40 },
  poof: { mod: poof, dy: 30 },
  pow: { mod: cartoonPow, dy: 0 },
  firework: { mod: fireworkBurst, dy: 0 },
  confetti: { mod: confetti, dy: 0 },
} as const;

export type EffectName = keyof typeof EFFECTS;

/** Dark-to-bright colour ramps that tint effects to match a fruit. */
export const FRUIT_RAMPS: string[][] = [
  ['#3a0a14', '#8a1a30', '#ff4d6d', '#ff9ab0', '#ffe0ea', '#ffffff'], // strawberry
  ['#3a2a00', '#8a6a00', '#ffd60a', '#ffe866', '#fff6c2', '#ffffff'], // lemon
  ['#22083a', '#55188a', '#9d4edd', '#c99aff', '#efe0ff', '#ffffff'], // grape
  ['#0a1240', '#1e3aa0', '#4361ee', '#8ea4ff', '#dde4ff', '#ffffff'], // blueberry
  ['#0c2a10', '#1f6a2a', '#52b788', '#9ae6b4', '#e0ffe8', '#ffffff'], // kiwi
  ['#3a1800', '#8a3c00', '#ff8c1a', '#ffbb6a', '#ffe8cc', '#ffffff'], // orange
];

const PIXEL = 2; // CSS pixels per effect pixel
const MARGIN = 48; // CSS pixels the canvas reaches past the board, so big effects aren't cut off

export class PixelFxLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private frame: PixelFrame | null = null;
  private image: ImageData | null = null;
  private live: FxInstance[] = [];
  private raf = 0;
  private last = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pixel-fx';
    this.canvas.style.inset = `-${MARGIN}px`;
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  /** Match the canvas to the board's size (in CSS pixels). */
  resize(width: number, height: number) {
    const w = Math.max(1, Math.ceil((width + MARGIN * 2) / PIXEL));
    const h = Math.max(1, Math.ceil((height + MARGIN * 2) / PIXEL));
    if (this.frame && this.frame.w === w && this.frame.h === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.frame = createFrame(w, h);
    this.image = this.ctx?.createImageData(w, h) ?? null;
  }

  /** Play an effect centred on (x, y), in CSS pixels from the board's top-left corner. */
  play(name: EffectName, x: number, y: number, options: Record<string, unknown> = {}) {
    if (this.reduced || !this.frame) return;
    const e = EFFECTS[name];
    this.live.push(
      createFx(e.mod, {
        x: Math.round((x + MARGIN) / PIXEL),
        y: Math.round((y + MARGIN) / PIXEL + e.dy),
        seed: Math.floor(Math.random() * 1e6),
        ...options,
      }),
    );
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.tick(t));
    }
  }

  clear() {
    this.live = [];
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.live = [];
    this.canvas.remove();
  }

  private tick(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const f = this.frame;
    if (!f || !this.image || !this.ctx) {
      this.raf = 0; // nothing to draw on; let the next play() start a fresh loop
      return;
    }
    clearFrame(f);
    for (const fx of this.live) {
      fx.update(dt);
      fx.draw(f);
    }
    this.live = this.live.filter((fx) => !fx.done());
    composite(f, this.image.data, null);
    this.ctx.putImageData(this.image, 0, 0);
    if (this.live.length) {
      this.raf = requestAnimationFrame((t) => this.tick(t));
    } else {
      this.raf = 0;
      this.ctx.clearRect(0, 0, f.w, f.h);
    }
  }
}
