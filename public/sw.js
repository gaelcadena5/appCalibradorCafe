const CACHE_NAME = 'brewflow-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css',
  './index.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Pre-cacheando assets estáticos...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Borrando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Cache First with network fallback & dynamic caching)
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests (bypass chrome extensions, etc.)
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('https://fonts.')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version
        return cachedResponse;
      }

      // Fetch from network and cache dynamically
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic' && !event.request.url.startsWith('https://fonts.')) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Silently catch fetch errors (usually when offline and resource not cached)
      });
    })
  );
});
