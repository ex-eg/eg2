/* elgoharyX — service worker (network-first with offline fallback).
   Network-first avoids serving stale pages after updates; falls back to cache
   (and finally the home page) when offline. */
const CACHE = 'elgoharyx-v1';
const CORE = ['/', '/index.html', '/assets/styles.css', '/assets/app.js', '/explore.html'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // never intercept Firebase / cross-origin API traffic
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match('/index.html')))
  );
});
