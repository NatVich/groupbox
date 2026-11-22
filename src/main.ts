import './ui/style.css';
import { getLevel, LEVEL_COUNT } from './game/levels';
import { groupPoints } from './game/rules';
import { fruitSvg, ICONS, tileSvg } from './ui/art';
import { GameView, Mode } from './ui/game-view';
import { setMuted, sfx } from './ui/sound';
import { load, save } from './ui/store';

const app = document.getElementById('app')!;
const data = load();
setMuted(data.muted);
let current: GameView | null = null;

function show(el: HTMLElement) {
  current?.destroy();
  current = null;
  app.replaceChildren(el);
}

function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

// ---------- menu ----------

function menu() {
  const el = h(`
    <div class="screen menu">
      <div class="logo">
        <div class="fruit-row">${[0, 1, 2, 3, 4, 5].map((i) => `<span style="animation-delay:${i * 120}ms">${fruitSvg(i)}</span>`).join('')}</div>
        <h1><span>Group</span><span>Box</span></h1>
        <p class="tagline">Pop the fruit friends!</p>
      </div>
      <div class="menu-buttons">
        <button class="btn big calm"><b>🌿 Calm play</b><small>No rush · unlimited undo &amp; hints</small></button>
        <button class="btn big challenge"><b>🏆 Challenge</b><small>${LEVEL_COUNT} levels · collect the stars</small></button>
        <button class="btn how">❓ How to play</button>
      </div>
      <div class="settings">
        <button class="toggle sound" aria-pressed="${!data.muted}">${data.muted ? ICONS.mute : ICONS.sound}<span>Sound</span></button>
        <button class="toggle twotap" aria-pressed="${data.twoTap}"><span class="dot"></span><span>Tap twice to pop</span></button>
      </div>
    </div>`);
  el.querySelector<HTMLElement>('.calm')!.onclick = () => play({ kind: 'calm' });
  el.querySelector<HTMLElement>('.challenge')!.onclick = () => levelMap();
  el.querySelector<HTMLElement>('.how')!.onclick = () => howTo(el);
  const sound = el.querySelector<HTMLElement>('.sound')!;
  sound.onclick = () => {
    data.muted = !data.muted;
    setMuted(data.muted);
    save(data);
    sound.setAttribute('aria-pressed', String(!data.muted));
    sound.firstElementChild!.outerHTML = data.muted ? ICONS.mute : ICONS.sound;
    sfx.select();
  };
  const twoTap = el.querySelector<HTMLElement>('.twotap')!;
  twoTap.onclick = () => {
    data.twoTap = !data.twoTap;
    save(data);
    twoTap.setAttribute('aria-pressed', String(data.twoTap));
    sfx.select();
  };
  show(el);
  let seen = false;
  try {
    seen = !!localStorage.getItem('groupbox-seen-howto');
    localStorage.setItem('groupbox-seen-howto', '1');
  } catch {
    /* storage blocked: just show the guide */
  }
  if (!seen) howTo(el);
}

function howTo(host: HTMLElement) {
  const ov = h(`
    <div class="overlay">
      <div class="card howto">
        <h2>How to play</h2>
        <ol>
          <li><div class="demo">${fruitSvg(0)}${fruitSvg(0)}${fruitSvg(0)}</div>
            <p>Tap a group of <b>2 or more</b> matching fruit touching side by side to pop them!</p></li>
          <li><div class="demo nums"><span>3 → <b>+${groupPoints(3)}</b></span><span>6 → <b>+${groupPoints(6)}</b></span><span>10 → <b>+${groupPoints(10)}</b></span></div>
            <p><b>Bigger groups score way more.</b> Join fruit together before you pop.</p></li>
          <li><div class="demo">${tileSvg({ kind: 'gift', id: 0, gift: 'star' })}</div>
            <p>Pop fruit next to a <b>gift box</b> to open it: a bomb 💣, rainbow 🌈, paint brush 🖌️ or star ⭐.</p></li>
          <li><div class="demo">🎉</div>
            <p>Clear <b>every fruit</b> for a big <b>+1000</b> bonus!</p></li>
        </ol>
        <button class="btn primary close">Let's play!</button>
      </div>
    </div>`);
  ov.querySelector<HTMLElement>('.close')!.onclick = () => ov.remove();
  host.appendChild(ov);
}

// ---------- level map ----------

function unlocked(n: number) {
  return n === 1 || (data.levelStars[n - 1] ?? 0) > 0;
}

function levelMap() {
  const total = Object.values(data.levelStars).reduce((s, v) => s + v, 0);
  const el = h(`
    <div class="screen map">
      <header class="topbar">
        <button class="icon-btn back" aria-label="Back">${ICONS.back}</button>
        <div class="title-chip">Challenge</div>
        <div class="score-box star-total">${ICONS.star}<span>${total}/${LEVEL_COUNT * 3}</span></div>
      </header>
      <div class="levels">
        ${Array.from({ length: LEVEL_COUNT }, (_, i) => {
          const n = i + 1;
          const open = unlocked(n);
          const stars = data.levelStars[n] ?? 0;
          return `<button class="level ${open ? '' : 'locked'} ${stars ? 'done' : ''}" data-n="${n}" ${open ? '' : 'disabled'}>
              <span class="num">${open ? n : ICONS.lock}</span>
              <span class="mini-stars">${[0, 1, 2].map((s) => `<i class="${s < stars ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span>
            </button>`;
        }).join('')}
      </div>
    </div>`);
  el.querySelector<HTMLElement>('.back')!.onclick = () => menu();
  el.querySelectorAll<HTMLButtonElement>('.level:not(.locked)').forEach((b) => {
    b.onclick = () => play({ kind: 'challenge', level: Number(b.dataset.n) });
  });
  show(el);
  // Scroll the next level to play into view.
  const next = [...el.querySelectorAll<HTMLElement>('.level:not(.locked):not(.done)')][0];
  next?.classList.add('next-up');
  next?.scrollIntoView({ block: 'center' });
}

// ---------- game ----------

function play(mode: Mode) {
  if (mode.kind === 'challenge') getLevel(mode.level); // warm the cache
  const view = new GameView(mode, {
    data,
    persist: () => save(data),
    onExit: () => (mode.kind === 'calm' ? menu() : levelMap()),
    onNextLevel: (n) => play({ kind: 'challenge', level: n }),
  });
  show(view.el);
  current = view;
}

menu();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
