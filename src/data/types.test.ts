import { describe, expect, it } from 'vitest';
import { LocalStore } from './local-store';
import { cleanName, leaderboard, makeFamilyCode, newPlayer, normalizeFamilyCode, totalStars } from './types';

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
