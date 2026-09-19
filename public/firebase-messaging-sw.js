importScripts("/firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js");
try {
  if (self.WYBLOG_FIREBASE_CONFIG?.projectId && self.WYBLOG_FIREBASE_CONFIG?.appId) {
    firebase.initializeApp(self.WYBLOG_FIREBASE_CONFIG);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification || {};
      self.registration.showNotification(n.title || "WyBlog", { body: n.body || "", icon: "/icon.svg", data: payload.data || {} });
    });
  }
} catch (e) { /* service worker remains installable; foreground setup reports the real reason */ }
self.addEventListener("notificationclick", (event) => { event.notification.close(); const url = event.notification?.data?.url || "/"; event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => { const existing = list.find(c => "focus" in c); if (existing) { existing.navigate(url); return existing.focus(); } return clients.openWindow(url); })); });
