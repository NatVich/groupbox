import { makeRng } from '../game/rng';
import {
  at,
  bestHint,
  clearGroup,
  cloneState,
  detonate,
  findGroup,
  finishRound,
  groupPoints,
  hasMoves,
  isBoardClear,
  newGame,
  paint,
  paintTarget,
} from '../game/rules';
import { getLevel, Level, LEVEL_COUNT, startLevel, starsFor } from '../game/levels';
import type { GameState, MoveEvents, Pos, Tile } from '../game/types';
import { ICONS, tileSvg } from './art';
import { confetti } from './fx';
import { sfx } from './sound';
import type { SaveData } from './store';

export type Mode = { kind: 'calm' } | { kind: 'challenge'; level: number };

export interface GameCallbacks {
  data: SaveData;
  persist: () => void;
  onExit: () => void;
  onNextLevel: (n: number) => void;
}

const CALM = { cols: 10, rows: 8, fruits: 4, gifts: 6 };
const CHALLENGE_UNDOS = 3;
const CHALLENGE_HINTS = 3;

const GIFT_TEXT = {
  bomb: '💣 A bomb! Tap it to go BOOM',
  rainbow: '🌈 A rainbow! It joins any fruit',
  brush: '🖌️ A paint brush! Use it to recolour a fruit',
  star: '⭐ A star! +100 points',
};

const key = (p: Pos) => `${p.x},${p.y}`;

export class GameView {
  el: HTMLElement;
  private state!: GameState;
  private history: GameState[] = [];
  private level: Level | null = null;
  private undosLeft = Infinity;
  private hintsLeft = Infinity;
  private selection: Pos[] = [];
  private selectionKind: 'group' | 'bomb' | null = null;
  private painting = false;
  private busy = false;
  private ended = false;
  private size = 48;
  private tiles = new Map<number, HTMLElement>();
  private boardEl!: HTMLElement;
  private wrapEl!: HTMLElement;
  private resizeObs: ResizeObserver;

  constructor(private mode: Mode, private cb: GameCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'screen game-screen';
    this.el.innerHTML = this.template();
    this.boardEl = this.q('.board');
    this.wrapEl = this.q('.board-wrap');
    this.bindControls();
    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(this.wrapEl);
    this.start();
  }

  destroy() {
    this.resizeObs.disconnect();
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.el.querySelector(sel) as T;
  }

  private template(): string {
    const challenge = this.mode.kind === 'challenge';
    return `
      <header class="topbar">
        <button class="icon-btn back" aria-label="Back to menu">${ICONS.back}</button>
        <div class="title-chip">${challenge ? `Level ${(this.mode as { level: number }).level}` : 'Calm play'}</div>
        <div class="score-box"><span class="label">Score</span><span class="score">0</span></div>
      </header>
      <div class="goal">
        ${
          challenge
            ? `<div class="progress"><div class="fill"></div>
                 ${[0, 1, 2].map((i) => `<div class="star-mark" data-i="${i}">${ICONS.star}<span></span></div>`).join('')}
               </div>`
            : `<div class="best">Best: <b class="best-val">0</b></div>`
        }
        <div class="preview" aria-live="polite"></div>
      </div>
      <div class="board-wrap"><div class="board" role="grid" aria-label="Game board"></div><div class="toast"></div></div>
      <footer class="toolbar">
        <button class="tool undo">${ICONS.undo}<span>Undo</span><i class="badge"></i></button>
        <button class="tool hint">${ICONS.hint}<span>Hint</span><i class="badge"></i></button>
        <button class="tool brush">${ICONS.brush}<span>Brush</span><i class="badge"></i></button>
        ${challenge ? `<button class="tool restart">${ICONS.refresh}<span>Restart</span></button>` : `<button class="tool restart">${ICONS.refresh}<span>New</span></button>`}
      </footer>
      <div class="overlay hidden"></div>`;
  }

  private bindControls() {
    this.q('.back').onclick = () => this.cb.onExit();
    this.q('.undo').onclick = () => this.undo();
    this.q('.hint').onclick = () => this.hint();
    this.q('.brush').onclick = () => this.toggleBrush();
    this.q('.restart').onclick = () => this.start();
    this.boardEl.addEventListener('pointerdown', (e) => this.onTap(e));
  }

  // ---------- lifecycle ----------

  private start() {
    if (this.mode.kind === 'calm') {
      this.state = newGame(CALM, makeRng(Date.now() & 0xffffffff));
      this.level = null;
    } else {
      this.level = getLevel(this.mode.level);
      this.state = startLevel(this.level);
      this.undosLeft = CHALLENGE_UNDOS;
      this.hintsLeft = CHALLENGE_HINTS;
    }
    this.history = [];
    this.ended = false;
    this.busy = false;
    this.painting = false;
    this.clearSelection();
    this.q('.overlay').classList.add('hidden');
    for (const el of this.tiles.values()) el.remove();
    this.tiles.clear();
    this.layout();
    this.render(true);
    this.updateHud();
  }

  private layout() {
    if (!this.state) return;
    const { cols, rows } = this.state.board;
    const r = this.wrapEl.getBoundingClientRect();
    const s = Math.floor(Math.min(r.width / cols, r.height / rows, 96));
    if (s <= 0) return;
    this.size = s;
    this.boardEl.style.width = `${s * cols}px`;
    this.boardEl.style.height = `${s * rows}px`;
    this.boardEl.style.setProperty('--s', `${s}px`);
    for (const [id, el] of this.tiles) {
      const p = this.posOf(id);
      if (p) this.place(el, p);
    }
  }

  // ---------- rendering ----------

  private posOf(id: number): Pos | null {
    const b = this.state.board;
    for (let x = 0; x < b.cols; x++) for (let y = 0; y < b.rows; y++) if (b.cells[x][y]?.id === id) return { x, y };
    return null;
  }

  private place(el: HTMLElement, p: Pos) {
    el.style.transform = `translate(${p.x * this.size}px, ${p.y * this.size}px)`;
  }

  private sig(t: Tile): string {
    return t.kind === 'fruit' ? `f${t.fruit}` : t.kind === 'gift' ? `g${t.gift}` : t.kind;
  }

  private render(entering = false) {
    const b = this.state.board;
    const live = new Set<number>();
    for (let x = 0; x < b.cols; x++) {
      for (let y = 0; y < b.rows; y++) {
        const t = b.cells[x][y];
        if (!t) continue;
        live.add(t.id);
        let el = this.tiles.get(t.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'tile';
          el.innerHTML = `<div class="tile-inner"></div>`;
          this.boardEl.appendChild(el);
          this.tiles.set(t.id, el);
          if (entering) {
            const inner = el.firstElementChild as HTMLElement;
            inner.classList.add('enter');
            inner.style.animationDelay = `${x * 35 + (b.rows - y) * 25}ms`;
          }
        }
        const s = this.sig(t);
        if (el.dataset.sig !== s) {
          const changed = el.dataset.sig !== undefined;
          el.dataset.sig = s;
          el.dataset.kind = t.kind;
          const inner = el.firstElementChild as HTMLElement;
          inner.innerHTML = tileSvg(t);
          // Random blink timing so faces don't blink in unison.
          inner.style.setProperty('--blink', `${(t.id * 1.37) % 6}s`);
          if (changed) this.retrigger(inner, 'morph');
        }
        this.place(el, { x, y });
      }
    }
    for (const [id, el] of this.tiles) {
      if (!live.has(id)) {
        this.tiles.delete(id);
        el.remove();
      }
    }
  }

  private retrigger(el: HTMLElement, cls: string) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  private updateHud() {
    const s = this.state;
    this.q('.score').textContent = String(s.score);
    const badge = (sel: string, v: number | string, disabled: boolean) => {
      const btn = this.q<HTMLButtonElement>(sel);
      btn.querySelector('.badge')!.textContent = String(v);
      btn.disabled = disabled;
    };
    const inf = (n: number) => (n === Infinity ? '∞' : String(n));
    badge('.undo', inf(this.undosLeft), !this.history.length || this.undosLeft <= 0 || this.ended);
    badge('.hint', inf(this.hintsLeft), this.hintsLeft <= 0 || this.ended);
    badge('.brush', s.brushes, s.brushes <= 0 || this.ended);
    this.q('.brush').classList.toggle('active', this.painting);
    this.boardEl.classList.toggle('painting', this.painting);

    if (this.level) {
      const max = this.level.stars[2];
      const pct = Math.min(100, (s.score / max) * 100);
      this.q('.fill').style.width = `${pct}%`;
      this.el.querySelectorAll<HTMLElement>('.star-mark').forEach((m, i) => {
        const v = this.level!.stars[i];
        m.style.left = `${(v / max) * 100}%`;
        m.querySelector('span')!.textContent = String(v);
        const got = s.score >= v;
        if (got && !m.classList.contains('got')) {
          m.classList.add('got');
          if (s.score > 0) sfx.gift();
        } else if (!got) m.classList.remove('got');
      });
    } else {
      this.q('.best-val').textContent = String(Math.max(this.cb.data.calmBest, 0));
    }
    this.updatePreview();
  }

  private updatePreview() {
    const el = this.q('.preview');
    if (this.painting) {
      el.innerHTML = 'Tap a fruit to repaint it 🎨';
    } else if (this.selectionKind === 'group') {
      const n = this.selection.length;
      el.innerHTML = `<b>${n}</b> fruit → <b>+${groupPoints(n)}</b> ${this.cb.data.oneTap ? '' : '· tap again!'}`;
    } else if (this.selectionKind === 'bomb') {
      el.innerHTML = 'Tap the bomb again to go BOOM! 💥';
    } else {
      el.innerHTML = 'Tap a group of 2 or more matching fruit';
    }
  }

  // ---------- input ----------

  private cellFromEvent(e: PointerEvent): Pos | null {
    const r = this.boardEl.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / this.size);
    const y = Math.floor((e.clientY - r.top) / this.size);
    if (x < 0 || y < 0 || x >= this.state.board.cols || y >= this.state.board.rows) return null;
    return { x, y };
  }

  private onTap(e: PointerEvent) {
    if (this.busy || this.ended) return;
    const p = this.cellFromEvent(e);
    if (!p) return;
    const t = at(this.state.board, p.x, p.y);
    if (!t) {
      this.clearSelection();
      return;
    }

    if (this.painting) {
      if (paintTarget(this.state.board, p) === null) {
        sfx.nope();
        this.shake(t.id);
        return;
      }
      this.commit(() => paint(this.state, p), p);
      return;
    }

    const selected = this.selection.some((q) => q.x === p.x && q.y === p.y);
    if (t.kind === 'bomb') {
      if ((this.selectionKind === 'bomb' && selected) || this.cb.data.oneTap) {
        this.commit(() => detonate(this.state, p), p);
      } else {
        this.select(this.blastArea(p), 'bomb');
      }
      return;
    }

    if (this.selectionKind === 'group' && selected) {
      this.commit(() => clearGroup(this.state, p), p);
      return;
    }

    const g = findGroup(this.state.board, p);
    if (!g.length) {
      if (t.kind === 'gift') this.toast('🎁 Pop fruit next to the gift to open it!');
      sfx.nope();
      this.shake(t.id);
      this.clearSelection();
      return;
    }
    if (this.cb.data.oneTap) {
      this.commit(() => clearGroup(this.state, p), p);
    } else {
      this.select(g, 'group');
    }
  }

  private blastArea(p: Pos): Pos[] {
    const out: Pos[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) if (at(this.state.board, p.x + dx, p.y + dy)) out.push({ x: p.x + dx, y: p.y + dy });
    return out;
  }

  private select(cells: Pos[], kind: 'group' | 'bomb') {
    this.clearSelection();
    this.selection = cells;
    this.selectionKind = kind;
    this.boardEl.classList.add('has-selection');
    for (const p of cells) {
      const t = at(this.state.board, p.x, p.y);
      if (t) this.tiles.get(t.id)?.classList.add('selected');
    }
    sfx.select();
    this.updatePreview();
  }

  private clearSelection() {
    this.selection = [];
    this.selectionKind = null;
    this.boardEl.classList.remove('has-selection');
    this.boardEl.querySelectorAll('.selected, .hinted').forEach((el) => el.classList.remove('selected', 'hinted'));
    this.updatePreview();
  }

  private shake(id: number) {
    const el = this.tiles.get(id);
    if (el) this.retrigger(el.firstElementChild as HTMLElement, 'shake');
  }

  // ---------- moves ----------

  private commit(move: () => MoveEvents | null, tapped: Pos) {
    const before = cloneState(this.state);
    const ev = move();
    if (!ev) return;
    this.history.push(before);
    this.painting = false;
    this.clearSelection();
    this.busy = true;

    // 1. Pop the cleared tiles where they are.
    for (const c of ev.cleared) {
      const el = this.tiles.get(c.id);
      if (!el) continue;
      this.tiles.delete(c.id);
      el.classList.add('popping');
      el.style.transitionDelay = '0ms';
      (el.firstElementChild as HTMLElement).style.animationDelay = `${Math.random() * 60}ms`;
      setTimeout(() => el.remove(), 380);
    }
    // Collected gifts (brush/star) fly away.
    for (const o of ev.opened) {
      if (o.gift === 'brush' || o.gift === 'star') {
        const el = this.tiles.get(o.id);
        if (el) {
          this.tiles.delete(o.id);
          el.classList.add('collecting');
          setTimeout(() => el.remove(), 600);
        }
      }
    }

    if (ev.exploded) {
      sfx.boom();
      this.retrigger(this.boardEl, 'quake');
    } else if (ev.painted) {
      sfx.paint();
    } else {
      sfx.pop(ev.cleared.length);
    }
    if (ev.opened.length) {
      setTimeout(() => sfx.gift(), 150);
      const counts = new Map<string, number>();
      for (const o of ev.opened) counts.set(o.gift, (counts.get(o.gift) ?? 0) + 1);
      this.toast(
        [...counts].map(([g, n]) => GIFT_TEXT[g as keyof typeof GIFT_TEXT] + (n > 1 ? ` ×${n}` : '')).join('<br>'),
      );
    }
    if (ev.points > 0 || ev.cleared.length) this.floatScore(ev, tapped);

    // 2. After the pop, let everything fall into place.
    setTimeout(() => {
      this.render();
      this.updateHud();
      this.busy = false;
      if (!hasMoves(this.state)) setTimeout(() => this.endRound(), 600);
    }, ev.cleared.length ? 220 : 0);
    this.updateHud();
  }

  private floatScore(ev: MoveEvents, tapped: Pos) {
    let cx = tapped.x;
    let cy = tapped.y;
    if (ev.cleared.length) {
      cx = ev.cleared.reduce((s, c) => s + c.x, 0) / ev.cleared.length;
      cy = ev.cleared.reduce((s, c) => s + c.y, 0) / ev.cleared.length;
    }
    const f = document.createElement('div');
    f.className = 'floater';
    const big = ev.points >= 25;
    if (big) f.classList.add('big');
    f.textContent = ev.points > 0 ? `+${ev.points}` : 'Nice!';
    f.style.left = `${(cx + 0.5) * this.size}px`;
    f.style.top = `${(cy + 0.5) * this.size}px`;
    this.boardEl.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }

  private toast(html: string) {
    const t = this.q('.toast');
    t.innerHTML = html;
    this.retrigger(t, 'show');
  }

  private undo() {
    if (!this.history.length || this.undosLeft <= 0 || this.busy || this.ended) return;
    this.state = this.history.pop()!;
    this.undosLeft--;
    this.painting = false;
    this.clearSelection();
    this.render();
    this.updateHud();
  }

  private hint() {
    if (this.hintsLeft <= 0 || this.busy || this.ended) return;
    const h = bestHint(this.state.board);
    if (!h.length) return;
    this.hintsLeft--;
    this.clearSelection();
    for (const p of h) {
      const t = at(this.state.board, p.x, p.y);
      if (t) this.tiles.get(t.id)?.classList.add('hinted');
    }
    this.updateHud();
  }

  private toggleBrush() {
    if (this.state.brushes <= 0 || this.busy || this.ended) return;
    this.painting = !this.painting;
    this.clearSelection();
    this.updateHud();
  }

  // ---------- end of round ----------

  private endRound() {
    this.ended = true;
    const bonus = finishRound(this.state);
    const cleared = isBoardClear(this.state.board);
    this.updateHud();
    const d = this.cb.data;
    const ov = this.q('.overlay');
    let html: string;

    if (this.level) {
      const n = this.level.number;
      const stars = starsFor(this.level, this.state.score);
      const prevStars = d.levelStars[n] ?? 0;
      d.levelStars[n] = Math.max(prevStars, stars);
      d.levelBest[n] = Math.max(d.levelBest[n] ?? 0, this.state.score);
      this.cb.persist();
      const passed = stars > 0;
      html = `
        <div class="card results">
          <h2>${passed ? (stars === 3 ? 'Amazing!' : stars === 2 ? 'Great job!' : 'You did it!') : 'So close!'}</h2>
          <div class="big-stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${300 + i * 350}ms">${ICONS.star}</span>`).join('')}</div>
          ${bonus ? `<p class="bonus">🎉 Board cleared! +${bonus}</p>` : ''}
          <p class="final">Score <b>${this.state.score}</b></p>
          ${!passed ? `<p class="sub">Reach <b>${this.level.stars[0]}</b> points to win a star.</p>` : ''}
          <div class="actions">
            ${passed && n < LEVEL_COUNT ? `<button class="btn primary next">Next level ▶</button>` : ''}
            <button class="btn ${passed ? '' : 'primary'} retry">Try again</button>
            <button class="btn ghost map">Level map</button>
          </div>
        </div>`;
      if (passed) {
        sfx.win();
        confetti(this.el, stars * 40 + (cleared ? 60 : 0));
      } else sfx.done();
    } else {
      const best = this.state.score > d.calmBest;
      d.calmBest = Math.max(d.calmBest, this.state.score);
      this.cb.persist();
      html = `
        <div class="card results">
          <h2>${cleared ? 'Board cleared!' : 'Board done!'}</h2>
          ${bonus ? `<p class="bonus">🎉 Clear bonus +${bonus}</p>` : ''}
          <p class="final">Score <b>${this.state.score}</b></p>
          ${best ? `<p class="bonus">🏅 New best score!</p>` : `<p class="sub">Best: ${d.calmBest}</p>`}
          <div class="actions">
            <button class="btn primary again">New board</button>
            <button class="btn ghost menu">Menu</button>
          </div>
        </div>`;
      if (cleared || best) {
        sfx.win();
        confetti(this.el, 120);
      } else sfx.done();
    }

    ov.innerHTML = html;
    ov.classList.remove('hidden');
    const on = (sel: string, fn: () => void) => {
      const b = ov.querySelector<HTMLElement>(sel);
      if (b) b.onclick = fn;
    };
    on('.next', () => this.cb.onNextLevel((this.level?.number ?? 0) + 1));
    on('.retry', () => this.start());
    on('.again', () => this.start());
    on('.map', () => this.cb.onExit());
    on('.menu', () => this.cb.onExit());
  }
}
