import { makeRng } from './rng';
import { simulate, Level } from './levels';
import { newGame } from './rules';
import type { GameState } from './types';

/** Local calendar date as YYYY-MM-DD. Everyone with the same date plays the same board. */
export function dateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The day before `key` (calendar arithmetic, so daylight saving can't skip a day). */
export function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export function isDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** "Sat, Nov 22" for display. */
export function prettyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** FNV-1a: the same text always gives the same number, on every device. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const cache = new Map<string, Level>();

/** The day's puzzle: same board for everyone, with star targets from a bot playthrough. */
export function dailyLevel(key: string): Level {
  const hit = cache.get(key);
  if (hit) return hit;
  const opts = { cols: 10, rows: 9, fruits: 4, gifts: 7 };
  const seed = hashSeed(`groupbox-daily-${key}`);
  const baseline = Math.max(simulate(newGame(opts, makeRng(seed)), 'big'), simulate(newGame(opts, makeRng(seed)), 'small'), 20);
  const round = (v: number) => Math.max(5, Math.round(v / 5) * 5);
  const level: Level = { ...opts, number: 0, seed, stars: [round(baseline * 0.5), round(baseline * 0.85), round(baseline * 1.2)] };
  cache.set(key, level);
  return level;
}

export function startDaily(key: string): GameState {
  const l = dailyLevel(key);
  return newGame(l, makeRng(l.seed));
}

/** Days in a row, ending today (or yesterday if today isn't played yet). */
export function streak(daily: Record<string, number> | undefined, today: string): number {
  if (!daily) return 0;
  let day = daily[today] !== undefined ? today : prevDay(today);
  let n = 0;
  while (daily[day] !== undefined) {
    n++;
    day = prevDay(day);
  }
  return n;
}

/** Keep the saved history small: the most recent `keep` days. */
export function pruneDaily(daily: Record<string, number>, keep = 60): Record<string, number> {
  const days = Object.keys(daily).sort().slice(-keep);
  return Object.fromEntries(days.map((d) => [d, daily[d]]));
}
