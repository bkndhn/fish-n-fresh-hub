// Firebase Cloud Messaging & Web Push Service Worker
// Fish N Fresh Hub Enterprise PWA Notification Engine

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// When FCM config is provided in localStorage / query params, initialize:
self.addEventListener("push", (event) => {
  let data = {
    title: "Fish N Fresh Hub",
    body: "Fresh seafood update from Kasimedu Harbour!",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: "/" },
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      if (payload.notification) {
        data.title = payload.notification.title || data.title;
        data.body = payload.notification.body || data.body;
        data.icon = payload.notification.icon || data.icon;
      }
      if (payload.data) {
        data.data = payload.data;
        if (payload.data.url) {
          data.data.url = payload.data.url;
        }
      }
    }
  } catch (e) {
    // Text fallback
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    data: data.data,
    actions: [
      { action: "open", title: "View Details" },
      { action: "dismiss", title: "Close" }
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
