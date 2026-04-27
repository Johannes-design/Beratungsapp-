/* Service Worker für Bestattungshaus Kallwaß Beratungsapp
 * Strategie:
 *  - App Shell (HTML, Manifest): Network-first mit Cache-Fallback (damit Updates ankommen)
 *  - Firebase JS SDKs (gstatic CDN): Cache-first (immutable)
 *  - Google Fonts: Cache-first
 *  - Firebase Storage Bilder: Cache-first (das Wichtigste – läuft offline)
 *  - Firestore/Auth API-Calls: NICHT cachen (Firebase macht eigene Persistence)
 */

const VERSION = 'v1.0.0';
const CACHE_STATIC = 'bk-static-' + VERSION;
const CACHE_FIREBASE = 'bk-firebase-' + VERSION;
const CACHE_FONTS = 'bk-fonts-' + VERSION;
const CACHE_IMAGES = 'bk-images-' + VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// === INSTALL ===
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// === ACTIVATE === (alte Caches aufräumen)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('bk-') && !k.endsWith(VERSION))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// === FETCH ===
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1. Firestore / Firebase Auth – NIEMALS cachen
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('firebaseinstallations.googleapis.com')) {
    return; // Browser handhabt normal
  }

  // 2. Firebase Storage Bilder – Cache-first (das Wichtigste fürs Offline-Erlebnis)
  if (url.hostname.includes('firebasestorage.googleapis.com') ||
      url.hostname.includes('firebasestorage.app')) {
    event.respondWith(cacheFirst(req, CACHE_IMAGES));
    return;
  }

  // 3. Google Fonts CSS und Files – Cache-first
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(req, CACHE_FONTS));
    return;
  }

  // 4. Firebase SDKs vom CDN – Cache-first
  if (url.hostname.includes('gstatic.com') && url.pathname.includes('/firebasejs/')) {
    event.respondWith(cacheFirst(req, CACHE_FIREBASE));
    return;
  }

  // 5. Eigene App (HTML, JS, manifest) – Network-first mit Cache-Fallback
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, CACHE_STATIC));
    return;
  }

  // Alles andere normal
});

// === STRATEGIES ===

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      // Bei opaque responses (CORS) nur cachen wenn wir mussten
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    // Wenn offline und nicht im Cache: gracefully fail
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Fallback: index.html aus Cache (für Navigation)
    if (req.mode === 'navigate') {
      const idx = await cache.match('./index.html');
      if (idx) return idx;
    }
    return new Response('Offline', { status: 503 });
  }
}

// === MESSAGE Handler (für manuelle Cache-Updates aus der App) ===
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
