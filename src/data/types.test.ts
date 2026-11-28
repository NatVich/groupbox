import { describe, expect, it } from 'vitest';
import { LocalStore } from './local-store';
import {
  applyProgress,
  cleanName,
  diffProgress,
  leaderboard,
  makeFamilyCode,
  newPlayer,
  normalizeFamilyCode,
  sanitizePlayer,
  totalStars,
} from './types';

class MemKV {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('family codes', () => {
  it('makes codes like PEAR-4821', () => {
    for (let i = 0; i < 50; i++) expect(makeFamilyCode()).toMatch(/^[A-Z]+-\d{4}$/);
  });
  it('normalizes what people type', () => {
    expect(normalizeFamilyCode(' pear 4821 ')).toBe('PEAR-4821');
    expect(normalizeFamilyCode('Pear-0007')).toBe('PEAR-0007');
    expect(normalizeFamilyCode('pear-48')).toBeNull();
    expect(normalizeFamilyCode('4821')).toBeNull();
  });
});

describe('players', () => {
  it('cleans names', () => {
    expect(cleanName('  Grand   ma  ')).toBe('Grand ma');
    expect(cleanName('x'.repeat(40))).toHaveLength(20);
  });
  it('ranks by stars, then calm best', () => {
    const a = { ...newPlayer('Ann', 0), levelStars: { 1: 3, 2: 2 } };
    const b = { ...newPlayer('Bob', 1), levelStars: { 1: 3, 2: 2 }, calmBest: 500 };
    const c = { ...newPlayer('Cy', 2), levelStars: { 1: 1 } };
    expect(totalStars(a)).toBe(5);
    expect(leaderboard([c, a, b]).map((p) => p.name)).toEqual(['Bob', 'Ann', 'Cy']);
  });
});

describe('LocalStore', () => {
  it('keeps each player progress separately and survives reload', async () => {
    const kv = new MemKV();
    const s = new LocalStore(kv);
    const fam = await s.createFamily('Smiths');
    const mia = newPlayer('Mia', 3);
    const gran = newPlayer('Grandma', 0);
    mia.levelStars[1] = 3;
    await s.savePlayer(fam.code, mia);
    await s.savePlayer(fam.code, gran);

    const again = new LocalStore(kv);
    expect(await again.getFamily(fam.code)).toEqual(fam);
    const list = await again.listPlayers(fam.code);
    expect(list.find((p) => p.name === 'Mia')!.levelStars[1]).toBe(3);
    expect(list.find((p) => p.name === 'Grandma')!.levelStars[1]).toBeUndefined();

    await again.deletePlayer(fam.code, gran.id);
    expect(await again.listPlayers(fam.code)).toHaveLength(1);
    expect(await again.getFamily('NOPE-0000')).toBeNull();
  });
});

describe('sanitizePlayer', () => {
  it('keeps a normal player as-is', () => {
    const p = { ...newPlayer('Mia', 3), levelStars: { 1: 3 }, daily: { '2026-11-28': 120 } };
    expect(sanitizePlayer(JSON.parse(JSON.stringify(p)))).toEqual(JSON.parse(JSON.stringify(p)));
  });

  it('turns injected text into plain numbers and drops bad keys', () => {
    const evil = {
      id: 'abcd1234',
      name: '  <b>Bob</b>  ',
      avatar: 99,
      levelStars: { 1: '<img src=x onerror=alert(1)>', 2: 7, x: 3 },
      levelBest: { 1: -5 },
      calmBest: 'lots',
      daily: { '2026-11-28': '9" onclick="x', '<script>': 1 },
      updatedAt: 'now',
    };
    const p = sanitizePlayer(evil)!;
    expect(p.avatar).toBe(5);
    expect(p.levelStars).toEqual({ 1: 0, 2: 3 });
    expect(p.levelBest).toEqual({ 1: 0 });
    expect(p.calmBest).toBe(0);
    expect(p.daily).toEqual({ '2026-11-28': 0 });
    expect(p.name).toBe('<b>Bob</b>'); // still escaped when shown; kept as typed
  });

  it('rejects records without a safe id', () => {
    expect(sanitizePlayer({ ...newPlayer('A', 0), id: 'x" onmouseover="alert(1)' })).toBeNull();
    expect(sanitizePlayer(null)).toBeNull();
    expect(sanitizePlayer('player')).toBeNull();
  });
});

describe('progress patches', () => {
  it('records only what a game added', () => {
    const before = { ...newPlayer('Mia', 0), levelStars: { 1: 2, 2: 3 }, calmBest: 100, daily: { '2026-11-27': 50 } };
    const after = {
      ...before,
      levelStars: { 1: 3, 2: 3, 3: 1 },
      calmBest: 90,
      daily: { '2026-11-28': 70 },
    };
    expect(diffProgress(before, after)).toEqual({
      levelStars: { 1: 3, 3: 1 },
      daily: { '2026-11-28': 70 },
      dropDaily: ['2026-11-27'],
    });
    expect(diffProgress(before, before)).toBeNull();
  });

  it('never lowers a value saved by another device', () => {
    const other = { ...newPlayer('Mia', 0), levelStars: { 1: 3 }, calmBest: 500 };
    const merged = applyProgress(other, { levelStars: { 1: 1, 2: 2 }, calmBest: 300 });
    expect(merged.levelStars).toEqual({ 1: 3, 2: 2 });
    expect(merged.calmBest).toBe(500);
  });
});

describe('LocalStore progress', () => {
  it('saves profile edits and progress separately', async () => {
    const s = new LocalStore(new MemKV());
    const fam = await s.createFamily('Smiths');
    const mia = { ...newPlayer('Mia', 3), levelStars: { 1: 3 } };
    await s.savePlayer(fam.code, mia);
    await s.saveProfile(fam.code, mia.id, { name: 'Mia R', avatar: 1 });
    await s.saveProgress(fam.code, mia.id, { levelStars: { 1: 1, 2: 2 }, daily: { '2026-11-28': 40 } });
    const [p] = await s.listPlayers(fam.code);
    expect(p.name).toBe('Mia R');
    expect(p.avatar).toBe(1);
    expect(p.levelStars).toEqual({ 1: 3, 2: 2 });
    expect(p.daily).toEqual({ '2026-11-28': 40 });
  });
});
