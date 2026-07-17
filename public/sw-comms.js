// Service worker for /comms-test push notifications.
// Registered from app/comms-test/client/[code]/page.tsx.
// Handles: incoming ring pushes, notification clicks (open/join room).

self.addEventListener("install",  (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }

  if (payload.type === "incoming_call") {
    const title = `${payload.callerName || "HOS"} is calling`;
    const options = {
      body:               "Tap to answer",
      icon:               "/icon.svg",
      badge:              "/icon.svg",
      tag:                `call-${payload.code}`,
      renotify:           true,
      requireInteraction: true,
      vibrate:            [400, 200, 400, 200, 400],
      data:               { joinUrl: payload.joinUrl, code: payload.code },
      actions: [
        { action: "accept", title: "Accept" },
        { action: "decline", title: "Decline" },
      ],
    };

    // Ping any open tabs so the in-app IncomingCallModal fires immediately,
    // in addition to the OS-level notification.
    const pingTabs = self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(list => list.forEach(client => {
        client.postMessage({
          type:       "incoming-call",
          code:       payload.code,
          callerName: payload.callerName,
          expiresAt:  payload.expiresAt,
          room:       payload.room,
        });
      }));

    event.waitUntil(Promise.all([
      self.registration.showNotification(title, options),
      pingTabs,
    ]));
    return;
  }

  if (payload.type === "message") {
    event.waitUntil(self.registration.showNotification(
      payload.senderName || "New message",
      {
        body:  payload.preview || "",
        icon:  "/icon.svg",
        badge: "/icon.svg",
        tag:   `msg-${payload.code}`,
        data:  { joinUrl: payload.joinUrl, code: payload.code },
      }
    ));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "decline") return;

  const url = event.notification.data?.joinUrl;
  if (!url) return;

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Prefer a comms-test tab, then any portal tab
    for (const client of all) {
      if (client.url.includes(`/comms-test/client/${event.notification.data.code}`)) {
        client.focus();
        client.postMessage({ type: "join-call", room: event.notification.data.code });
        return;
      }
    }
    for (const client of all) {
      if (client.url.includes("/portal/")) {
        client.focus();
        client.postMessage({ type: "join-call", room: event.notification.data.code });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
