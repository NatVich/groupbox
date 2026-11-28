import { applyProgress, Family, makeFamilyCode, Player, ProfileStore, ProgressPatch, sanitizePlayer } from './types';

/** Minimal storage interface so tests can pass an in-memory map. */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

interface LocalData {
  families: Record<string, { name: string; players: Record<string, Player> }>;
}

const KEY = 'groupbox-profiles-v1';

/** Profiles saved in this browser only. */
export class LocalStore implements ProfileStore {
  readonly kind = 'local';
  private mem: LocalData = { families: {} };

  constructor(private kv: KV | null = safeLocalStorage()) {
    try {
      const raw = this.kv?.getItem(KEY);
      if (raw) this.mem = JSON.parse(raw);
    } catch {
      /* start fresh */
    }
  }

  private flush() {
    try {
      this.kv?.setItem(KEY, JSON.stringify(this.mem));
    } catch {
      /* storage full or blocked: keep playing in memory */
    }
  }

  async createFamily(name: string): Promise<Family> {
    let code = makeFamilyCode();
    while (this.mem.families[code]) code = makeFamilyCode();
    this.mem.families[code] = { name, players: {} };
    this.flush();
    return { code, name };
  }

  async getFamily(code: string): Promise<Family | null> {
    const f = this.mem.families[code];
    return f ? { code, name: f.name } : null;
  }

  async listPlayers(code: string): Promise<Player[]> {
    return Object.values(this.mem.families[code]?.players ?? {})
      .map((p) => sanitizePlayer(p))
      .filter((p): p is Player => p !== null);
  }

  async savePlayer(code: string, player: Player): Promise<void> {
    const f = this.mem.families[code];
    if (!f) throw new Error('family not found');
    f.players[player.id] = JSON.parse(JSON.stringify(player));
    this.flush();
  }

  async saveProfile(code: string, id: string, profile: Pick<Player, 'name' | 'avatar'>): Promise<void> {
    const p = this.mem.families[code]?.players[id];
    if (!p) throw new Error('player not found');
    p.name = profile.name;
    p.avatar = profile.avatar;
    p.updatedAt = Date.now();
    this.flush();
  }

  async saveProgress(code: string, id: string, patch: ProgressPatch): Promise<void> {
    const f = this.mem.families[code];
    const p = f?.players[id];
    if (!f || !p) throw new Error('player not found');
    f.players[id] = { ...applyProgress(p, patch), updatedAt: Date.now() };
    this.flush();
  }

  async deletePlayer(code: string, id: string): Promise<void> {
    delete this.mem.families[code]?.players[id];
    this.flush();
  }
}

export function safeLocalStorage(): KV | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
