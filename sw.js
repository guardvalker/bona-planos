// Cache-first de la app shell. Al cambiar CUALQUIER archivo de ASSETS hay que
// subir CACHE_NAME: si no, las instalaciones existentes siguen viendo la versión vieja.
const CACHE_NAME = 'bona-planos-v11';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './src/main.js', './src/state.js', './src/canvas.js', './src/tools.js', './src/ui.js',
  './src/storage.js', './src/i18n.js', './src/symbols.js', './src/home.js', './src/export.js', './src/version.js', './src/dialogs.js', './src/sync.js', './src/sync-ui.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
