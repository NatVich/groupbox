/** Saved progress and settings, kept in this browser only. */
export interface SaveData {
  levelStars: Record<number, number>;
  levelBest: Record<number, number>;
  calmBest: number;
  muted: boolean;
  oneTap: boolean;
}

const KEY = 'groupbox-save-v1';

const defaults = (): SaveData => ({ levelStars: {}, levelBest: {}, calmBest: 0, muted: false, oneTap: false });

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    /* storage unavailable: play without saving */
  }
  return defaults();
}

export function save(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
