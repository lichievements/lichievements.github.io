// Lichievements service worker.
//
// APP_VERSION is the "increment": bump it on a deploy to invalidate the offline
// cache and force a clean install. In practice you rarely need to — the app code
// (HTML / JS / CSS / manifest) is served **network-first**, so every online launch
// already loads the latest files. That's what makes updates reach iOS PWAs, which
// cannot be manually refreshed. Fonts and images stay cache-first for speed.
const APP_VERSION = '2';
const CACHE = 'lichievements-v' + APP_VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/fonts.css',
  './js/main.js',
  './js/achievements.js',
  './js/worker.js',
  './js/oauth.js',
  './js/chess.js',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './images/locked.png',
  './fonts/Inter-4.1/web/InterVariable.woff2',
  './fonts/Inter-4.1/web/InterVariable-Italic.woff2',
  './fonts/JetBrainsMono-2.304/fonts/webfonts/JetBrainsMono-Regular.woff2',
  './fonts/JetBrainsMono-2.304/fonts/webfonts/JetBrainsMono-Medium.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App code that changes on deploy → always try the network first.
const isCode = (url) => url.pathname === '/' || /\.(html|js|css|webmanifest)$/.test(url.pathname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // Lichess API / OAuth must hit the network
  if (url.pathname.endsWith('/sw.js')) return;  // never intercept the worker script itself

  // HTML + app code: network-first (fresh every online launch), cache as offline fallback.
  if (req.mode === 'navigate' || isCode(url)) {
    const key = req.mode === 'navigate' ? './index.html' : req;
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {}); return res; })
        .catch(() => caches.match(key))
    );
    return;
  }

  // Fonts / images: cache-first with background refresh.
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); return res; })
        .catch(() => hit);
      return hit || network;
    })
  );
});
