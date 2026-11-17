const CACHE_NAME = 'prosnosc-swin-v78';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=78',
  './app.js?v=78',
  './manifest.json',
  './logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// OBSŁUGA POWIADOMIEŃ PUSH W TLE (NAWET PRZY ZAMKNIĘTEJ APLIKACJI)
self.addEventListener('push', (event) => {
  let title = '🐖 GR Wenglorz - Powiadomienie!';
  let body = 'Zbliża się termin wyproszenia maciory!';
  let tag = 'pig-farrowing-alert-' + Date.now();
  let url = './index.html';

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body || data.message) body = data.body || data.message;
      if (data.tag) tag = data.tag;
      if (data.click || data.url) url = data.click || data.url;
    } catch (e) {
      body = event.data.text() || body;
    }
  }

  const options = {
    body: body,
    icon: './logo.jpg',
    badge: './logo.jpg',
    vibrate: [300, 100, 300, 100, 300],
    data: { url: url },
    tag: tag,
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// KLIKNIĘCIE W POWIADOMIENIE OTWIERA APLIKACJĘ
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
