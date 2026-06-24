const SHELL_CACHE = "foxledger-shell-v1";
const STATIC_CACHE = "foxledger-static-v1";
const ALLOWED_CACHES = new Set([SHELL_CACHE, STATIC_CACHE]);

const SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192",
  "/icons/icon-512",
  "/icons/apple-touch-icon",
];

function isSupabaseRequest(url) {
  return url.hostname.endsWith(".supabase.co") || url.hostname.includes(".supabase.co");
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isShellAsset(url) {
  return url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    cache.put(request, response.clone());
  }

  return response;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put("/", response.clone());
    }

    return response;
  } catch {
    const cachedApp = await cache.match("/");

    if (cachedApp) {
      return cachedApp;
    }

    const offlinePage = await cache.match("/offline.html");

    if (offlinePage) {
      return offlinePage;
    }

    return new Response("FoxLedger is offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !ALLOWED_CACHES.has(cacheName))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  if (isApiRequest(url) || isSupabaseRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  event.respondWith(fetch(request));
});
