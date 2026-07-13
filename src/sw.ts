/// <reference lib="webworker" />
// Service worker — dua lapis cache, sesuai keputusan terkunci "offline-first,
// precache manifest-driven ber-versi (bukan pola cache-semua)":
//
//   1. App shell (JS/CSS/HTML/WASM ber-hash) → workbox precache.
//      Daftarnya (self.__WB_MANIFEST) disuntik vite-plugin-pwa saat build,
//      otomatis ter-versi lewat hash nama file.
//   2. Konten hymn (hymns/**) → cache kita sendiri, digerakkan oleh
//      hymns/manifest.json ber-versi. Pola ini yang nanti berevolusi jadi
//      selective download saat lagu berjumlah ratusan.

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const HYMN_CACHE_PREFIX = 'hymn-content-v';

/** Resolve path relatif terhadap scope SW — benar di GitHub Pages project site. */
function scopeUrl(path: string): string {
  return new URL(path, self.registration.scope).href;
}

interface HymnsManifestLite {
  content_version: number;
  hymns: { id: string; files: string[] }[];
}

async function precacheHymnContent(): Promise<void> {
  const res = await fetch(scopeUrl('hymns/manifest.json'), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  const forCache = res.clone();
  const manifest = (await res.json()) as HymnsManifestLite;

  const cacheName = `${HYMN_CACHE_PREFIX}${manifest.content_version}`;
  const cache = await caches.open(cacheName);
  await cache.put(scopeUrl('hymns/manifest.json'), forCache);

  const urls: string[] = [];
  for (const hymn of manifest.hymns) {
    for (const file of hymn.files) {
      urls.push(scopeUrl(`hymns/${hymn.id}/${file}`));
    }
  }
  await cache.addAll(urls);

  // Versi konten lama dibuang setelah versi baru komplit (bukan sebelumnya —
  // kalau addAll gagal di tengah, cache lama masih utuh sebagai fallback).
  for (const name of await caches.keys()) {
    if (name.startsWith(HYMN_CACHE_PREFIX) && name !== cacheName) {
      await caches.delete(name);
    }
  }
}

self.addEventListener('install', (event) => {
  // Gagal precache konten (mis. install saat offline) TIDAK menggagalkan
  // install SW — app shell tetap jalan, konten menyusul via cache on-demand.
  event.waitUntil(
    precacheHymnContent().catch((err) => {
      console.warn('[sw] precache konten hymn gagal, lanjut tanpa:', err);
    }),
  );
});

async function activeHymnCache(): Promise<Cache> {
  const names = await caches.keys();
  const existing = names.find((n) => n.startsWith(HYMN_CACHE_PREFIX));
  return caches.open(existing ?? `${HYMN_CACHE_PREFIX}0`);
}

/** Konten hymn: cache dulu (kebutuhan live ibadah), jaringan sebagai fallback. */
async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await activeHymnCache();
    await cache.put(request, res.clone());
  }
  return res;
}

/** manifest.json: jaringan dulu (deteksi konten baru), cache sebagai fallback offline. */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await activeHymnCache();
      await cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (!url.startsWith(scopeUrl('hymns/'))) return;

  const isManifest = url === scopeUrl('hymns/manifest.json');
  event.respondWith(isManifest ? networkFirst(event.request) : cacheFirst(event.request));
});
