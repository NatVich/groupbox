/** A family member's profile and progress. */
export interface Player {
  id: string;
  name: string;
  /** Index into FRUITS: the player's fruit-friend avatar. */
  avatar: number;
  levelStars: Record<string, number>;
  levelBest: Record<string, number>;
  calmBest: number;
  /** Best score for each daily puzzle, by date (YYYY-MM-DD). Absent until the first daily is played. */
  daily?: Record<string, number>;
  updatedAt: number;
}

export interface Family {
  code: string;
  name: string;
}

/** Where profiles live: this browser, or Firebase (shared across devices by family code). */
export interface ProfileStore {
  readonly kind: 'local' | 'firebase';
  createFamily(name: string): Promise<Family>;
  /** Returns null when no family has that code. */
  getFamily(code: string): Promise<Family | null>;
  listPlayers(code: string): Promise<Player[]>;
  /** Saves a brand-new player in full. */
  savePlayer(code: string, player: Player): Promise<void>;
  /** Saves a name or avatar change without touching progress. */
  saveProfile(code: string, id: string, profile: Pick<Player, 'name' | 'avatar'>): Promise<void>;
  /**
   * Saves only what a game changed. Scores never go down: if another device already saved a
   * higher value for the same level or day, that value is kept.
   */
  saveProgress(code: string, id: string, patch: ProgressPatch): Promise<void>;
  deletePlayer(code: string, id: string): Promise<void>;
  /** Called when a background save fails (for example the database rules are out of date). */
  onSaveError?: (e: Error) => void;
}

/** A problem with the Firebase project setup, with a message a parent can act on. */
export class SetupError extends Error {}

/** Progress a game added: new or higher values only. */
export interface ProgressPatch {
  levelStars?: Record<string, number>;
  levelBest?: Record<string, number>;
  calmBest?: number;
  daily?: Record<string, number>;
  /** Days dropped from the kept daily history. */
  dropDaily?: string[];
}

const PROGRESS_MAPS = ['levelStars', 'levelBest', 'daily'] as const;

/** What `next` gained compared with `prev` (null when nothing changed). */
export function diffProgress(prev: Player, next: Player): ProgressPatch | null {
  const patch: ProgressPatch = {};
  for (const field of PROGRESS_MAPS) {
    const before = prev[field] ?? {};
    const changed: Record<string, number> = {};
    for (const [k, v] of Object.entries(next[field] ?? {})) if (v > (before[k] ?? -1)) changed[k] = v;
    if (Object.keys(changed).length) patch[field] = changed;
  }
  if (next.calmBest > prev.calmBest) patch.calmBest = next.calmBest;
  const dropped = Object.keys(prev.daily ?? {}).filter((k) => !(k in (next.daily ?? {})));
  if (dropped.length) patch.dropDaily = dropped;
  return Object.keys(patch).length ? patch : null;
}

/** `player` with `patch` applied, keeping the higher value wherever both have one. */
export function applyProgress(player: Player, patch: ProgressPatch): Player {
  const out: Player = {
    ...player,
    levelStars: { ...player.levelStars },
    levelBest: { ...player.levelBest },
    ...(player.daily || patch.daily ? { daily: { ...(player.daily ?? {}) } } : {}),
  };
  for (const field of PROGRESS_MAPS) {
    const target = out[field];
    if (!target) continue;
    for (const [k, v] of Object.entries(patch[field] ?? {})) target[k] = Math.max(v, target[k] ?? 0);
  }
  if (patch.calmBest !== undefined) out.calmBest = Math.max(out.calmBest, patch.calmBest);
  for (const k of patch.dropDaily ?? []) if (out.daily) delete out.daily[k];
  return out;
}

const whole = (v: unknown, min: number, max: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

function numberMap(v: unknown, keyOk: RegExp, min: number, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (keyOk.test(k)) out[k] = whole(val, min, max);
  }
  return out;
}

const PLAYER_ID = /^[a-z0-9]{4,40}$/i;
const LEVEL_KEY = /^\d{1,3}$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SCORE = 10_000_000;

/**
 * A player as read from storage, cleaned up: every number is a whole number in range and names
 * are plain text. Anyone with a family code can write player records, so nothing read back is
 * trusted as-is. Returns null for a record that isn't a usable player.
 */
export function sanitizePlayer(raw: unknown): Player | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !PLAYER_ID.test(r.id)) return null;
  const player: Player = {
    id: r.id,
    name: cleanName(String(r.name ?? '')) || 'Player',
    avatar: whole(r.avatar, 0, 5),
    levelStars: numberMap(r.levelStars, LEVEL_KEY, 0, 3),
    levelBest: numberMap(r.levelBest, LEVEL_KEY, 0, MAX_SCORE),
    calmBest: whole(r.calmBest, 0, MAX_SCORE),
    updatedAt: whole(r.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
  if (r.daily !== undefined) player.daily = numberMap(r.daily, DATE_KEY, 0, MAX_SCORE);
  return player;
}

export const MAX_NAME = 20;

export function newPlayer(name: string, avatar: number): Player {
  return {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    name: cleanName(name),
    avatar,
    levelStars: {},
    levelBest: {},
    calmBest: 0,
    updatedAt: Date.now(),
  };
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function totalStars(p: Player): number {
  return Object.values(p.levelStars).reduce((s, v) => s + v, 0);
}

/** Highest unlocked-and-beaten level, for the leaderboard. */
export function levelsBeaten(p: Player): number {
  return Object.values(p.levelStars).filter((v) => v > 0).length;
}

export function leaderboard(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => totalStars(b) - totalStars(a) || b.calmBest - a.calmBest || a.name.localeCompare(b.name),
  );
}

// ---------- family codes ----------

const WORDS = [
  'APPLE', 'BERRY', 'CHERRY', 'GRAPE', 'KIWI', 'LEMON', 'LIME', 'MANGO', 'MELON', 'OLIVE',
  'ORANGE', 'PEACH', 'PEAR', 'PLUM', 'BANANA', 'COCONUT', 'FIG', 'GUAVA', 'PAPAYA', 'DATE',
];

export function makeFamilyCode(rand: () => number = Math.random): string {
  const word = WORDS[Math.floor(rand() * WORDS.length)];
  const num = String(Math.floor(rand() * 10000)).padStart(4, '0');
  return `${word}-${num}`;
}

/** Accepts "pear 4821", "pear4821", " Pear-4821 " and returns "PEAR-4821" (or null if invalid). */
export function normalizeFamilyCode(input: string): string | null {
  const m = input.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]+)(\d{4})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Players ranked by their best score on a given day; players who haven't played come last. */
export function dailyBoard(players: Player[], date: string): { player: Player; score: number | null }[] {
  return players
    .map((player) => ({ player, score: player.daily?.[date] ?? null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.player.name.localeCompare(b.player.name));
}
