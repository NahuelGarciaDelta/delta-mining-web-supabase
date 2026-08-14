const CACHE_NAME = "delta-mining-ops-v14-offline-cache-v391";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
  "/loader.gif"
];

async function safePut(cache, request, response) {
  try {
    if (!response || !response.ok || response.status === 206) return;
    if (response.type !== "basic" && response.type !== "default") return;
    await cache.put(request, response.clone());
  } catch (error) {
    console.debug("[SW] cache omitido", error?.message || error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        await safePut(cache, "/index.html", response);
        return response;
      } catch (_) {
        return (await caches.match("/index.html")) || Response.error();
      }
    })());
    return;
  }

  const isCode = request.destination === "script" || request.destination === "style" || url.pathname.startsWith("/src/") || url.pathname.includes("/@vite/");
  if (isCode) {
    // Código siempre network-first: evita mezclar módulos de builds distintos.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: "no-store" });
        await safePut(cache, request, response);
        return response;
      } catch (_) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  // Recursos estáticos pesados: stale-while-revalidate para conservar modo offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then(async (response) => {
      await safePut(cache, request, response);
      return response;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || Response.error();
  })());
});
