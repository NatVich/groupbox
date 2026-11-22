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
  savePlayer(code: string, player: Player): Promise<void>;
  deletePlayer(code: string, id: string): Promise<void>;
  /** Called when a background save fails (for example the database rules are out of date). */
  onSaveError?: (e: Error) => void;
}

/** A problem with the Firebase project setup, with a message a parent can act on. */
export class SetupError extends Error {}

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
