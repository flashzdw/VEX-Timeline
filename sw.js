// Bump CACHE_NAME version whenever JS/CSS changes are deployed.
// This forces the new service worker to skip the old cache and refetch everything.
// v20: 登录页改用 position: fixed + inset-0 彻底锁死，绕过 iOS 橡皮筋与 body 滚动
const CACHE_NAME = 'vex-timeline-cache-v20';

// Only cache the static shell — NEVER cache JS files (auth.js, app.js, config.js, etc.)
// because they change with each deploy and JS bugs in cached files can break the app.
const urlsToCache = [
  '/',
  '/index.html',
  '/src/css/styles.css',
  '/public/icons/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  // Take over immediately so users get the new SW on next page load
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.warn('[SW] Pre-cache failed (non-fatal):', err))
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // CRITICAL: For JS files (and config.js, supabase.js, etc.) and HTML files,
  // ALWAYS go to network first, fall back to cache. This ensures users get
  // the latest code after each deploy. Old code with bugs can otherwise
  // persist indefinitely in the SW cache.
  const isJsOrHtml = /\.(js|html)(\?|$)/.test(url.pathname) || url.pathname === '/' || url.pathname === '/index.html';

  if (isJsOrHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update the cache with the fresh response
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, fall back to cache (offline support)
          return caches.match(event.request);
        })
    );
    return;
  }

  // For other static assets (CSS, icons, images): cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
