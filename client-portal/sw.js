/* Geeslane portal shell. Live data, OTP, and Paystack still need the network. */
const CACHE = "geeslane-portal-v4";
const SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./request.html",
  "./track.html",
  "./styles.css",
  "./admin.css",
  "./config.js",
  "./mail.js",
  "./api.js",
  "./ui.js",
  "./app.js",
  "./admin.js",
  "./agreement.js",
  "./docs.js",
  "./receipt.js",
  "./invoice.js",
  "./request.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "../images/logo.png",
  "../favicon.ico"
];

const BYPASS = /supabase\.co|paystack|termii|resend\.com|web3forms|googleapis|gstatic|jsdelivr|cloudflare/i;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.endsWith("/.env")) return;
  if (BYPASS.test(url.hostname)) return;

  const sameOrigin = url.origin === self.location.origin;
  const isHtml = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");

  event.respondWith((async () => {
    if (isHtml) {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match("./index.html")) || Response.error();
      }
    }

    const cached = await caches.match(request);
    const network = fetch(request).then((response) => {
      if (response.ok && (sameOrigin || url.pathname.endsWith(".png") || url.pathname.endsWith(".ico"))) {
        caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    }).catch(() => undefined);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const fresh = await network;
    return fresh || Response.error();
  })());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data?.text() || "" }; }
  const title = String(data.title || "Geeslane");
  const options = {
    body: String(data.body || "You have a new portal update."),
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: { url: String(data.url || "./") }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = String(event.notification.data?.url || "./");
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.includes("/client-portal/"));
    if (existing) {
      if (existing.navigate) await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
