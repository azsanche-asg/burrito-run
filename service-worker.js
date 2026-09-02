const CACHE_NAME = "burrito-run-v9";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./manifest.webmanifest",
  "./assets/burrito-run-icon.svg",
  "./assets/sprites/burrito-donkey-atlas.png",
  "./assets/sprites/desert-hazards-atlas.png",
  "./assets/sprites/story-rewards-atlas.png",
  "./assets/sprites/paisano-sleeping.png",
  "./assets/sprites/paisano-sombrero.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            new URL(event.request.url).origin === self.location.origin
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          throw new Error("Offline asset unavailable");
        });
    }),
  );
});
