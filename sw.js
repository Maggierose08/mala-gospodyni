// Minimal service worker: caches the app shell so it works offline and can
// be installed to a phone/desktop home screen. Bump CACHE_NAME whenever the
// cached files change, so returning visitors get the new version.
const CACHE_NAME = "mala-gospodyni-v20";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/logic.js",
  "./js/app.js",
  "./js/firebase-init.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  // Scan a Recipe (OCR) — bundled so scanning works offline after first load.
  "./js/vendor/tesseract/tesseract.min.js",
  "./js/vendor/tesseract/worker.min.js",
  "./js/vendor/tesseract/tesseract-core-simd-lstm.js",
  "./js/vendor/tesseract/tesseract-core-simd-lstm.wasm",
  "./js/vendor/tesseract/lang/eng.traineddata.gz",
];

self.addEventListener("install", (event) => {
  // cache.addAll() lets the browser reuse its own HTTP cache for each
  // request, which can silently hand us a stale copy of a file (e.g. an
  // old app.js) even under a brand-new CACHE_NAME, so returning visitors
  // never actually get the update. { cache: "reload" } forces every
  // app-shell file to be fetched fresh from the network on install.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.all(APP_SHELL.map((url) => fetch(url, { cache: "reload" }).then((response) => cache.put(url, response))))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for app-shell files, falling back to the network (and caching
// what we get) for anything else.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
