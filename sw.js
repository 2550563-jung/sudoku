const CACHE = "sudoku-v18";
const ASSETS = [
  "./", "./index.html", "./style.css?v=18", "./app.js?v=18", "./manifest.json",
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
