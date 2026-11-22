import { makeRng } from './rng';
import { allGroups, clearGroup, cloneState, detonate, newGame, GenOptions } from './rules';
import type { GameState } from './types';

export interface Level extends GenOptions {
  number: number;
  seed: number;
  /** Score needed for 1, 2 and 3 stars. */
  stars: [number, number, number];
}

export const LEVEL_COUNT = 24;

function levelOptions(n: number): GenOptions {
  // Gentle ramp: board grows, fruit types increase, gifts get scarcer.
  const t = (n - 1) / (LEVEL_COUNT - 1);
  const fruits = n <= 4 ? 3 : n <= 14 ? 4 : 5;
  const cols = Math.round(8 + 4 * t);
  const rows = Math.round(8 + 2 * t);
  const gifts = Math.max(2, Math.round(7 - 4 * t));
  return { cols, rows, fruits, gifts };
}

/** Plays a level with a simple strategy to estimate a fair target score. */
export function simulate(start: GameState, pick: 'big' | 'small'): number {
  const s = cloneState(start);
  for (let guard = 0; guard < 1000; guard++) {
    const groups = allGroups(s.board);
    if (groups.length) {
      groups.sort((a, b) => (pick === 'big' ? b.length - a.length : a.length - b.length));
      clearGroup(s, groups[0][0]);
      continue;
    }
    let bomb = null;
    for (let x = 0; x < s.board.cols && !bomb; x++)
      for (let y = 0; y < s.board.rows && !bomb; y++) if (s.board.cells[x][y]?.kind === 'bomb') bomb = { x, y };
    if (!bomb) break;
    detonate(s, bomb);
  }
  // Clear-board bonus is left out on purpose: it's a reward on top of the targets.
  return s.score;
}

const cache = new Map<number, Level>();

export function getLevel(n: number): Level {
  const hit = cache.get(n);
  if (hit) return hit;
  const opts = levelOptions(n);
  const seed = 1000 + n * 7919;
  const state = newGame(opts, makeRng(seed));
  const baseline = Math.max(simulate(state, 'big'), simulate(state, 'small'), 20);
  const round = (v: number) => Math.max(5, Math.round(v / 5) * 5);
  const level: Level = {
    ...opts,
    number: n,
    seed,
    stars: [round(baseline * 0.5), round(baseline * 0.85), round(baseline * 1.2)],
  };
  cache.set(n, level);
  return level;
}

export function startLevel(level: Level): GameState {
  return newGame(level, makeRng(level.seed));
}

export function starsFor(level: Level, score: number): number {
  return level.stars.filter((s) => score >= s).length;
}
