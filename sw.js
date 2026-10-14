/**
 * PROCORE MATERIALS HUB - SERVICE WORKER (OFFLINE PWA CACHE)
 * Permite que la app de campo funcione sin cobertura en sótanos y zonas remotas de obra.
 */

const CACHE_NAME = 'procore-materials-hub-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// Instalación: Precargar shell de la aplicación
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Precargando activos estáticos para uso offline en obra...');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[Service Worker] Advertencia al precargar algún recurso externo:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación: Limpiar cachés antiguas si las hubiera
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de Fetch: Network-First para APIs, Cache-First para estáticos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Las llamadas a /api/ o endpoints dinámicos van siempre a la red
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/health')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({
          error: 'Sin conexión a internet (modo offline)',
          offline: true
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Para archivos estáticos: Stale-While-Revalidate o Cache-First
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Devolver caché e intentar actualizar en segundo plano
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
