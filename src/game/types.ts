export const FRUITS = ['strawberry', 'lemon', 'grape', 'blueberry', 'kiwi', 'orange'] as const;
export type FruitName = (typeof FRUITS)[number];

export type GiftType = 'bomb' | 'rainbow' | 'brush' | 'star';

export type Tile =
  | { kind: 'fruit'; id: number; fruit: number }
  | { kind: 'gift'; id: number; gift: GiftType }
  | { kind: 'bomb'; id: number }
  | { kind: 'rainbow'; id: number };

/** cells[x][y]; y = 0 is the top row. */
export interface Board {
  cols: number;
  rows: number;
  cells: (Tile | null)[][];
}

export interface Pos {
  x: number;
  y: number;
}

export interface GameState {
  board: Board;
  score: number;
  brushes: number;
  bonusStars: number;
  moves: number;
  nextId: number;
}

/** Things that happened during a move, for the UI to animate and play sounds. */
export interface MoveEvents {
  cleared: { id: number; x: number; y: number }[];
  points: number;
  opened: { id: number; gift: GiftType; x: number; y: number }[];
  exploded: boolean;
  painted: boolean;
}
