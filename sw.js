// Red Nectar Service Worker — v12 (GitHub Pages compatible)
const CACHE_NAME = 'rednectar-v12';

const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache local files using relative paths (works on any subdirectory)
      try { await cache.add(new Request(self.registration.scope)); } catch(e) {}
      try { await cache.add(new Request(self.registration.scope + 'index.html')); } catch(e) {}
      try { await cache.add(new Request(self.registration.scope + 'manifest.json')); } catch(e) {}
      // Cache CDN assets
      for (const url of CDN_ASSETS) {
        try { await cache.add(new Request(url, { mode:'cors' })); }
        catch(e) { console.warn('Could not cache:', url); }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Never intercept Firebase API calls
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase.googleapis.com') ||
      url.hostname.includes('googleapis.com')) return;

  const isLocal = url.origin === self.location.origin;
  const isCDN   = url.hostname === 'unpkg.com' || url.hostname === 'www.gstatic.com';
  if (!isLocal && !isCDN) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        // Fallback to index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(self.registration.scope + 'index.html');
        }
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
