// App shell: red primero y caché de respaldo. Al cambiar CUALQUIER archivo de ASSETS hay que
// subir CACHE_NAME: si no, las instalaciones existentes siguen viendo la versión vieja.
const CACHE_NAME = 'bona-planos-v32';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './src/main.js', './src/state.js', './src/canvas.js', './src/tools.js', './src/ui.js',
  './src/storage.js', './src/i18n.js', './src/symbols.js', './src/home.js', './src/export.js', './src/version.js', './src/dialogs.js', './src/settings.js', './src/sync.js', './src/sync-ui.js', './src/geom.js', './config.js', './vendor/supabase.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  // cache:'reload' salta la caché HTTP (GitHub Pages cachea ~10 min): sin esto se guardaban archivos viejos.
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.all(ASSETS.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (revalidando), con la caché como respaldo sin conexión: así siempre se ve la última versión.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
