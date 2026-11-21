// オフライン対応：アプリ本体はネットワーク優先（更新をすぐ反映）、オフライン時はキャッシュ
const CACHE = 'powerdojo-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg', 'data/apps-lessons.js','data/apps-screens.js','data/bi-lessons.js','data/model.js','data/pc-tasks.js','data/pq-lessons.js','data/pq-sources.js','data/reference.js','js/ai.js','js/app.js','js/dax.js','js/daxgrade.js','js/daxui.js','js/editor.js','js/fx.js','js/fxgrade.js','js/fxui.js','js/mlang.js','js/pqui.js','js/store.js','js/util.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('powerdojo')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
