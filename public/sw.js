const CACHE_NAME = 'fnf-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Stale-while-revalidate strategy)
self.addEventListener('fetch', (e) => {
  // Skip cross-origin requests, like Supabase APIs or images from external CDNs, 
  // to avoid opaque response caching issues unless explicitly handled.
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle page navigations to always return the React shell for offline routing
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then((cachedResponse) => {
        return fetch(e.request).catch(() => cachedResponse);
      })
    );
    return;
  }

  // Asset caching
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const networkFetch = fetch(e.request).then((networkResponse) => {
        // Cache new assets dynamically
        if (networkResponse.ok && e.request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => null);

      // Return cached immediately if available, otherwise wait for network
      return cachedResponse || networkFetch;
    })
  );
});
