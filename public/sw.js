// Fish N Fresh Unified PWA Service Worker
const CACHE_NAME = 'fnf-pwa-v3';
const IMAGE_CACHE_NAME = 'fnf-images-v1';
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
          .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Meets Chrome PWA installability requirements & delivers 0ms instant loading
self.addEventListener('fetch', (e) => {
  // 1. High-speed Cache-First Image Strategy (Catalog images, Unsplash CDN, Supabase Storage)
  const isImage =
    e.request.destination === 'image' ||
    /\.(png|jpg|jpeg|webp|svg|gif|ico)(\?.*)?$/i.test(e.request.url) ||
    e.request.url.includes('images.unsplash.com') ||
    e.request.url.includes('/storage/v1/object/public/');

  if (isImage && e.request.method === 'GET') {
    e.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Revalidate in background if online
            fetch(e.request)
              .then((fresh) => {
                if (fresh && (fresh.ok || fresh.type === 'opaque')) {
                  cache.put(e.request, fresh);
                }
              })
              .catch(() => {});
            return cachedResponse;
          }
          return fetch(e.request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
                cache.put(e.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse || Response.error());
        });
      })
    );
    return;
  }

  // Skip other non-origin requests (e.g. Supabase REST writes/auth)
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // 2. Handle page navigations: try network with quick 1.2s timeout, fallback to cached root shell
  if (e.request.mode === 'navigate') {
    e.respondWith(
      Promise.race([
        fetch(e.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 1200)),
      ]).catch(() => {
        return caches.match('/').then((cached) => cached || Response.error());
      })
    );
    return;
  }

  // 3. Static assets: Stale-while-revalidate strategy for instant 0ms local response
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
