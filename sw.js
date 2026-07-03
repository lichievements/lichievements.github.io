// Lichievements service worker — app-shell caching for offline / installable PWA.
// Bump CACHE when shipping asset changes to invalidate old caches.
const CACHE = 'lichievements-v1';

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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never touch cross-origin requests (Lichess API / OAuth must hit the network).
  if (url.origin !== location.origin) return;

  // HTML navigations: network-first so deploys are picked up, cache as offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin assets: cache-first, then network (and cache the result).
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});
