/* Service Worker für Bestattungshaus Kallwaß Beratungsapp
 * v1.0.1 – Fix für Firebase Storage Bilder (CORS / opaque responses)
 *
 * Strategie:
 *  - App Shell (HTML, Manifest): Stale-While-Revalidate (instant Load + Hintergrund-Update)
 *  - Firebase JS SDKs (gstatic CDN): Cache-first
 *  - Google Fonts: Cache-first
 *  - Firebase Storage Bilder: Cache-first MIT no-cors fetch (für iOS Safari)
 *  - Firestore/Auth API-Calls: NICHT cachen (Firebase macht eigene Persistence)
 */

const VERSION = 'v1.0.1';
const CACHE_STATIC = 'bk-static-' + VERSION;
const CACHE_FIREBASE = 'bk-firebase-' + VERSION;
const CACHE_FONTS = 'bk-fonts-' + VERSION;
const CACHE_IMAGES = 'bk-images-' + VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

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

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1. Firestore / Firebase Auth – NIEMALS cachen
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  // 2. Firebase Storage Bilder – Cache-first mit no-cors fetch
  if (url.hostname.includes('firebasestorage.googleapis.com') ||
      url.hostname.includes('firebasestorage.app')) {
    event.respondWith(cacheFirstImage(req, CACHE_IMAGES));
    return;
  }

  // 3. Google Fonts – Cache-first
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

  // 5. Eigene App – Stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
    return;
  }
});

/**
 * Spezial-Strategie für Firebase Storage Bilder:
 * - Erst aus Cache versuchen
 * - Wenn nicht da: mit no-cors holen
 * - opaque responses (status 0) werden trotzdem gecached
 */
async function cacheFirstImage(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    // no-cors: für iOS Safari mit Firebase Storage Bildern
    const fetchReq = new Request(req.url, {
      mode: 'no-cors',
      credentials: 'omit',
      cache: 'default'
    });
    const res = await fetch(fetchReq);

    if (res && (res.status === 200 || res.type === 'opaque' || res.type === 'opaqueredirect')) {
      cache.put(req, res.clone()).catch(e => console.log('Cache put failed:', e));
    }
    return res;
  } catch (e) {
    return new Response('', { status: 503, statusText: 'Offline – Bild nicht im Cache' });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.status === 200 || res.type === 'opaque')) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Stale-While-Revalidate: Liefert sofort Cache, updatet im Hintergrund.
 */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then(res => {
    if (res && res.status === 200) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
