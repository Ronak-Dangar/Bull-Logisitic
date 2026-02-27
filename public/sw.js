// ─── Push Notification Service Worker ──────────────────────────────────

self.addEventListener("push", (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: "Bull Logistic", body: event.data.text() };
    }

    const title = payload.title || "Bull Logistic";
    const options = {
        body: payload.body || "",
        icon: payload.icon || "/logo.png",
        badge: "/logo.png",
        data: { url: payload.url || "/" },
        vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = new URL(
        event.notification.data?.url || "/",
        self.location.origin
    ).href;

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((windowClients) => {
                // If app is already open in a tab, focus it
                for (const client of windowClients) {
                    if (client.url === targetUrl && "focus" in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new window/tab
                return clients.openWindow(targetUrl);
            })
    );
});

// ─── Offline Caching Service Worker ──────────────────────────────────
const CACHE_NAME = "bull-logistic-cache-v2";
const OFFLINE_URL = "/";

const ASSETS_TO_CACHE = [
    "/",
    "/manifest.json"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    // Only handle GET requests
    if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
        return;
    }

    // Network-first strategy for HTML navigations
    if (event.request.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    // Try to fetch from the network first
                    const networkResponse = await fetch(event.request);
                    return networkResponse;
                } catch (error) {
                    // If network fails, return the offline fallback page
                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match(OFFLINE_URL);
                    return cachedResponse || new Response("Offline Mode", { status: 503 });
                }
            })()
        );
        return;
    }

    // Cache-first strategy for static assets (images, CSS, JS)
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }
            try {
                const networkResponse = await fetch(event.request);
                // Optionally cache fetched assets here
                return networkResponse;
            } catch (error) {
                return new Response("Asset offline", { status: 503 });
            }
        })()
    );
});
