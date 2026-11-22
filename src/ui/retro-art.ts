import type { GiftType, Tile } from '../game/types';

/**
 * Retro skin: 12×12 pixel-art sprites. Each fruit keeps its own silhouette as well as its colour,
 * so the board stays readable for colour-blind players. `E` pixels are eyes (they blink) and
 * `M` pixels are the mouth.
 */

type Sprite = { rows: string[]; colors: Record<string, string> };

const FACE = '#1a1028';

const SPRITES: Sprite[] = [
  // strawberry: pointed berry with a leafy top and seeds
  {
    rows: [
      '....gGGg....',
      '..OOOggOOO..',
      '.ORRRRRRRRO.',
      'ORRYRRRRYRRO',
      'ORWRRRRRRRRO',
      'ORRERRRRERRO',
      'ORYRRRRRRYRO',
      '.ORRRMMRRRO.',
      '.ORRRRRRRRO.',
      '..ORRYRRRO..',
      '...ORRRRO...',
      '....OOOO....',
    ],
    colors: { O: '#7a0f2a', R: '#ff3860', Y: '#ffe066', W: '#ffb3c4', g: '#7ee081', G: '#2e9e4f' },
  },
  // lemon: wide oval with pointed tips
  {
    rows: [
      '............',
      '............',
      '....OOOO....',
      '..OOYYYYOO..',
      '.OYWYYYYYYO.',
      'OYYEYYYYEYYO',
      'OYYYYYYYYYYO',
      '.OYYYMMYYYO.',
      '..OOYYYYOO..',
      '....OOOO....',
      '............',
      '............',
    ],
    colors: { O: '#9a7400', Y: '#ffdd33', W: '#fff5b8' },
  },
  // grape: an upside-down triangle of checkered grapes with a stem
  {
    rows: [
      '.....bb.....',
      '....bbLL....',
      '..OOOOOOOO..',
      '.OPpPpPpPpO.',
      '.OpWpPpPpPO.',
      '.OPpEpPEpPO.',
      '..OpPpPpPO..',
      '..OPpMMpPO..',
      '...OpPpPO...',
      '....OPpO....',
      '.....OO.....',
      '............',
    ],
    colors: { O: '#3d0f6b', P: '#b04cff', p: '#8a2be2', W: '#e3c2ff', b: '#7a4a1e', L: '#4cd964' },
  },
  // blueberry: rounded square with a dark crown
  {
    rows: [
      '............',
      '..OOOOOOOO..',
      '.OBBBDDBBBO.',
      'OBWBBDDBBBBO',
      'OBBBBBBBBBBO',
      'OBBEBBBBEBBO',
      'OBBBBBBBBBBO',
      'OBBBBMMBBBBO',
      'OBBBBBBBBBBO',
      '.OBBBBBBBBO.',
      '..OOOOOOOO..',
      '............',
    ],
    colors: { O: '#0f2a7a', B: '#3d7bff', D: '#0f2a7a', W: '#b8ceff' },
  },
  // kiwi: round slice with a brown rim, a ring of seeds and a pale centre
  {
    rows: [
      '...OOOOOO...',
      '.OObbbbbbOO.',
      '.ObGsGGsGbO.',
      'ObGGGGGGGGbO',
      'ObsGEccEGsbO',
      'ObGGccccGGbO',
      'ObGGcMMcGGbO',
      'ObsGGccGGsbO',
      'ObGGGGGGGGbO',
      '.ObGsGGsGbO.',
      '.OObbbbbbOO.',
      '...OOOOOO...',
    ],
    colors: { O: '#3b2410', b: '#8d5a2b', G: '#4cd964', s: '#1a1028', c: '#eaffd9' },
  },
  // orange: smaller round fruit with dimples, a stem and a leaf
  {
    rows: [
      '......bLL...',
      '.....bLL....',
      '...OOOOOO...',
      '..OAAAAAAO..',
      '.OAWAaAAAAO.',
      '.OAAEAAEAAO.',
      'OAAaAAAAAaAO',
      '.OAAAMMAAAO.',
      '.OAaAAAAaAO.',
      '..OAAAAAAO..',
      '...OOOOOO...',
      '............',
    ],
    colors: { O: '#8a3a00', A: '#ff8a1f', a: '#d96a00', W: '#ffd2a3', b: '#7a4a1e', L: '#4cd964' },
  },
];

const GIFT_COLORS: Record<GiftType, string> = {
  bomb: '#ff4fa0',
  rainbow: '#33ccff',
  brush: '#9b7bff',
  star: '#2ee8a0',
};

const giftSprite = (g: GiftType): Sprite => ({
  rows: [
    '...Y....Y...',
    '..YYY..YYY..',
    '...YYYYYY...',
    'OOOOOYYOOOOO',
    'OCCCCYYCCCCO',
    'OOOOOYYOOOOO',
    '.OCCCYYCCCO.',
    '.OCWCYYCCCO.',
    '.OCCCYYCCCO.',
    '.OCCCYYCCCO.',
    '.OCCCYYCCCO.',
    '.OOOOOOOOOO.',
  ],
  colors: { O: '#1a1028', C: GIFT_COLORS[g], Y: '#ffdd33', W: '#ffffff' },
});

const BOMB: Sprite = {
  rows: [
    '........Ss..',
    '.......F.S..',
    '......F.....',
    '....OOOO....',
    '..OOKKKKOO..',
    '.OKWKKKKKKO.',
    '.OKKEKKEKKO.',
    '.OKKKKKKKKO.',
    '.OKKKMMKKKO.',
    '..OKKKKKKO..',
    '...OOOOOO...',
    '............',
  ],
  colors: { O: '#0d0d1a', K: '#3a3a5c', W: '#8a8ab8', F: '#b08968', S: '#ffdd33', s: '#ffffff' },
};

const RAINBOW: Sprite = {
  rows: [
    '...OOOOOO...',
    '..O111111O..',
    '.O22222222O.',
    'O3333333333O',
    'O44E4444E44O',
    'O5555555555O',
    'O6666MM6666O',
    '.O11111111O.',
    '..O222222O..',
    '...OOOOOO...',
    '............',
    '............',
  ],
  colors: { O: '#1a1028', 1: '#ff3860', 2: '#ff8a1f', 3: '#ffdd33', 4: '#4cd964', 5: '#3d7bff', 6: '#b04cff' },
};

/** Draws a sprite as crisp SVG rectangles, merging runs of the same colour on each row. */
function render(sp: Sprite, faceColor = FACE): string {
  const body: string[] = [];
  const eyes: string[] = [];
  sp.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        const fill = ch === 'E' || ch === 'M' ? faceColor : sp.colors[ch];
        const rect = `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`;
        (ch === 'E' ? eyes : body).push(rect);
      }
      x = end;
    }
  });
  return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${body.join('')}<g class="face"><g class="eyes">${eyes.join('')}</g></g></svg>`;
}

const cache = new Map<string, string>();
const cached = (key: string, make: () => string) => {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
};

export function retroFruit(i: number): string {
  return cached(`f${i}`, () => render(SPRITES[i]));
}

export function retroTile(t: Tile): string {
  switch (t.kind) {
    case 'fruit':
      return retroFruit(t.fruit);
    case 'gift':
      return cached(`g${t.gift}`, () => render(giftSprite(t.gift)));
    case 'bomb':
      return cached('bomb', () => render(BOMB, '#ffffff'));
    case 'rainbow':
      return cached('rainbow', () => render(RAINBOW));
  }
}
