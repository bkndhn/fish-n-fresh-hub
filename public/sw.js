// Fish N Fresh Hub — PWA Service Worker v4 (Native App Grade)
const CACHE_NAME = 'fnf-pwa-v4';
const IMAGE_CACHE_NAME = 'fnf-images-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

// Install: pre-cache static shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          fetch(url)
            .then((r) => { if (r.ok) return cache.put(url, r); })
            .catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate: purge old caches, claim all clients immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: tiered caching
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // 1. Images — cache-first, revalidate in background
  const isImage =
    e.request.destination === 'image' ||
    /\.(png|jpg|jpeg|webp|svg|gif|ico)(\?.*)?$/i.test(url) ||
    url.includes('images.unsplash.com') ||
    url.includes('/storage/v1/object/public/');

  if (isImage && e.request.method === 'GET') {
    e.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(e.request).then((hit) => {
          if (hit) {
            fetch(e.request).then((fresh) => {
              if (fresh && (fresh.ok || fresh.type === 'opaque')) cache.put(e.request, fresh);
            }).catch(() => {});
            return hit;
          }
          return fetch(e.request).then((r) => {
            if (r && (r.ok || r.type === 'opaque')) cache.put(e.request, r.clone());
            return r;
          }).catch(() => Response.error());
        })
      )
    );
    return;
  }

  // Skip cross-origin requests
  if (!url.startsWith(self.location.origin)) return;

  // 2. Page navigations — network-first with 2s timeout
  if (e.request.mode === 'navigate') {
    e.respondWith(
      Promise.race([
        fetch(e.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]).catch(() =>
        caches.match('/').then((c) => c || Response.error())
      )
    );
    return;
  }

  // 3. Static assets — stale-while-revalidate
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const network = fetch(e.request).then((r) => {
          if (r.ok) caches.open(CACHE_NAME).then((c) => c.put(e.request, r.clone()));
          return r;
        }).catch(() => hit);
        return hit || network;
      })
    );
  }
});

// Background Sync — retry failed order submissions when back online
self.addEventListener('sync', (e) => {
  if (e.tag === 'order-sync') {
    e.waitUntil(replayPendingOrders());
  }
});

async function replayPendingOrders() {
  try {
    const db = await openOrderQueue();
    const pending = await db.getAll('pending-orders');
    for (const item of pending) {
      try {
        const resp = await fetch(item.url, { method: item.method, body: item.body, headers: item.headers });
        if (resp.ok) await db.delete('pending-orders', item.id);
      } catch (_) {}
    }
  } catch (_) {}
}

function openOrderQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fnf-order-queue', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('pending-orders', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => {
      const db = req.result;
      resolve({
        getAll: (store) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readonly');
          const r = tx.objectStore(store).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = rej;
        }),
        delete: (store, id) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).delete(id);
          tx.oncomplete = res;
          tx.onerror = rej;
        }),
      });
    };
    req.onerror = reject;
  });
}

// Periodic Background Sync — refresh catalog/stock cache
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'catalog-refresh') {
    e.waitUntil(refreshCatalogCache());
  }
});

async function refreshCatalogCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await fetch('/');
    if (resp.ok) await cache.put('/', resp);
  } catch (_) {}
}

// Push Notifications
self.addEventListener('push', (e) => {
  let data = {
    title: 'Fish N Fresh Hub',
    body: 'Fresh coastal catch updates and order delivery alerts.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-maskable-192.png',
    data: { url: '/' },
  };

  if (e.data) {
    try { data = { ...data, ...e.data.json() }; }
    catch { data.body = e.data.text(); }
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-maskable-192.png',
      vibrate: [200, 100, 200],
      data: data.data || { url: '/' },
      actions: [
        { action: 'view', title: 'View Order' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// Notification Click
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const targetUrl = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse existing open window — native app behavior
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
