// オフライン対応：アプリ本体はキャッシュ優先、ニュースはネットワーク優先
const CACHE = 'toeic900-v7';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/storage.js', 'js/score.js', 'js/speech.js', 'js/ai.js',
  'data/p1.js', 'data/p2.js', 'data/p3.js', 'data/p4.js', 'data/p5.js', 'data/p6.js', 'data/p7.js', 'data/vocab.js', 'data/idioms.js',
  'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('news.json')) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('data/news.json', copy)); return r; })
      .catch(() => caches.match('data/news.json')));
    return;
  }
  // ネットワーク優先（更新がすぐ反映される）。オフライン時のみキャッシュを使う
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
