// Fish N Fresh Unified PWA Service Worker
const CACHE_NAME = 'fnf-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

// Install Event: Safe caching using Promise.allSettled so no single 404 aborts SW installation
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          fetch(url)
            .then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate Event: Clear obsolete cache versions and claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Meets Chrome PWA installability requirements
self.addEventListener('fetch', (e) => {
  // Skip cross-origin requests, like Supabase APIs or images from external CDNs
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle page navigations: try network first, fallback to cached root shell
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => {
        return caches.match('/').then((cached) => cached || Response.error());
      })
    );
    return;
  }

  // Static assets: Stale-while-revalidate strategy for GET requests
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        const networkFetch = fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});

// Web Push Notification Event Handling
self.addEventListener('push', (event) => {
  let data = {
    title: 'Fish N Fresh Hub',
    body: 'Fresh coastal catch updates and order delivery alerts.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data || { url: '/' },
    })
  );
});

// Notification Click Event Handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
