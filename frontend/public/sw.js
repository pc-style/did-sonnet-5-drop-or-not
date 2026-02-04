self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || "Claude Sonnet 5 is now available!",
    icon: data.icon || "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [200, 100, 200],
    tag: "sonnet5-drop",
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "https://anthropic.com",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Sonnet 5 has dropped!",
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "https://anthropic.com";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
