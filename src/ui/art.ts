import type { GiftType, Tile } from '../game/types';
import { retroFruit, retroTile } from './retro-art';

export type Skin = 'fruit' | 'retro';
let skin: Skin = 'fruit';

/** Picks the artwork set used for tiles and avatars from now on. */
export function setSkin(s: Skin) {
  skin = s;
}

export function getSkin(): Skin {
  return skin;
}

/** Inline SVG artwork. Every fruit has its own colour AND silhouette (colour-blind friendly). */

const face = (cx = 50, cy = 56, s = 1) => `
  <g class="face" transform="translate(${cx} ${cy}) scale(${s})">
    <g class="eyes">
      <ellipse cx="-11" cy="-4" rx="5" ry="6.5" fill="#2b1b2e"/>
      <ellipse cx="11" cy="-4" rx="5" ry="6.5" fill="#2b1b2e"/>
      <circle cx="-9.5" cy="-6.5" r="1.8" fill="#fff"/>
      <circle cx="12.5" cy="-6.5" r="1.8" fill="#fff"/>
    </g>
    <ellipse cx="-19" cy="5" rx="5" ry="3" fill="#ff7a9c" opacity=".55"/>
    <ellipse cx="19" cy="5" rx="5" ry="3" fill="#ff7a9c" opacity=".55"/>
    <path class="mouth" d="M-7 5 Q0 13 7 5" fill="none" stroke="#2b1b2e" stroke-width="3.2" stroke-linecap="round"/>
  </g>`;

const shine = (x: number, y: number, rx = 9, ry = 5) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".45" transform="rotate(-30 ${x} ${y})"/>`;

const FRUIT_SVG: string[] = [
  // 0 strawberry: pointy-bottom berry with leafy crown
  `<path d="M50 94 C24 78 8 56 12 38 C15 26 30 22 50 26 C70 22 85 26 88 38 C92 56 76 78 50 94Z" fill="#ff4d6d" stroke="#c9184a" stroke-width="3"/>
   ${[[30, 44], [70, 44], [40, 74], [60, 74], [24, 58], [76, 58], [50, 84]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="3" fill="#ffe066"/>`).join('')}
   <path d="M50 30 L36 16 L46 22 L50 8 L54 22 L64 16Z M50 30 L28 26 L40 20 M50 30 L72 26 L60 20" fill="#52b788" stroke="#2d6a4f" stroke-width="2.5" stroke-linejoin="round"/>
   ${shine(28, 38)}${face(50, 54, 0.95)}`,
  // 1 lemon: wide oval with pointed tips
  `<path d="M4 54 C10 50 12 46 16 40 C26 24 74 24 84 40 C88 46 90 50 96 54 C90 58 88 62 84 68 C74 84 26 84 16 68 C12 62 10 58 4 54Z" fill="#ffd60a" stroke="#e0a800" stroke-width="3"/>
   ${shine(30, 38, 11, 5)}${face(50, 57)}`,
  // 2 grape: bunch of round grapes
  `<path d="M50 14 Q56 4 66 6" fill="none" stroke="#6b4226" stroke-width="4" stroke-linecap="round"/>
   <path d="M52 14 Q66 8 74 18 Q62 22 52 14Z" fill="#52b788" stroke="#2d6a4f" stroke-width="2"/>
   ${[[30, 30], [50, 26], [70, 30], [20, 50], [40, 48], [60, 48], [80, 50], [30, 68], [50, 68], [70, 68], [50, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#9d4edd" stroke="#5a189a" stroke-width="2.5"/><circle cx="${x - 4}" cy="${y - 4}" r="3.5" fill="#fff" opacity=".4"/>`).join('')}
   ${face(50, 56, 0.95)}`,
  // 3 blueberry: rounded square-ish berry with star crown
  `<rect x="10" y="14" width="80" height="80" rx="34" fill="#4361ee" stroke="#3a0ca3" stroke-width="3"/>
   <path d="M50 14 L54 22 L63 20 L58 28 L64 34 L54 33 L50 40 L46 33 L36 34 L42 28 L37 20 L46 22Z" fill="#3a0ca3"/>
   ${shine(28, 34)}${face(50, 62)}`,
  // 4 kiwi: slice with brown rim, seed ring and pale centre
  `<circle cx="50" cy="52" r="42" fill="#8d6e4a" stroke="#5c4033" stroke-width="3"/>
   <circle cx="50" cy="52" r="36" fill="#80ed99"/>
   <circle cx="50" cy="52" r="15" fill="#e9fce8"/>
   ${Array.from({ length: 12 }, (_, i) => {
     const a = (i / 12) * Math.PI * 2;
     return `<ellipse cx="${50 + Math.cos(a) * 24}" cy="${52 + Math.sin(a) * 24}" rx="2" ry="3.4" fill="#1b1b1b" transform="rotate(${(a * 180) / Math.PI + 90} ${50 + Math.cos(a) * 24} ${52 + Math.sin(a) * 24})"/>`;
   }).join('')}
   ${face(50, 54, 0.85)}`,
  // 5 orange: round, dimpled, with stem and leaf
  `<circle cx="50" cy="55" r="40" fill="#ff8c1a" stroke="#d9590b" stroke-width="3"/>
   ${[[28, 40], [70, 36], [76, 64], [26, 70], [52, 82], [40, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#d9590b" opacity=".6"/>`).join('')}
   <path d="M50 16 L50 8" stroke="#6b4226" stroke-width="4" stroke-linecap="round"/>
   <path d="M51 12 Q66 0 80 10 Q66 20 51 12Z" fill="#52b788" stroke="#2d6a4f" stroke-width="2"/>
   ${shine(30, 36)}${face(50, 58)}`,
];

const GIFT_COLORS: Record<GiftType, string> = {
  bomb: '#ff6b9a',
  rainbow: '#38bdf8',
  brush: '#a78bfa',
  star: '#34d399',
};

const giftSvg = (g: GiftType) => `
  <rect x="10" y="34" width="80" height="58" rx="10" fill="${GIFT_COLORS[g]}" stroke="#00000033" stroke-width="3"/>
  <rect x="6" y="26" width="88" height="18" rx="7" fill="${GIFT_COLORS[g]}" stroke="#00000033" stroke-width="3"/>
  <rect x="43" y="26" width="14" height="66" fill="#ffd60a"/>
  <path d="M50 26 C36 8 22 16 30 26Z M50 26 C64 8 78 16 70 26Z" fill="#ffd60a" stroke="#e0a800" stroke-width="2.5"/>
  <text x="50" y="80" text-anchor="middle" font-size="26" font-weight="700" fill="#fff" font-family="Fredoka, sans-serif">?</text>`;

const BOMB_SVG = `
  <circle cx="48" cy="58" r="34" fill="#3d3a5c" stroke="#1e1b33" stroke-width="3"/>
  <rect x="40" y="18" width="16" height="10" rx="3" fill="#6c6a8a"/>
  <path class="fuse" d="M48 18 Q54 6 66 8" fill="none" stroke="#b08968" stroke-width="4" stroke-linecap="round"/>
  <g class="spark"><circle cx="68" cy="8" r="6" fill="#ffd60a"/><circle cx="68" cy="8" r="3" fill="#fff"/></g>
  ${shine(32, 44)}
  ${face(48, 60, 0.9).replace(/#2b1b2e/g, '#ffffff')}`;

const RAINBOW_SVG = `
  <circle cx="50" cy="52" r="42" fill="#fff" stroke="#c084fc" stroke-width="3"/>
  ${['#ff4d6d', '#ff8c1a', '#ffd60a', '#52b788', '#4361ee', '#9d4edd']
    .map((c, i) => `<path d="M${16 + i * 5} 60 A${34 - i * 5} ${34 - i * 5} 0 0 1 ${84 - i * 5} 60" fill="none" stroke="${c}" stroke-width="5"/>`)
    .join('')}
  ${face(50, 66, 0.75)}`;

export function tileSvg(t: Tile): string {
  if (skin === 'retro') return retroTile(t);
  let body: string;
  switch (t.kind) {
    case 'fruit':
      body = FRUIT_SVG[t.fruit];
      break;
    case 'gift':
      body = giftSvg(t.gift);
      break;
    case 'bomb':
      body = BOMB_SVG;
      break;
    case 'rainbow':
      body = RAINBOW_SVG;
      break;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}

export function fruitSvg(i: number): string {
  if (skin === 'retro') return retroFruit(i);
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${FRUIT_SVG[i]}</svg>`;
}

export const ICONS = {
  brush: `<svg viewBox="0 0 100 100"><path d="M70 10 L90 30 L50 70 L30 50Z" fill="#a78bfa" stroke="#5b21b6" stroke-width="4" stroke-linejoin="round"/><path d="M30 50 L50 70 C46 86 26 92 10 90 C14 80 12 58 30 50Z" fill="#ff4d6d" stroke="#c9184a" stroke-width="4" stroke-linejoin="round"/></svg>`,
  undo: `<svg viewBox="0 0 100 100"><path d="M36 22 L14 44 L36 66" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 44 H60 C76 44 86 56 86 70 C86 84 76 90 64 90 H50" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/></svg>`,
  hint: `<svg viewBox="0 0 100 100"><path d="M50 10 C30 10 18 26 18 42 C18 56 28 62 32 72 H68 C72 62 82 56 82 42 C82 26 70 10 50 10Z" fill="#ffd60a" stroke="#e0a800" stroke-width="5"/><rect x="34" y="76" width="32" height="8" rx="4" fill="currentColor"/><rect x="38" y="86" width="24" height="8" rx="4" fill="currentColor"/></svg>`,
  back: `<svg viewBox="0 0 100 100"><path d="M60 18 L28 50 L60 82" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sound: `<svg viewBox="0 0 100 100"><path d="M14 38 H32 L54 18 V82 L32 62 H14Z" fill="currentColor"/><path d="M66 34 Q78 50 66 66 M76 24 Q96 50 76 76" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/></svg>`,
  mute: `<svg viewBox="0 0 100 100"><path d="M14 38 H32 L54 18 V82 L32 62 H14Z" fill="currentColor"/><path d="M66 36 L90 64 M90 36 L66 64" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/></svg>`,
  refresh: `<svg viewBox="0 0 100 100"><path d="M80 50 A30 30 0 1 1 68 26" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><path d="M58 14 L74 26 L60 40" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 100 100"><path d="M50 6 L62 36 L94 38 L69 59 L77 92 L50 74 L23 92 L31 59 L6 38 L38 36Z" fill="currentColor" stroke-linejoin="round"/></svg>`,
  lock: `<svg viewBox="0 0 100 100"><rect x="20" y="44" width="60" height="46" rx="10" fill="currentColor"/><path d="M32 44 V32 A18 18 0 0 1 68 32 V44" fill="none" stroke="currentColor" stroke-width="10"/></svg>`,
};
