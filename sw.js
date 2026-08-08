const CACHE = "sudoku-v26";
const ASSETS = [
  "./", "./index.html", "./style.css?v=24", "./sudoku-mastery-v24.css?v=25", "./sudoku-core.js?v=23", "./sudoku-entry-v26.js?v=26", "./app.js?v=23", "./sudoku-extreme-v23.js?v=24", "./sudoku-mastery-v24.js?v=26", "./room-qr.js?v=23", "./manifest.json",
  "./vendor/qrcode-generator-1.4.4.min.js?v=23", "./vendor/jsqr-1.4.0.js?v=23",
  "./favicon.ico", "./favicon-16.png", "./favicon-32.png", "./apple-touch-icon.png",
  "./icon-48.png", "./icon-48.png?v=12", "./icon-72.png", "./icon-96.png", "./icon-192.png", "./icon-512.png",
  "./icon-maskable-192.png", "./icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");

  if (isNavigation) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put("./index.html", response.clone()));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
    )
  );
});
