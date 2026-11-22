# GroupBox — Design Spec

GroupBox is a family-friendly tile-clearing puzzle for older adults and kids.
Core rules follow the classic "same game" genre; the twist is fruit characters,
surprise gift boxes, and two play modes (Calm and Challenge).

## Platform
- Web app (HTML/CSS/TypeScript, built with Vite). Works on phones, tablets, desktops.
- Installable PWA, playable offline.

## Core rules
- Board is a grid of fruit tiles (columns × rows).
- Tap a tile to highlight its group (2+ orthogonally connected tiles of the same fruit);
  tap again to clear it. Tapping elsewhere changes selection. (Setting: one-tap clear.)
- After clearing, tiles fall down; empty columns shift left.
- Score for clearing n tiles: (n − 2)².
- End of round when no groups of 2+ remain and no usable power-ups.
- Clear-board bonus: +1000 if no fruit is left (leftover gift boxes don't count).

## Fruit friends
Strawberry (red), Lemon (yellow), Grape (purple), Blueberry (blue), Kiwi (green), Orange (orange).
Each fruit has a distinct silhouette and colour (colour-blind safe) and a face that
blinks while idle, wiggles when selected and pops when cleared.

## Gift boxes
- Placed on the board at generation; they fall like fruit but never form groups.
- A gift opens when an orthogonally adjacent group is cleared. Contents:
  - **Bomb** — becomes a bomb tile; tap it to clear the 3×3 area (1 pt per tile, gifts inside open).
  - **Rainbow** — becomes a wildcard tile that joins any adjacent group.
  - **Paint brush** — added to the player's tray; tap brush then a fruit to repaint it to its
    most common neighbouring fruit.
  - **Star** — +100 points immediately.

## Modes
- **Calm**: random 10×8 board, 4 fruits, unlimited undo, hint button, no fail —
  "Board done!" then offer a new board. Best score saved.
- **Challenge**: level map. Levels ramp from 8×8 / 3 fruits to 12×10 / 5 fruits; gift count
  decreases. Each level has 1/2/3-star score thresholds; passing needs 1 star.
  3 undos and 3 hints per level. Star targets are calibrated per level by a simple
  bot playthrough (group points only; the clear bonus is extra). Progress saved in localStorage.

## Look & feel
Bright, rounded cartoon style; big buttons, chunky type; bouncing landings, confetti on
board clear, floating score popups; gentle synthesized sounds (WebAudio) with mute toggle.

## Architecture
- `src/game/` — pure logic, no DOM: `rng`, `board`, `rules` (groups, gravity, scoring,
  gifts, power-ups), `levels`. Fully unit tested with Vitest.
- `src/ui/` — DOM rendering, SVG fruit art, screens (menu, map, game, results),
  sound, persistence.
- `public/` — manifest, icon, service worker.
