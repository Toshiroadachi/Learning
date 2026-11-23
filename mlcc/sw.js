// オフライン対応：アプリ本体はネットワーク優先（更新をすぐ反映）、オフライン時はキャッシュ
const CACHE = 'mlccdojo-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg', 'data/mat-lessons.js','data/meas-lessons.js','data/mkt-lessons.js','data/proc-lessons.js','data/rel-lessons.js','data/terms.js','js/ai.js','js/app.js','js/store.js','js/tools.js','js/util.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('mlccdojo')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
