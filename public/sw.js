const CACHE = "atlasverify-public-shell-v1";
const PUBLIC_ASSETS = [
  "/manifest.json",
  "/icons/favicon-32.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const isPublicAsset =
    url.pathname === "/manifest.json" ||
    url.pathname === "/offline.html" ||
    url.pathname.startsWith("/icons/");
  if (!isPublicAsset) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
