// Назва кешу та файли, які потрібно закешувати "наперед"
const CACHE_NAME = 'skincare-app-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/js/main.js',
  '/js/db.js',
  '/icons/icon-192.png', // Додано
  '/icons/icon-512.png'  // Додано
  // Шляхи до іконок ми додамо пізніше, коли вони будуть готові
];

// 1. Встановлення Service Worker'а
self.addEventListener('install', event => {
  // Відкладаємо завершення встановлення, доки кеш не буде заповнений
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кеш відкрито');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Активація Service Worker'а
// Цей етап потрібен для очищення старого кешу, якщо він є
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
    })
  );
});

// 3. Перехоплення запитів (Fetch)
self.addEventListener('fetch', event => {
  event.respondWith(
    // Спочатку шукаємо ресурс у кеші
    caches.match(event.request)
      .then(response => {
        // Якщо ресурс знайдено в кеші, повертаємо його
        if (response) {
          return response;
        }
        // Якщо ні, робимо реальний запит до мережі
        return fetch(event.request);
      })
  );
});