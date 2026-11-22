import { Rng, randInt } from './rng';
import type { Board, GameState, GiftType, MoveEvents, Pos, Tile } from './types';

const DIRS: Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export const CLEAR_BONUS = 1000;
export const STAR_POINTS = 100;

export function groupPoints(n: number): number {
  return n < 2 ? 0 : (n - 2) * (n - 2);
}

export function at(board: Board, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= board.cols || y >= board.rows) return null;
  return board.cells[x][y];
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    board: {
      cols: s.board.cols,
      rows: s.board.rows,
      cells: s.board.cells.map((col) => col.map((t) => (t ? { ...t } : null))),
    },
  };
}

// ---------- generation ----------

export interface GenOptions {
  cols: number;
  rows: number;
  fruits: number;
  gifts: number;
}

const GIFT_WEIGHTS: [GiftType, number][] = [
  ['bomb', 3],
  ['rainbow', 3],
  ['brush', 2],
  ['star', 2],
];

function pickGift(rng: Rng): GiftType {
  const total = GIFT_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [g, w] of GIFT_WEIGHTS) {
    if ((r -= w) < 0) return g;
  }
  return 'star';
}

export function newGame(opts: GenOptions, rng: Rng): GameState {
  for (let attempt = 0; attempt < 50; attempt++) {
    let id = 1;
    const cells: (Tile | null)[][] = [];
    for (let x = 0; x < opts.cols; x++) {
      const col: (Tile | null)[] = [];
      for (let y = 0; y < opts.rows; y++) {
        col.push({ kind: 'fruit', id: id++, fruit: randInt(rng, opts.fruits) });
      }
      cells.push(col);
    }
    // Scatter gift boxes, keeping them off the top row so they're visible and reachable.
    const spots: Pos[] = [];
    for (let x = 0; x < opts.cols; x++) for (let y = 1; y < opts.rows; y++) spots.push({ x, y });
    for (let i = 0; i < opts.gifts && spots.length; i++) {
      const p = spots.splice(randInt(rng, spots.length), 1)[0];
      cells[p.x][p.y] = { kind: 'gift', id: id++, gift: pickGift(rng) };
    }
    const state: GameState = {
      board: { cols: opts.cols, rows: opts.rows, cells },
      score: 0,
      brushes: 0,
      bonusStars: 0,
      moves: 0,
      nextId: id,
    };
    if (hasMoves(state)) return state;
  }
  throw new Error('could not generate a playable board');
}

// ---------- groups ----------

/** Group of a given fruit (with rainbows as wildcards) connected to `start`. */
function floodFruit(board: Board, start: Pos, fruit: number): Pos[] {
  const seen = new Set<number>();
  const out: Pos[] = [];
  const stack = [start];
  const matches = (t: Tile | null) => !!t && ((t.kind === 'fruit' && t.fruit === fruit) || t.kind === 'rainbow');
  while (stack.length) {
    const p = stack.pop()!;
    const key = p.x * 1000 + p.y;
    if (seen.has(key)) continue;
    if (!matches(at(board, p.x, p.y))) continue;
    seen.add(key);
    out.push(p);
    for (const d of DIRS) stack.push({ x: p.x + d.x, y: p.y + d.y });
  }
  return out;
}

/** The group a tap at `p` would clear (empty array if not a valid group). */
export function findGroup(board: Board, p: Pos): Pos[] {
  const t = at(board, p.x, p.y);
  if (!t) return [];
  let best: Pos[] = [];
  if (t.kind === 'fruit') {
    best = floodFruit(board, p, t.fruit);
  } else if (t.kind === 'rainbow') {
    // Try every fruit reachable through rainbows and pick the biggest group.
    const fruits = new Set<number>();
    for (const q of floodRainbowReach(board, p)) {
      const n = at(board, q.x, q.y);
      if (n?.kind === 'fruit') fruits.add(n.fruit);
    }
    for (const f of fruits) {
      const g = floodFruit(board, p, f);
      if (g.length > best.length) best = g;
    }
  } else {
    return [];
  }
  const hasFruit = best.some((q) => at(board, q.x, q.y)?.kind === 'fruit');
  return best.length >= 2 && hasFruit ? best : [];
}

/** Cells orthogonally adjacent to the rainbow-connected region containing `p`. */
function floodRainbowReach(board: Board, p: Pos): Pos[] {
  const seen = new Set<number>();
  const out: Pos[] = [];
  const stack = [p];
  while (stack.length) {
    const q = stack.pop()!;
    const key = q.x * 1000 + q.y;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = at(board, q.x, q.y);
    if (!t) continue;
    if (t.kind === 'rainbow') {
      for (const d of DIRS) stack.push({ x: q.x + d.x, y: q.y + d.y });
    } else {
      out.push(q);
    }
  }
  return out;
}

export function allGroups(board: Board): Pos[][] {
  const seen = new Set<number>();
  const groups: Pos[][] = [];
  for (let x = 0; x < board.cols; x++) {
    for (let y = 0; y < board.rows; y++) {
      const t = board.cells[x][y];
      if (t?.kind !== 'fruit' || seen.has(x * 1000 + y)) continue;
      const g = findGroup(board, { x, y });
      for (const q of g) if (at(board, q.x, q.y)?.kind === 'fruit') seen.add(q.x * 1000 + q.y);
      if (g.length) groups.push(g);
    }
  }
  return groups;
}

// ---------- moves ----------

function emptyEvents(): MoveEvents {
  return { cleared: [], points: 0, opened: [], exploded: false, painted: false };
}

function removeCells(state: GameState, cells: Pos[], ev: MoveEvents) {
  for (const p of cells) {
    const t = at(state.board, p.x, p.y);
    if (!t) continue;
    ev.cleared.push({ id: t.id, x: p.x, y: p.y });
    state.board.cells[p.x][p.y] = null;
  }
}

/** Opens a gift in place: bomb/rainbow become tiles, brush/star are collected. */
function openGift(state: GameState, p: Pos, ev: MoveEvents) {
  const t = at(state.board, p.x, p.y);
  if (t?.kind !== 'gift') return;
  ev.opened.push({ id: t.id, gift: t.gift, x: p.x, y: p.y });
  switch (t.gift) {
    case 'bomb':
      state.board.cells[p.x][p.y] = { kind: 'bomb', id: t.id };
      break;
    case 'rainbow':
      state.board.cells[p.x][p.y] = { kind: 'rainbow', id: t.id };
      break;
    case 'brush':
      state.brushes++;
      state.board.cells[p.x][p.y] = null;
      break;
    case 'star':
      state.bonusStars++;
      state.score += STAR_POINTS;
      ev.points += STAR_POINTS;
      state.board.cells[p.x][p.y] = null;
      break;
  }
}

/** Fruit falls down; empty columns slide left. */
export function applyGravity(board: Board) {
  for (let x = 0; x < board.cols; x++) {
    const tiles = board.cells[x].filter((t): t is Tile => t !== null);
    const pad = board.rows - tiles.length;
    board.cells[x] = [...Array<Tile | null>(pad).fill(null), ...tiles];
  }
  const filled = board.cells.filter((col) => col.some((t) => t !== null));
  while (filled.length < board.cols) filled.push(Array<Tile | null>(board.rows).fill(null));
  board.cells = filled;
}

/** Clears the group at `p`. Returns null if the tap isn't a valid move. Mutates `state`. */
export function clearGroup(state: GameState, p: Pos): MoveEvents | null {
  const group = findGroup(state.board, p);
  if (!group.length) return null;
  const ev = emptyEvents();
  const pts = groupPoints(group.length);
  state.score += pts;
  ev.points += pts;
  const neighbours: Pos[] = [];
  for (const q of group) for (const d of DIRS) neighbours.push({ x: q.x + d.x, y: q.y + d.y });
  removeCells(state, group, ev);
  for (const n of neighbours) openGift(state, n, ev);
  applyGravity(state.board);
  state.moves++;
  return ev;
}

/** Detonates a bomb tile at `p`, clearing the 3×3 area. Gifts in the blast open. */
export function detonate(state: GameState, p: Pos): MoveEvents | null {
  if (at(state.board, p.x, p.y)?.kind !== 'bomb') return null;
  const ev = emptyEvents();
  ev.exploded = true;
  const blast: Pos[] = [];
  const gifts: Pos[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const q = { x: p.x + dx, y: p.y + dy };
      const t = at(state.board, q.x, q.y);
      if (!t) continue;
      if (t.kind === 'gift') gifts.push(q);
      else blast.push(q);
    }
  }
  const pts = blast.length;
  state.score += pts;
  ev.points += pts;
  removeCells(state, blast, ev);
  for (const g of gifts) openGift(state, g, ev);
  applyGravity(state.board);
  state.moves++;
  return ev;
}

/** The fruit a paint brush would turn the tile at `p` into, or null. */
export function paintTarget(board: Board, p: Pos): number | null {
  const t = at(board, p.x, p.y);
  if (t?.kind !== 'fruit') return null;
  const counts = new Map<number, number>();
  for (const d of DIRS) {
    const n = at(board, p.x + d.x, p.y + d.y);
    if (n?.kind === 'fruit' && n.fruit !== t.fruit) counts.set(n.fruit, (counts.get(n.fruit) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [f, n] of counts) {
    if (n > bestN) {
      best = f;
      bestN = n;
    }
  }
  return best;
}

export function paint(state: GameState, p: Pos): MoveEvents | null {
  if (state.brushes <= 0) return null;
  const target = paintTarget(state.board, p);
  if (target === null) return null;
  const t = at(state.board, p.x, p.y) as Extract<Tile, { kind: 'fruit' }>;
  t.fruit = target;
  state.brushes--;
  const ev = emptyEvents();
  ev.painted = true;
  return ev;
}

// ---------- end of round ----------

export function hasMoves(state: GameState): boolean {
  const b = state.board;
  for (let x = 0; x < b.cols; x++) {
    for (let y = 0; y < b.rows; y++) {
      const t = b.cells[x][y];
      if (!t) continue;
      if (t.kind === 'bomb') return true;
      if ((t.kind === 'fruit' || t.kind === 'rainbow') && findGroup(b, { x, y }).length) return true;
      if (state.brushes > 0 && paintTarget(b, { x, y }) !== null) return true;
    }
  }
  return false;
}

/** Board counts as cleared when no fruit is left (leftover gift boxes are fine). */
export function isBoardClear(board: Board): boolean {
  return board.cells.every((col) => col.every((t) => t?.kind !== 'fruit'));
}

/** Adds the clear bonus if earned. Call once when the round ends. Returns the bonus. */
export function finishRound(state: GameState): number {
  const bonus = isBoardClear(state.board) ? CLEAR_BONUS : 0;
  state.score += bonus;
  return bonus;
}

/** Biggest available group, for the hint button. */
export function bestHint(board: Board): Pos[] {
  let best: Pos[] = [];
  for (const g of allGroups(board)) if (g.length > best.length) best = g;
  if (best.length) return best;
  for (let x = 0; x < board.cols; x++)
    for (let y = 0; y < board.rows; y++) if (board.cells[x][y]?.kind === 'bomb') return [{ x, y }];
  return [];
}
