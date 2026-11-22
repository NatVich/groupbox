import { describe, expect, it } from 'vitest';
import { retroFruit, retroTile } from './retro-art';

describe('retro sprites', () => {
  it('give every pixel a colour', () => {
    const all = [
      ...[0, 1, 2, 3, 4, 5].map(retroFruit),
      ...(['bomb', 'rainbow', 'brush', 'star'] as const).map((gift) => retroTile({ kind: 'gift', id: 1, gift })),
      retroTile({ kind: 'bomb', id: 1 }),
      retroTile({ kind: 'rainbow', id: 1 }),
    ];
    for (const svg of all) {
      expect(svg).not.toContain('undefined');
      expect(svg).toContain('class="eyes"');
    }
  });
  it('draws each fruit differently', () => {
    expect(new Set([0, 1, 2, 3, 4, 5].map(retroFruit)).size).toBe(6);
  });
});
