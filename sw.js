const VERSION = 'hq-v2';
const SHELL = ['./', 'index.html', 'style.css', 'core.js', 'questions.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// stale-while-revalidate for same-origin GET
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Hematology quiz', {
    body: d.body || 'Time for a question',
    icon: 'icon-192.png', badge: 'badge-96.png',
    tag: 'hq', renotify: true, data: { id: d.id }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); if (id) c.postMessage({ type: 'open-q', id }); return; }
    }
    await clients.openWindow(self.registration.scope + (id ? '?q=' + encodeURIComponent(id) : ''));
  })());
});
