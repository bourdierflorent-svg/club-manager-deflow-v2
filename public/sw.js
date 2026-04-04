// ============================================
// SERVICE WORKER - Deflower PWA
// Gestion du cache iOS standalone + mises à jour
// ============================================

const CACHE_NAME = 'deflower-v1';
const ASSETS_CACHE = 'deflower-assets-v1';

// ============================================
// INSTALLATION - skipWaiting pour activation immédiate
// ============================================
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ============================================
// ACTIVATION - Nettoyage anciens caches + claim
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== ASSETS_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================
// FETCH - Stratégies de cache
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ignorer les requêtes externes (Firebase, API, etc.)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Ne pas cacher sw.js et version.json
  if (url.pathname === '/sw.js' || url.pathname === '/version.json') return;

  // Assets Vite hashés → Cache First (immutables)
  if (url.pathname.startsWith('/assets/') && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // HTML (navigation) → Network First avec fallback cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }
});

// ============================================
// MESSAGES - Communication avec le client
// ============================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    }).catch(() => {});
  }
});
