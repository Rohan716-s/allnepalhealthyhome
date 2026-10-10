/* Only document shells and same-origin assets live here. Private API data is
   handled by the authenticated IndexedDB layer, never by CacheStorage. */
const VERSION = "anhh-shell-v1";
const ASSETS = "anhh-assets-v1";
const MEDIA = "anhh-public-images-v1";
const FALLBACK = "/offline.html";
async function sharedAssets() {
  const response = await fetch("/offline-assets.json", { cache: "no-store" });
  if (!response.ok) return;
  const assets = await response.json();
  const cache = await caches.open(ASSETS);
  await Promise.all(assets.filter(asset => typeof asset === "string" && asset.startsWith("/_next/static/")).map(async asset => {
    if (await cache.match(asset)) return;
    const response = await fetch(asset); if (response.ok) await cache.put(asset, response);
  }));
}
self.addEventListener("install", event => {
  event.waitUntil(Promise.all([caches.open(VERSION).then(cache => cache.addAll([FALLBACK, "/icon.svg", "/manifest.webmanifest"])), sharedAssets()]));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("anhh-") && ![VERSION, ASSETS, MEDIA].includes(key)).map(key => caches.delete(key))))]));
});
const excluded = path => /^\/(api|hubs|uploads|documents)(\/|$)/.test(path);
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // This endpoint only returns active, public media. Cache images only, without
  // authorization, range requests, videos, documents or other API responses.
  if (request.method === "GET" && url.origin === self.location.origin && /^\/api\/site\/media\/[0-9a-f-]{36}$/i.test(url.pathname) && !request.headers.has("Authorization") && !request.headers.has("Range")) {
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA);
      const cached = await cache.match(request);
      try {
        const response = await fetch(request);
        if (response.status >= 500) return cached || response;
        if (response.status === 404 || response.status === 403) await cache.delete(request);
        if (response.ok && response.headers.get("content-type")?.startsWith("image/") && response.type === "basic") {
          try {
            await cache.put(request, response.clone());
            const keys = await cache.keys();
            for (const key of keys.slice(0, Math.max(0, keys.length - 300))) await cache.delete(key);
          } catch { /* Full device storage must not hide a successfully fetched image. */ }
        }
        return response;
      } catch { return cached || Response.error(); }
    })());
    return;
  }
  if (request.method !== "GET" || url.origin !== self.location.origin || excluded(url.pathname) || request.headers.has("Authorization")) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const response = await fetch(request);
        if (response.status >= 500) return await cache.match(request) || await cache.match(FALLBACK);
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          for (const key of keys.filter(key => ![FALLBACK, "/icon.svg", "/manifest.webmanifest"].includes(new URL(key.url).pathname)).slice(0, Math.max(0, keys.length - 100))) await cache.delete(key);
        }
        return response;
      } catch {
        return await cache.match(request) || await cache.match(FALLBACK);
      }
    })());
    return;
  }
  // Never cache Next's RSC flight responses or authentication redirects.
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;
  if (!url.pathname.startsWith("/_next/static/") && !["style", "script", "font", "image"].includes(request.destination)) return;
  event.respondWith((async () => {
    const cache = await caches.open(ASSETS);
    const cached = await cache.match(request) || await caches.match(request);
    if (cached && url.pathname.startsWith("/_next/static/") && !url.pathname.includes("/development/")) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone()).catch(() => undefined);
      return response;
    } catch { return cached || Response.error(); }
  })());
});
self.addEventListener("sync", event => {
  if (event.tag !== "anhh-offline-sync") return;
  // Tokens stay in the existing foreground auth system. Browsers that support
  // Background Sync wake open clients; closed apps resume on their next start.
  event.waitUntil(self.clients.matchAll({ type: "window" }).then(clients => clients.forEach(client => client.postMessage({ type: "anhh-offline-sync" }))));
});
self.addEventListener("message", event => {
  if (event.data?.type !== "warm-shell") return;
  const url = new URL(event.data.path, self.location.origin);
  if (url.origin !== self.location.origin || excluded(url.pathname)) return;
  event.waitUntil((async () => {
    try {
      const response = await fetch(url.href, { headers: { Accept: "text/html" }, credentials: "omit" });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return;
      const html = await response.clone().text();
      await (await caches.open(VERSION)).put(url.href, response);
      const assets = [...html.matchAll(/(?:src|href)="([^" ]+)"/g)].map(match => new URL(match[1].replaceAll("&amp;", "&"), url));
      for (const resource of Array.isArray(event.data.resources) ? event.data.resources : []) {
        try { assets.push(new URL(resource)); } catch { /* Ignore invalid resource timing entries. */ }
      }
      const cache = await caches.open(ASSETS);
      await Promise.all([...new Set(assets.filter(asset => asset.origin === url.origin && asset.pathname.startsWith("/_next/static/")).map(asset => asset.href))].map(async asset => {
        if (await cache.match(asset)) return;
        const file = await fetch(asset); if (file.ok) await cache.put(asset, file);
      }));
    } catch { /* Connectivity loss leaves the last complete shell available. */ }
  })());
});
