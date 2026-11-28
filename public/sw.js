// GroupBox offline support.
//
// - Pages come from the network first, so a new version shows up as soon as it is deployed.
//   The saved copy is only used when the network doesn't answer (offline, or very slow).
// - The game's built files have the build's hash in their names and never change, so they are
//   saved for offline play and reused. Each build gets its own cache; older ones are deleted.
// - Google Fonts are saved for offline play.
// - Everything else (Firebase sign-in and database traffic) is left alone.
//
// The build fills in BUILD_ID and PRECACHE (see vite.config.ts).
const BUILD_ID = '__BUILD_ID__';
const PRECACHE = __PRECACHE__;
const CACHE = `groupbox-${BUILD_ID}`;
// The first version of this file kept serving saved pages; pages it served may be out of date.
const LEGACY_CACHE = 'groupbox-v1';
const PAGE = './';
const NETWORK_WAIT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 'reload' skips the browser's HTTP cache, so this saves the files of this exact build.
      .then((cache) => cache.addAll([PAGE, ...PRECACHE].map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const activated = (async () => {
    const keys = await caches.keys();
    const fromLegacy = keys.includes(LEGACY_CACHE);
    await Promise.all(keys.filter((k) => k.startsWith('groupbox-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    return fromLegacy;
  })();
  event.waitUntil(activated);
  // Open pages were probably served from the old saved copy: load them again, fresh.
  // This must not hold up activation: the reloaded pages need this worker to be active.
  activated.then(async (fromLegacy) => {
    if (!fromLegacy) return;
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const w of windows) {
      try {
        w.navigate(w.url).catch(() => {});
      } catch {
        /* not supported here: the page updates the next time it is opened */
      }
    }
  });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(page(req));
  } else if (url.origin === self.location.origin) {
    event.respondWith(ownFile(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(font(req));
  }
  // Anything else goes straight to the network, untouched.
});

const isHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');

async function page(req) {
  const cache = await caches.open(CACHE);
  const saved = cache.match(PAGE);
  // 'no-cache' asks the server whether the page changed instead of trusting the HTTP cache.
  const network = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res.ok && !res.redirected && isHtml(res)) cache.put(PAGE, res.clone()).catch(() => {});
    return res;
  });
  network.catch(() => {}); // a failure is handled below; don't report it twice
  let timer;
  const slow = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('slow')), NETWORK_WAIT_MS);
  });
  try {
    const res = await Promise.race([network, slow]);
    if (res.redirected) return Response.redirect(res.url, 302);
    if (res.ok || !(await saved)) return res;
    return await saved; // the server had a problem: play the saved version
  } catch {
    // Offline or slow: use the saved page, or keep waiting for the network if there is none.
    return (await saved) || network;
  } finally {
    clearTimeout(timer);
  }
}

async function ownFile(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Built files (assets/…) never change under the same name, so they can be kept.
  if (res.ok && new URL(req.url).pathname.includes('/assets/')) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function font(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}
