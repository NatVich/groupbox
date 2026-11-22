# GroupBox 🍓🍋🍇

A cheerful tile-popping puzzle for kids and grown-ups, played in the browser.

Tap a group of 2 or more matching **fruit friends** to pop them. Fruit falls down, empty
columns slide left, and bigger groups score far more points: `(n − 2)²`. Clear every fruit
for a **+1000** bonus.

## The twist
- **Fruit friends:** strawberry, lemon, grape, blueberry, kiwi and orange. Each one has its own
  colour *and* shape, so colour-blind players can tell them apart too. They blink, wiggle and pop.
- **Gift boxes 🎁:** pop fruit next to a gift to open it:
  - 💣 **Bomb:** tap it to clear a 3×3 area
  - 🌈 **Rainbow:** a wildcard that joins any fruit group
  - 🖌️ **Paint brush:** recolour one fruit to match its neighbours
  - ⭐ **Star:** +100 points
- **Two modes:**
  - 🌿 **Calm:** no rush, unlimited undo and hints, no losing
  - 🏆 **Challenge:** 24 levels on a map, with 1–3 stars to earn on each

- **Player profiles:** each family member picks a name and a fruit-friend avatar and keeps
  their own stars and best scores. A **family leaderboard** compares everyone.
  Profiles are saved in **Firebase** and shared across devices with a family code
  (like `PEAR-4821`). See [`docs/firebase-setup.md`](docs/firebase-setup.md).

Big buttons, one tap to pop (with an optional "tap twice" safety), gentle sounds with a mute
button, and progress saved in the browser. It can be installed as an app (PWA) and works
offline.

**Play online:** https://natvich.github.io/groupbox/

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # game-logic unit tests
npm run build    # production build in dist/
```

The design spec is in [`docs/specs/2026-11-22-groupbox-design.md`](docs/specs/2026-11-22-groupbox-design.md).

## Deploy

Every push to `main` builds the game, runs the tests and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). One-time setup: in the repository's **Settings → Pages**,
set **Source** to **GitHub Actions**.
