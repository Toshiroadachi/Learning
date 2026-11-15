// オフライン対応：アプリ本体はネットワーク優先（更新をすぐ反映）、Pyodide 等の CDN はバージョン固定なのでキャッシュ優先
const CACHE = 'codedojo-v5';
const CDN = 'codedojo-cdn-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/util.js', 'js/store.js', 'js/sim.js', 'js/py.js', 'js/py-worker.js', 'js/ai.js', 'js/live.js',
  'data/scen-codex.js', 'data/scen-codex-cli2.js', 'data/scen-claude-app.js', 'data/scen-codex-app.js', 'data/py-days-0.js', 'data/scen-advanced.js', 'data/guides.js', 'data/commands.js', 'data/reference.js', 'data/py-days-1.js', 'data/py-days-2.js', 'data/py-roadmap.js', 'data/live-projects.js',
  'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CDN).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'cdn.jsdelivr.net' && /\/(pyodide\/v[\d.]+)\//.test(url.pathname)) {
    e.respondWith(caches.open(CDN).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
