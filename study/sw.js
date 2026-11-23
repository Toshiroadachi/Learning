// オフライン対応：アプリ本体はネットワーク優先（更新をすぐ反映）、オフライン時はキャッシュ。数式表示用の KaTeX もキャッシュ
const CACHE = 'rikalab-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg', 'data/units.js', 'data/content.js', 'js/ai.js', 'js/app.js', 'js/mathx.js', 'js/store.js', 'js/util.js'];
const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('rikalab')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.href.startsWith(KATEX)) {   // バージョン固定なのでキャッシュ優先
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
