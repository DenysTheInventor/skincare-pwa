const CACHE_NAME = 'skincare-app-cache-v4'; // Не забувайте змінювати версію при змінах
const urlsToCache = [
  '/', '/index.html', '/style.css',
  '/js/main.js', '/js/db.js',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/screenshots/screenshot1.png'
];

// 1. Встановлення
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // <-- ВАЖЛИВА ЗМІНА
  );
});

// 2. Активація
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // <-- ВАЖЛИВА ЗМІНА
  );
});

// 3. Перехоплення запитів (без змін)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});