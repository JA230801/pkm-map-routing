const CACHE_NAME = 'gis_routingV1';
// List of files to cache immediately (The App Shell)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon/layers.png',
  './icon/locate.png',
  './icon/menu.png'
];

// 1. INSTALL EVENT: Cache the App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE EVENT: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});

// 3. FETCH EVENT: Network First, then Cache
self.addEventListener('fetch', (event) => {
  // We only handle http/https requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If network works, return response AND cache a copy (optional)
        return response;
      })
      .catch(() => {
        // If network fails (Offline), try to serve from cache
        return caches.match(event.request);
      })
  );
});