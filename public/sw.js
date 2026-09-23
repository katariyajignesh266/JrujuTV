/**
 * JaruJu TV — Service Worker (App Shell Cache)
 * JruJu TV — Service Worker (App Shell Cache)
 * Phase 1: Cache the UI shell for offline load. No dynamic data caching.
 *
 * Strategy:
 *   - Cache-First for static shell assets (/_next/static/, /icons/, fonts)
 *   - Network-First for navigation requests, with shell cache fallback
 *   - Network-Only for all other requests (API, media, external images)
 *
 * To trigger a cache refresh on next deploy: bump CACHE_VERSION below.
 */

const CACHE_VERSION = 'jruju-shell-v1';

/**
 * App shell resources pre-cached on SW install.
 * Next.js hashed chunks are handled at runtime via URL pattern matching,
 * so we only list the stable, non-hashed URLs here.
 */
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Pre-cache stable shell URLs; ignore individual failures to stay resilient
      return Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)));
    })
  );
  // Take control immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      )
    )
  );
  // Claim all open clients so the new SW takes effect without a page refresh
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin and Google Fonts requests
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFonts) {
    // External domains (YouTube thumbnails, CDNs) — always Network-Only
    return;
  }

  // ── A. Static Next.js build chunks → Cache-First ─────────────────────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── B. Icons, manifest, favicon → Cache-First ────────────────────────────
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // ── C. Google Fonts → Cache-First ────────────────────────────────────────
  if (isGoogleFonts) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── D. Navigation requests (HTML) → Network-First, shell fallback ─────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses for future offline use
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve the cached page, or the root shell as fallback
          return (
            caches.match(request) ||
            caches.match('/') ||
            new Response(offlineFallbackHTML(), {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        })
    );
    return;
  }

  // ── E. Everything else → Network-Only (API, media, etc.) ─────────────────
  // No caching for dynamic data in Phase 1.
});

/**
 * Minimal branded offline fallback HTML rendered when:
 * - The user navigates while offline
 * - No cached shell page is available
 */
function offlineFallbackHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>JaruJu TV — Offline</title>
  <title>JruJu TV — Offline</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-family: system-ui, sans-serif; background: #FFFFFF; color: #0F0F0F; }
    @media (prefers-color-scheme: dark) {
      html { background: #0F0F0F; color: #F1F1F1; }
    }
    body {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px;
      text-align: center;
    }
    .icon {
      width: 72px;
      height: 72px;
    }
    h1 { font-size: 1.5rem; font-weight: 700; }
    p  { font-size: 0.9rem; opacity: 0.65; max-width: 300px; }
    button {
      margin-top: 8px;
      padding: 10px 24px;
      border: none;
      border-radius: 12px;
      background: #E53935;
      color: #fff;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <svg class="icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#E53935"/>
    <polygon points="14,10 32,20 14,30" fill="white" opacity="0.95"/>
    <circle cx="11" cy="30" r="4" fill="#FF8F00"/>
  </svg>
  <h1>You&rsquo;re offline</h1>
  <p>Check your connection and try again. JaruJu TV will be back once you&rsquo;re online.</p>
  <p>Check your connection and try again. JruJu TV will be back once you&rsquo;re online.</p>
  <button onclick="location.reload()">Try again</button>
</body>
</html>`;
}

