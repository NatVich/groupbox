import { describe, expect, it } from 'vitest';
import { makeRng } from './rng';
import {
  applyGravity,
  clearGroup,
  detonate,
  findGroup,
  finishRound,
  groupPoints,
  hasMoves,
  newGame,
  paint,
  CLEAR_BONUS,
  STAR_POINTS,
} from './rules';
import { getLevel, LEVEL_COUNT, startLevel, starsFor } from './levels';
import type { Board, GameState, Tile } from './types';

/**
 * Build a state from rows of chars (top row first):
 *  0-5 fruit, R rainbow, B bomb tile, . empty,
 *  b/r/p/s gift (bomb/rainbow/paint brush/star)
 */
function make(rows: string[]): GameState {
  const h = rows.length;
  const w = rows[0].length;
  let id = 1;
  const cells: (Tile | null)[][] = [];
  for (let x = 0; x < w; x++) {
    const col: (Tile | null)[] = [];
    for (let y = 0; y < h; y++) {
      const c = rows[y][x];
      let t: Tile | null = null;
      if (/[0-5]/.test(c)) t = { kind: 'fruit', id, fruit: Number(c) };
      else if (c === 'R') t = { kind: 'rainbow', id };
      else if (c === 'B') t = { kind: 'bomb', id };
      else if (c === 'b') t = { kind: 'gift', id, gift: 'bomb' };
      else if (c === 'r') t = { kind: 'gift', id, gift: 'rainbow' };
      else if (c === 'p') t = { kind: 'gift', id, gift: 'brush' };
      else if (c === 's') t = { kind: 'gift', id, gift: 'star' };
      id++;
      col.push(t);
    }
    cells.push(col);
  }
  return { board: { cols: w, rows: h, cells }, score: 0, brushes: 0, bonusStars: 0, moves: 0, nextId: id };
}

function show(b: Board): string[] {
  const out: string[] = [];
  for (let y = 0; y < b.rows; y++) {
    let line = '';
    for (let x = 0; x < b.cols; x++) {
      const t = b.cells[x][y];
      line +=
        !t ? '.'
        : t.kind === 'fruit' ? String(t.fruit)
        : t.kind === 'rainbow' ? 'R'
        : t.kind === 'bomb' ? 'B'
        : { bomb: 'b', rainbow: 'r', brush: 'p', star: 's' }[t.gift];
    }
    out.push(line);
  }
  return out;
}

describe('scoring', () => {
  it('uses (n-2)^2', () => {
    expect(groupPoints(2)).toBe(0);
    expect(groupPoints(3)).toBe(1);
    expect(groupPoints(7)).toBe(25);
  });
});

describe('groups', () => {
  it('finds orthogonally connected same fruit', () => {
    const s = make(['001', '010', '111']);
    expect(findGroup(s.board, { x: 0, y: 0 })).toHaveLength(3);
    expect(findGroup(s.board, { x: 2, y: 2 })).toHaveLength(4);
  });

  it('single tiles are not a group', () => {
    const s = make(['01', '10']);
    expect(findGroup(s.board, { x: 0, y: 0 })).toHaveLength(0);
  });

  it('rainbow joins any group', () => {
    const s = make(['0R0', '121']);
    expect(findGroup(s.board, { x: 0, y: 0 })).toHaveLength(3);
    // Tapping the rainbow picks the biggest neighbouring group.
    expect(findGroup(s.board, { x: 1, y: 0 })).toHaveLength(3);
  });

  it('two rainbows alone are not a group', () => {
    const s = make(['RR']);
    expect(findGroup(s.board, { x: 0, y: 0 })).toHaveLength(0);
  });

  it('gifts never group', () => {
    const s = make(['ss']);
    expect(findGroup(s.board, { x: 0, y: 0 })).toHaveLength(0);
  });
});

describe('gravity', () => {
  it('drops tiles and shifts empty columns left', () => {
    const s = make(['1.2', '.3.', '0.4']);
    s.board.cells[1] = [null, null, null];
    applyGravity(s.board);
    expect(show(s.board)).toEqual(['...', '12.', '04.']);
  });
});

describe('clearGroup', () => {
  it('clears, scores and applies gravity', () => {
    const s = make(['12', '00', '00']);
    const ev = clearGroup(s, { x: 0, y: 2 })!;
    expect(ev.cleared).toHaveLength(4);
    expect(s.score).toBe(4);
    expect(show(s.board)).toEqual(['..', '..', '12']);
  });

  it('rejects invalid taps', () => {
    const s = make(['01']);
    expect(clearGroup(s, { x: 0, y: 0 })).toBeNull();
  });

  it('opens adjacent gifts', () => {
    const s = make(['b1r', '001', 'ps1']);
    const ev = clearGroup(s, { x: 0, y: 1 })!;
    // bomb gift above (0,0) and paint brush below (0,2) and star (1,2) are adjacent.
    expect(ev.opened.map((o) => o.gift).sort()).toEqual(['bomb', 'brush', 'star']);
    expect(s.brushes).toBe(1);
    expect(s.bonusStars).toBe(1);
    expect(s.score).toBe(STAR_POINTS);
    expect(show(s.board)).toEqual(['..r', '..1', 'B11']);
  });
});

describe('bombs', () => {
  it('clears the 3x3 area and opens gifts inside it', () => {
    const s = make(['0123', '1Bs0', '2340']);
    const ev = detonate(s, { x: 1, y: 1 })!;
    expect(ev.exploded).toBe(true);
    expect(ev.cleared).toHaveLength(8);
    expect(s.score).toBe(8 + STAR_POINTS);
    expect(show(s.board)).toEqual(['3...', '0...', '0...']);
  });
});

describe('paint brush', () => {
  it('repaints to most common neighbour', () => {
    const s = make(['121', '010']);
    s.brushes = 1;
    expect(paint(s, { x: 1, y: 0 })).not.toBeNull();
    expect(show(s.board)).toEqual(['111', '010']);
    expect(s.brushes).toBe(0);
  });

  it('needs a brush', () => {
    const s = make(['121']);
    expect(paint(s, { x: 1, y: 0 })).toBeNull();
  });
});

describe('round end', () => {
  it('detects no moves', () => {
    expect(hasMoves(make(['01', '10']))).toBe(false);
    expect(hasMoves(make(['01', '1B']))).toBe(true);
    const s = make(['01', '10']);
    s.brushes = 1;
    expect(hasMoves(s)).toBe(true);
  });

  it('gives clear bonus when no fruit remains', () => {
    const s = make(['00', 'ss']);
    clearGroup(s, { x: 0, y: 0 });
    expect(finishRound(s)).toBe(CLEAR_BONUS);
  });
});

describe('generation and levels', () => {
  it('generates playable reproducible boards', () => {
    const opts = { cols: 10, rows: 8, fruits: 4, gifts: 5 };
    const a = newGame(opts, makeRng(42));
    const b = newGame(opts, makeRng(42));
    expect(show(a.board)).toEqual(show(b.board));
    expect(hasMoves(a)).toBe(true);
    const gifts = a.board.cells.flat().filter((t) => t?.kind === 'gift');
    expect(gifts).toHaveLength(5);
  });

  it('every level has increasing star targets', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const l = getLevel(n);
      expect(l.stars[0]).toBeLessThan(l.stars[1]);
      expect(l.stars[1]).toBeLessThan(l.stars[2]);
      expect(hasMoves(startLevel(l))).toBe(true);
    }
    const l1 = getLevel(1);
    expect(starsFor(l1, 0)).toBe(0);
    expect(starsFor(l1, l1.stars[2])).toBe(3);
  });
});
