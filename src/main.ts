import './ui/style.css';
import { LoadError, openStore } from './data';
import {
  cleanName,
  dailyBoard,
  diffProgress,
  Family,
  leaderboard,
  levelsBeaten,
  MAX_NAME,
  newPlayer,
  normalizeFamilyCode,
  Player,
  ProfileStore,
  SetupError,
  totalStars,
} from './data/types';
import { FRUITS } from './game/types';
import { dateKey, prettyDate, streak } from './game/daily';
import { getLevel, LEVEL_COUNT } from './game/levels';
import { groupPoints } from './game/rules';
import { fruitSvg, ICONS, setSkin, Skin, tileSvg } from './ui/art';
import { GameView, Mode } from './ui/game-view';
import { setMuted, setRetroSound, sfx } from './ui/sound';
import { clearLegacy, legacyProgress, loadSettings, saveSettings } from './ui/store';

const app = document.getElementById('app')!;
const settings = loadSettings();
setMuted(settings.muted);
applySkin(settings.skin ?? 'fruit');

function applySkin(s: Skin) {
  setSkin(s);
  setRetroSound(s === 'retro');
  document.documentElement.dataset.skin = s;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', s === 'retro' ? '#0b0b1e' : '#ffb4c8');
}

let store: ProfileStore;
let family: Family | null = null;
let players: Player[] = [];
let player: Player | null = null;
let current: GameView | null = null;
/** Draws the screen that is showing again; used when other devices changed the family's data. */
let rerender: (() => void) | null = null;
let lastRefresh = 0;

function show(el: HTMLElement) {
  current?.destroy();
  current = null;
  app.replaceChildren(el);
}

const playersSignature = () =>
  JSON.stringify(
    [...players]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => [p.id, p.name, p.avatar, p.levelStars, p.levelBest, p.calmBest, p.daily ?? null]),
  ) + (player?.id ?? '');

/** Reloads the family's players (at most every 2 s). True when anything shown on screen changed. */
async function refreshPlayers(): Promise<boolean> {
  if (!family || Date.now() - lastRefresh < 2000) return false;
  lastRefresh = Date.now();
  const before = playersSignature();
  try {
    await loadPlayers();
  } catch {
    return false;
  }
  // The current player may have new progress from another device, or may have been deleted there.
  if (player) player = players.find((p) => p.id === player!.id) ?? null;
  return playersSignature() !== before;
}

/** Shows `render`'s screen, then quietly checks for changes made on other devices and redraws. */
function keepFresh(render: () => void, el: HTMLElement) {
  rerender = render;
  void refreshPlayers().then((changed) => {
    if (changed && app.contains(el) && !app.querySelector('.overlay')) render();
  });
}

// Coming back to the app after a while: pick up what other devices saved meanwhile.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || current || !rerender) return;
  const render = rerender;
  lastRefresh = 0;
  void refreshPlayers().then((changed) => {
    if (changed && rerender === render && !current && !app.querySelector('.overlay')) render();
  });
});

function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const avatar = (p: Player, cls = '') => `<span class="avatar ${cls}">${fruitSvg(p.avatar)}</span>`;

/** Shows a short warning at the bottom of the screen. */
function warn(text: string) {
  document.querySelector('.save-warning')?.remove();
  const el = h(`<div class="save-warning" role="alert">${esc(text)}</div>`);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 9000);
}

function message(title: string, body: string, retry?: () => void) {
  const el = h(`
    <div class="screen centered">
      <div class="card">
        <h2>${title}</h2>
        <p class="sub">${body}</p>
        <div class="actions">${retry ? '<button class="btn primary retry">Try again</button>' : ''}</div>
      </div>
    </div>`);
  if (retry) el.querySelector<HTMLElement>('.retry')!.onclick = retry;
  rerender = null;
  show(el);
}

// ---------- boot ----------

async function boot() {
  show(h(`<div class="screen centered"><div class="loading">${fruitSvg(0)}<p>Loading…</p></div></div>`));
  try {
    store = await openStore();
    store.onSaveError = (e) => warn(`Progress is not saving to the family yet. ${e.message}`);
    if (settings.familyCode) family = await store.getFamily(settings.familyCode);
    if (!family && store.kind === 'local') {
      // Browser-only mode: one family per browser, created quietly.
      family = await store.createFamily('My family');
    }
    if (!family) return welcome();
    settings.familyCode = family.code;
    saveSettings(settings);
    await loadPlayers();
    player = players.find((p) => p.id === settings.playerId) ?? null;
    if (player) menu();
    else whoIsPlaying();
  } catch (e) {
    console.error(e);
    if (e instanceof LoadError) {
      // A failed download is remembered by the browser for this page, so start the page again.
      message('Can’t load GroupBox', 'Check the internet connection, then try again.', () => location.reload());
      return;
    }
    message(
      e instanceof SetupError ? 'One more setup step' : 'Can’t reach GroupBox',
      e instanceof SetupError ? e.message : 'Check the internet connection, then try again.',
      boot,
    );
  }
}

async function loadPlayers() {
  players = family ? await store.listPlayers(family.code) : [];
}

// ---------- welcome (Firebase: start or join a family) ----------

function welcome() {
  const el = h(`
    <div class="screen menu">
      <div class="logo">
        <div class="fruit-row">${[0, 1, 2, 3, 4, 5].map((i) => `<span style="animation-delay:${i * 120}ms">${fruitSvg(i)}</span>`).join('')}</div>
        <h1><span>Group</span><span>Box</span></h1>
        <p class="tagline">Let’s set up your family</p>
      </div>
      <div class="menu-buttons">
        <button class="btn big calm start"><b>👪 Start a family</b><small>New here? Make your family’s game</small></button>
        <button class="btn big challenge join"><b>🔑 Join with a code</b><small>Someone already set it up</small></button>
      </div>
    </div>`);
  el.querySelector<HTMLElement>('.start')!.onclick = () => startFamily(el);
  el.querySelector<HTMLElement>('.join')!.onclick = () => joinFamily(el);
  rerender = null;
  show(el);
}

function startFamily(host: HTMLElement) {
  const ov = h(`
    <div class="overlay">
      <form class="card form">
        <h2>Start a family</h2>
        <label for="family-name">Family name</label>
        <input id="family-name" maxlength="30" placeholder="The Smiths" autocomplete="off">
        <p class="error" hidden></p>
        <div class="actions">
          <button class="btn primary" type="submit">Create</button>
          <button class="btn ghost cancel" type="button">Cancel</button>
        </div>
      </form>
    </div>`);
  const form = ov.querySelector('form')!;
  const input = ov.querySelector<HTMLInputElement>('#family-name')!;
  const err = ov.querySelector<HTMLElement>('.error')!;
  ov.querySelector<HTMLElement>('.cancel')!.onclick = () => ov.remove();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = cleanName(input.value) || 'Our family';
    const btn = form.querySelector<HTMLButtonElement>('[type=submit]')!;
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      family = await store.createFamily(name);
      settings.familyCode = family.code;
      saveSettings(settings);
      players = [];
      ov.remove();
      showFamilyCode(true);
    } catch (e2) {
      console.error(e2);
      err.textContent = e2 instanceof SetupError ? e2.message : 'Couldn’t create the family. Check the internet connection and try again.';
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Create';
    }
  };
  host.appendChild(ov);
  input.focus();
}

function joinFamily(host: HTMLElement) {
  const ov = h(`
    <div class="overlay">
      <form class="card form">
        <h2>Join a family</h2>
        <label for="family-code">Family code</label>
        <input id="family-code" class="code-input" maxlength="14" placeholder="PEAR-4821" autocomplete="off" autocapitalize="characters">
        <p class="hint">Find it on another device: tap <b>Family code</b> on the <b>Who’s playing?</b> screen.</p>
        <p class="error" hidden></p>
        <div class="actions">
          <button class="btn primary" type="submit">Join</button>
          <button class="btn ghost cancel" type="button">Cancel</button>
        </div>
      </form>
    </div>`);
  const form = ov.querySelector('form')!;
  const input = ov.querySelector<HTMLInputElement>('#family-code')!;
  const err = ov.querySelector<HTMLElement>('.error')!;
  ov.querySelector<HTMLElement>('.cancel')!.onclick = () => ov.remove();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fail = (msg: string) => {
      err.textContent = msg;
      err.hidden = false;
    };
    const code = normalizeFamilyCode(input.value);
    if (!code) return fail('A family code looks like PEAR-4821: a fruit name and 4 numbers.');
    const btn = form.querySelector<HTMLButtonElement>('[type=submit]')!;
    btn.disabled = true;
    try {
      const f = await store.getFamily(code);
      if (!f) {
        btn.disabled = false;
        return fail(`No family uses ${code}. Check the letters and numbers and try again.`);
      }
      family = f;
      settings.familyCode = f.code;
      settings.playerId = undefined;
      saveSettings(settings);
      await loadPlayers();
      whoIsPlaying();
    } catch (e2) {
      console.error(e2);
      btn.disabled = false;
      fail(e2 instanceof SetupError ? e2.message : 'Couldn’t check that code. Check the internet connection and try again.');
    }
  };
  host.appendChild(ov);
  input.focus();
}

function showFamilyCode(isNew = false) {
  if (!family) return;
  const ov = h(`
    <div class="overlay">
      <div class="card">
        <h2>${isNew ? 'Your family is ready!' : esc(family.name)}</h2>
        <p class="sub">To play on another phone or tablet, choose <b>Join with a code</b> and type:</p>
        <div class="family-code">${esc(family.code)}</div>
        <button class="btn copy">Copy code</button>
        <p class="hint">Anyone with this code can see and play your family’s profiles, so share it only with family.</p>
        <div class="actions"><button class="btn primary close">${isNew ? 'Add players' : 'Done'}</button></div>
      </div>
    </div>`);
  ov.querySelector<HTMLElement>('.copy')!.onclick = async (e) => {
    const btn = e.currentTarget as HTMLElement;
    try {
      await navigator.clipboard.writeText(family!.code);
      btn.textContent = 'Copied!';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(ov.querySelector('.family-code')!);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      btn.textContent = 'Code selected: copy it from here';
    }
  };
  ov.querySelector<HTMLElement>('.close')!.onclick = () => {
    ov.remove();
    if (isNew) whoIsPlaying();
  };
  app.appendChild(ov);
}

// ---------- who's playing ----------

function whoIsPlaying() {
  const shared = store.kind === 'firebase';
  const el = h(`
    <div class="screen players">
      <header class="topbar">
        <div class="title-chip">Who’s playing?</div>
      </header>
      ${shared && family ? `<p class="family-line">${esc(family.name)}</p>` : ''}
      <div class="player-grid">
        ${[...players]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (p) => `
          <div class="player-card" data-id="${esc(p.id)}">
            <button class="pick" aria-label="Play as ${esc(p.name)}">${avatar(p, 'big')}<b>${esc(p.name)}</b>
              <span class="mini-total">${ICONS.star}${totalStars(p)}</span></button>
            <button class="edit" aria-label="Edit ${esc(p.name)}">✏️</button>
          </div>`,
          )
          .join('')}
        <button class="player-card add"><span class="avatar big plus">+</span><b>Add player</b></button>
      </div>
      <div class="player-footer">
        ${players.length > 1 ? `<button class="btn small board-btn">🥇 Family leaderboard</button>` : ''}
        ${shared ? `<button class="btn small code-btn">🔑 Family code</button><button class="btn small ghost leave">Switch family</button>` : ''}
      </div>
    </div>`);
  el.querySelectorAll<HTMLElement>('.player-card[data-id]').forEach((card) => {
    const p = players.find((x) => x.id === card.dataset.id)!;
    card.querySelector<HTMLElement>('.pick')!.onclick = () => choosePlayer(p);
    card.querySelector<HTMLElement>('.edit')!.onclick = () => editPlayer(p);
  });
  el.querySelector<HTMLElement>('.add')!.onclick = () => editPlayer(null);
  el.querySelector<HTMLElement>('.board-btn')?.addEventListener('click', () => leaderboardScreen());
  el.querySelector<HTMLElement>('.code-btn')?.addEventListener('click', () => showFamilyCode());
  el.querySelector<HTMLElement>('.leave')?.addEventListener('click', () => leaveFamily(el));
  show(el);
  if (!players.length) editPlayer(null);
  keepFresh(whoIsPlaying, el);
}

function choosePlayer(p: Player) {
  player = p;
  settings.playerId = p.id;
  saveSettings(settings);
  sfx.select();
  menu();
}

function editPlayer(existing: Player | null) {
  let picked = existing?.avatar ?? players.length % FRUITS.length;
  const ov = h(`
    <div class="overlay">
      <form class="card form">
        <h2>${existing ? 'Edit player' : 'New player'}</h2>
        <label for="player-name">Name</label>
        <input id="player-name" maxlength="${MAX_NAME}" placeholder="Grandma, Mia…" value="${esc(existing?.name ?? '')}" autocomplete="off">
        <label>Pick your fruit friend</label>
        <div class="avatar-picker" role="radiogroup" aria-label="Fruit friend">
          ${FRUITS.map((f, i) => `<button type="button" role="radio" class="avatar-opt" data-i="${i}" aria-label="${f}" aria-checked="${i === picked}">${fruitSvg(i)}</button>`).join('')}
        </div>
        <p class="error" hidden></p>
        <div class="actions">
          <button class="btn primary" type="submit">${existing ? 'Save' : 'Add player'}</button>
          ${existing ? '<button class="btn danger delete" type="button">Delete player</button>' : ''}
          ${players.length || existing ? '<button class="btn ghost cancel" type="button">Cancel</button>' : ''}
        </div>
      </form>
    </div>`);
  const form = ov.querySelector('form')!;
  const input = ov.querySelector<HTMLInputElement>('#player-name')!;
  const err = ov.querySelector<HTMLElement>('.error')!;
  ov.querySelectorAll<HTMLElement>('.avatar-opt').forEach((b) => {
    b.onclick = () => {
      picked = Number(b.dataset.i);
      ov.querySelectorAll('.avatar-opt').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
      sfx.select();
    };
  });
  ov.querySelector<HTMLElement>('.cancel')?.addEventListener('click', () => ov.remove());

  const del = ov.querySelector<HTMLElement>('.delete');
  if (del && existing) {
    let armed = false;
    del.onclick = async () => {
      if (!armed) {
        armed = true;
        del.textContent = `Yes, delete ${existing.name} and all their stars`;
        return;
      }
      try {
        await store.deletePlayer(family!.code, existing.id);
        players = players.filter((p) => p.id !== existing.id);
        if (player?.id === existing.id) player = null;
        ov.remove();
        whoIsPlaying();
      } catch {
        err.textContent = 'Couldn’t delete. Check the internet connection and try again.';
        err.hidden = false;
      }
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = cleanName(input.value);
    if (!name) {
      err.textContent = 'Type a name first.';
      err.hidden = false;
      return;
    }
    let p: Player;
    if (existing) {
      p = { ...existing, name, avatar: picked };
    } else {
      p = newPlayer(name, picked);
      // The first profile keeps any progress from before profiles existed.
      const legacy = players.length === 0 ? legacyProgress() : null;
      if (legacy) Object.assign(p, legacy);
    }
    try {
      if (existing) await store.saveProfile(family!.code, p.id, { name: p.name, avatar: p.avatar });
      else await store.savePlayer(family!.code, p);
      if (!existing && players.length === 0) clearLegacy();
      players = [...players.filter((x) => x.id !== p.id), p];
      if (player?.id === p.id) player = p;
      ov.remove();
      if (existing) whoIsPlaying();
      else choosePlayer(p);
    } catch {
      err.textContent = 'Couldn’t save. Check the internet connection and try again.';
      err.hidden = false;
    }
  };
  app.appendChild(ov);
  if (!existing) input.focus();
}

function leaveFamily(host: HTMLElement) {
  const ov = h(`
    <div class="overlay">
      <div class="card">
        <h2>Switch family?</h2>
        <p class="sub">This device will stop showing <b>${esc(family?.name ?? '')}</b>. Nothing is deleted: join again any time with the code <b>${esc(family?.code ?? '')}</b>.</p>
        <div class="actions">
          <button class="btn primary yes">Switch family</button>
          <button class="btn ghost no">Cancel</button>
        </div>
      </div>
    </div>`);
  ov.querySelector<HTMLElement>('.no')!.onclick = () => ov.remove();
  ov.querySelector<HTMLElement>('.yes')!.onclick = () => {
    settings.familyCode = undefined;
    settings.playerId = undefined;
    saveSettings(settings);
    family = null;
    player = null;
    players = [];
    welcome();
  };
  host.appendChild(ov);
}

// ---------- leaderboard ----------

async function leaderboardScreen() {
  try {
    await loadPlayers();
    if (player) player = players.find((p) => p.id === player!.id) ?? player;
  } catch {
    /* show what we have */
  }
  const ranked = leaderboard(players);
  const medal = ['🥇', '🥈', '🥉'];
  const el = h(`
    <div class="screen board-screen">
      <header class="topbar">
        <button class="icon-btn back" aria-label="Back">${ICONS.back}</button>
        <div class="title-chip">Family leaderboard</div>
        <div class="spacer"></div>
      </header>
      <ol class="ranking">
        ${ranked
          .map(
            (p, i) => `
          <li class="${player?.id === p.id ? 'me' : ''}">
            <span class="rank">${medal[i] ?? i + 1}</span>
            ${avatar(p)}
            <span class="who"><b>${esc(p.name)}</b><small>${levelsBeaten(p)} of ${LEVEL_COUNT} levels</small></span>
            <span class="stat stars">${ICONS.star}<b>${totalStars(p)}</b></span>
            <span class="stat calm"><small>Calm best</small><b>${p.calmBest}</b></span>
          </li>`,
          )
          .join('')}
      </ol>
    </div>`);
  el.querySelector<HTMLElement>('.back')!.onclick = () => (player ? menu() : whoIsPlaying());
  rerender = () => void leaderboardScreen();
  show(el);
}

// ---------- menu ----------

function menu() {
  if (!player) return whoIsPlaying();
  const p = player;
  const el = h(`
    <div class="screen menu">
      <div class="menu-top">
        <button class="player-chip" aria-label="Switch player">${avatar(p)}<span>Hi, <b>${esc(p.name)}</b>!</span><small>Switch</small></button>
        ${
          (settings.skin ?? 'fruit') === 'retro'
            ? '<button class="skin-quick" data-skin="fruit" aria-label="Switch to the fruit look"><span class="ico">🍓</span><span>Fruit</span></button>'
            : '<button class="skin-quick" data-skin="retro" aria-label="Switch to the retro look"><span class="ico">👾</span><span>Retro</span></button>'
        }
      </div>
      <div class="logo">
        <div class="fruit-row">${[0, 1, 2, 3, 4, 5].map((i) => `<span style="animation-delay:${i * 120}ms">${fruitSvg(i)}</span>`).join('')}</div>
        <h1><span>Group</span><span>Box</span></h1>
        <p class="tagline">Pop the fruit friends!</p>
      </div>
      <div class="menu-buttons">
        <button class="btn big calm"><b>🌿 Calm play</b><small>No rush · unlimited undo &amp; hints</small></button>
        <button class="btn big daily"><b>📅 Daily puzzle</b><small>${dailySubtitle(p)}</small></button>
        <button class="btn big challenge"><b>🏆 Challenge</b><small>${totalStars(p)} of ${LEVEL_COUNT * 3} stars collected</small></button>
        <div class="menu-row">
          <button class="btn how">❓ How to play</button>
          ${players.length > 1 ? '<button class="btn board-btn">🥇 Leaderboard</button>' : ''}
        </div>
      </div>
      <div class="settings">
        <button class="toggle sound" aria-pressed="${!settings.muted}">${settings.muted ? ICONS.mute : ICONS.sound}<span>Sound</span></button>
        <button class="toggle twotap" aria-pressed="${settings.twoTap}"><span class="dot"></span><span>Tap twice to pop</span></button>
        <div class="skin-switch" role="radiogroup" aria-label="Game look">
          <button role="radio" data-skin="fruit" aria-checked="${(settings.skin ?? 'fruit') === 'fruit'}">🍓 Fruit</button>
          <button role="radio" data-skin="retro" aria-checked="${settings.skin === 'retro'}">👾 Retro</button>
        </div>
      </div>
    </div>`);
  el.querySelector<HTMLElement>('.player-chip')!.onclick = () => whoIsPlaying();
  el.querySelector<HTMLElement>('.calm')!.onclick = () => play({ kind: 'calm' });
  el.querySelector<HTMLElement>('.daily')!.onclick = () => dailyScreen();
  el.querySelector<HTMLElement>('.challenge')!.onclick = () => levelMap();
  el.querySelector<HTMLElement>('.how')!.onclick = () => howTo(el);
  el.querySelector<HTMLElement>('.board-btn')?.addEventListener('click', () => leaderboardScreen());
  const sound = el.querySelector<HTMLElement>('.sound')!;
  sound.onclick = () => {
    settings.muted = !settings.muted;
    setMuted(settings.muted);
    saveSettings(settings);
    sound.setAttribute('aria-pressed', String(!settings.muted));
    sound.firstElementChild!.outerHTML = settings.muted ? ICONS.mute : ICONS.sound;
    sfx.select();
  };
  el.querySelectorAll<HTMLElement>('.skin-switch button, .skin-quick').forEach((b) => {
    b.onclick = () => {
      const s = b.dataset.skin as Skin;
      if (s === (settings.skin ?? 'fruit')) return;
      settings.skin = s;
      saveSettings(settings);
      applySkin(s);
      sfx.gift();
      menu();
    };
  });
  const twoTap = el.querySelector<HTMLElement>('.twotap')!;
  twoTap.onclick = () => {
    settings.twoTap = !settings.twoTap;
    saveSettings(settings);
    twoTap.setAttribute('aria-pressed', String(settings.twoTap));
    sfx.select();
  };
  show(el);
  keepFresh(menu, el);
  let seen = false;
  try {
    seen = !!localStorage.getItem('groupbox-seen-howto');
    localStorage.setItem('groupbox-seen-howto', '1');
  } catch {
    /* storage blocked: just show the guide */
  }
  if (!seen) howTo(el);
}

function dailySubtitle(p: Player): string {
  const today = dateKey();
  const score = p.daily?.[today];
  const days = streak(p.daily, today);
  if (score !== undefined) return `Today: ${score} points · 🔥 ${days} ${days === 1 ? 'day' : 'days'}`;
  return days > 0 ? `New board today · 🔥 ${days} days, keep it going!` : 'A new board every day';
}

// ---------- daily puzzle ----------

async function dailyScreen() {
  if (!player) return whoIsPlaying();
  try {
    await loadPlayers();
    player = players.find((p) => p.id === player!.id) ?? player;
  } catch {
    /* show what we have */
  }
  const me = player;
  const today = dateKey();
  const mine = me.daily?.[today];
  const days = streak(me.daily, today);
  const rows = dailyBoard(players, today);
  const medal = ['🥇', '🥈', '🥉'];
  const el = h(`
    <div class="screen board-screen">
      <header class="topbar">
        <button class="icon-btn back" aria-label="Back">${ICONS.back}</button>
        <div class="title-chip">Daily puzzle</div>
        <div class="spacer"></div>
      </header>
      <div class="daily-hero">
        <div class="daily-date">${prettyDate(today)}</div>
        <p class="sub">Everyone gets the same board today. Your best score counts.</p>
        <div class="daily-facts">
          <span><b>${mine ?? '–'}</b><small>your best today</small></span>
          <span><b>🔥 ${days}</b><small>${days === 1 ? 'day' : 'days'} in a row</small></span>
        </div>
        <button class="btn primary big-play play">${mine === undefined ? 'Play today’s puzzle' : 'Play again'}</button>
      </div>
      <h3 class="section-title">Today’s scores</h3>
      <ol class="ranking">
        ${rows
          .map(({ player: p, score }, i) => `
          <li class="${me.id === p.id ? 'me' : ''} ${score === null ? 'idle' : ''}">
            <span class="rank">${score === null ? '–' : (medal[i] ?? i + 1)}</span>
            ${avatar(p)}
            <span class="who"><b>${esc(p.name)}</b><small>${score === null ? 'not played yet' : `🔥 ${streak(p.daily, today)} in a row`}</small></span>
            <span class="stat"><b>${score ?? ''}</b></span>
          </li>`)
          .join('')}
      </ol>
    </div>`);
  el.querySelector<HTMLElement>('.back')!.onclick = () => menu();
  el.querySelector<HTMLElement>('.play')!.onclick = () => play({ kind: 'daily', date: today });
  rerender = () => void dailyScreen();
  show(el);
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

function levelMap() {
  if (!player) return whoIsPlaying();
  const p = player;
  const unlocked = (n: number) => n === 1 || (p.levelStars[n - 1] ?? 0) > 0;
  const el = h(`
    <div class="screen map">
      <header class="topbar">
        <button class="icon-btn back" aria-label="Back">${ICONS.back}</button>
        <div class="title-chip">${avatar(p, 'tiny')} ${esc(p.name)}</div>
        <div class="score-box star-total">${ICONS.star}<span>${totalStars(p)}/${LEVEL_COUNT * 3}</span></div>
      </header>
      <div class="levels">
        ${Array.from({ length: LEVEL_COUNT }, (_, i) => {
          const n = i + 1;
          const open = unlocked(n);
          const stars = p.levelStars[n] ?? 0;
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
  keepFresh(levelMap, el);
  const next = [...el.querySelectorAll<HTMLElement>('.level:not(.locked):not(.done)')][0];
  next?.classList.add('next-up');
  next?.scrollIntoView({ block: 'center' });
}

// ---------- game ----------

function play(mode: Mode) {
  if (!player || !family) return whoIsPlaying();
  const p = player;
  const code = family.code;
  if (mode.kind === 'challenge') getLevel(mode.level); // warm the cache
  // What has been saved so far; each save sends only what the game added since.
  let saved: Player = JSON.parse(JSON.stringify(p));
  const view = new GameView(mode, {
    player: p,
    settings,
    persist: () => {
      const patch = diffProgress(saved, p);
      if (!patch) return;
      saved = JSON.parse(JSON.stringify(p));
      p.updatedAt = Date.now();
      store.saveProgress(code, p.id, patch).catch((e) => {
        console.warn('Could not save progress', e);
        warn('This game could not be saved. Try again in a moment.');
      });
    },
    onExit: () => (mode.kind === 'calm' ? menu() : mode.kind === 'daily' ? void dailyScreen() : levelMap()),
    onNextLevel: (n) => play({ kind: 'challenge', level: n }),
  });
  rerender = null;
  show(view.el);
  current = view;
}

void boot();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
