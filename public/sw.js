/* MacroVerse service worker (see docs/platform-and-integrations.md): PWA installability + an offline
 * shell for previously-loaded content. Strategy:
 *  - navigations: network-first, falling back to the cached copy of that page
 *  - static assets (/_next/static, icons): cache-first (immutable, hashed URLs)
 *  - everything else (server actions, API, cross-origin tiles): network only
 * Deliberately NOT cached: OSM tiles (usage policy), POST/action requests. */
const VERSION = "mm-v1";
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (map tiles, Nominatim)

  // hashed static assets: cache-first
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // page navigations: network-first with cached fallback = offline shell
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(PAGE_CACHE).then(async (cache) => {
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          const hit = await cache.match(request, { ignoreSearch: true });
          return (
            hit ??
            new Response(
              "<html><body style='font-family:sans-serif;background:#0a0e0d;color:#e7ece9;display:grid;place-items:center;height:100vh;margin:0'><div style='text-align:center'><h1>You're offline</h1><p>Pages you've visited before still work — this one hasn't been loaded yet.</p></div></body></html>",
              { status: 503, headers: { "Content-Type": "text/html" } },
            )
          );
        }
      }),
    );
  }
});
