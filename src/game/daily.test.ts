import { describe, expect, it } from 'vitest';
import { dailyLevel, dateKey, hashSeed, prevDay, pruneDaily, startDaily, streak } from './daily';
import { hasMoves } from './rules';

const sig = (key: string) =>
  startDaily(key)
    .board.cells.flat()
    .map((t) => (t ? (t.kind === 'fruit' ? t.fruit : t.kind[0]) : '.'))
    .join('');

describe('daily puzzle', () => {
  it('gives the same board for the same date and a different one for another', () => {
    expect(sig('2026-11-22')).toBe(sig('2026-11-22'));
    expect(sig('2026-11-22')).not.toBe(sig('2026-11-23'));
    expect(hashSeed('a')).toBe(hashSeed('a'));
  });

  it('is playable with sensible star targets for the next 60 days', () => {
    let day = '2026-11-22';
    for (let i = 0; i < 60; i++) {
      const l = dailyLevel(day);
      expect(l.stars[0]).toBeLessThan(l.stars[1]);
      expect(l.stars[1]).toBeLessThan(l.stars[2]);
      expect(hasMoves(startDaily(day))).toBe(true);
      day = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8) + 1)).toISOString().slice(0, 10);
    }
  });

  it('formats dates', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2026-01-01')).toBe('2025-12-31');
  });

  it('counts streaks', () => {
    const d = { '2026-11-20': 10, '2026-11-21': 20, '2026-11-22': 30 };
    expect(streak(d, '2026-11-22')).toBe(3);
    expect(streak(d, '2026-11-23')).toBe(3); // today not played yet: streak is still alive
    expect(streak(d, '2026-11-24')).toBe(0); // missed a day
    expect(streak({ '2026-11-22': 5, '2026-11-20': 5 }, '2026-11-22')).toBe(1);
    expect(streak(undefined, '2026-11-22')).toBe(0);
  });

  it('keeps only recent days', () => {
    const big = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`2026-01-${String(i + 1).padStart(3, '0')}`, i]));
    expect(Object.keys(pruneDaily(big, 60))).toHaveLength(60);
  });
});
