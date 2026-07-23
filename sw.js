/* Operate service worker — app-shell offline cache */
const VERSION = 'operate-v31';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/config.js',
  './js/supabase.js',
  './js/tour-logistics-catalog.js',
  './js/state.js',
  './js/db.js',
  './js/sync.js',
  './js/auth.js',
  './js/shows.js',
  './js/trip.js',
  './js/calendar.js',
  './js/ideas.js',
  './js/notes.js',
  './js/app.js',
  './js/pwa.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Tapping a reminder notification focuses (or opens) the app and jumps to the show.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const showId = e.notification.data && e.notification.data.showId;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cl) => {
      for (const c of cl) {
        if ('focus' in c) { c.focus(); if (showId && c.postMessage) c.postMessage({ type: 'reminder-open', showId }); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept cross-origin requests (Supabase images/API, maps, etc.).
  // Letting those fail inside respondWith breaks <img> and background-image loads.
  if (url.origin !== self.location.origin) return;

  // Network-first for the HTML document so updates land; fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Network-first for CSS/JS so deploys aren't stuck behind a stale shell cache.
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for same-origin static assets (icons, manifest).
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
