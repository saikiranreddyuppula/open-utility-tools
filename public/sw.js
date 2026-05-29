/*
 * Service worker for full offline support. No server is involved — this caches
 * the static export (app shell, JS/CSS chunks, and lazy-loaded .wasm modules) so
 * every visited tool keeps working with no network. Privacy-preserving: it only
 * ever caches first-party assets the browser already fetched.
 */
const VERSION = 'v1';
const PRECACHE = `ut-precache-${VERSION}`;
const RUNTIME = `ut-runtime-${VERSION}`;

// Minimal shell precache; everything else is cached at runtime on first fetch.
const PRECACHE_URLS = ['/', '/offline/', '/manifest.webmanifest', '/favicon.svg', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PRECACHE && k !== RUNTIME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/wasm/') ||
    /\.(?:js|css|wasm|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|avif|ico|json)$/.test(
      url.pathname
    )
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cache, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match('/offline/')) || Response.error();
        })
    );
    return;
  }

  // Static assets (incl. wasm): cache-first; content-hashed so safe to keep.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            const copy = resp.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
            return resp;
          })
      )
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
