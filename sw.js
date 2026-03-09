// Red Nectar Service Worker — v13 (GitHub Pages + cdnjs)
const CACHE_NAME = 'rednectar-v13';

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      try { await cache.add(new Request(self.registration.scope)); } catch(e) {}
      try { await cache.add(new Request(self.registration.scope + 'index.html')); } catch(e) {}
      try { await cache.add(new Request(self.registration.scope + 'manifest.json')); } catch(e) {}
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
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase.googleapis.com') ||
      url.hostname.includes('googleapis.com')) return;

  const isLocal = url.origin === self.location.origin;
  const isCDN   = url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'www.gstatic.com';
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
