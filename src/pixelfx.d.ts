// pixelfx ships plain JavaScript without type definitions.
declare module 'pixelfx' {
  export interface PixelFrame {
    w: number;
    h: number;
    ox: number;
    oy: number;
    color: Uint32Array;
    light: Uint32Array;
  }
  export interface FxInstance {
    update(dt: number): void;
    draw(frame: PixelFrame, layer?: 'back' | 'front'): void;
    stop(): void;
    done(): boolean;
  }
  export function createFrame(w: number, h: number, ox?: number, oy?: number): PixelFrame;
  export function clearFrame(f: PixelFrame): PixelFrame;
  export function createFx(mod: unknown, o?: Record<string, unknown>): FxInstance;
  export function composite(f: PixelFrame, out: Uint8ClampedArray, bg?: number | null, lightK?: number): Uint8ClampedArray;
}
declare module 'pixelfx/fx/*' {
  export const meta: { size: [number, number]; origin: [number, number]; duration: number; loop: boolean };
}
