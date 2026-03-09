// Red Nectar Service Worker — v14 (update detection + cache busting)
const CACHE_NAME = 'rednectar-v14';

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
      try {
        const resp = await fetch(self.registration.scope + 'index.html', { cache: 'no-store' });
        if (resp.ok) await cache.put(new Request(self.registration.scope + 'index.html'), resp);
      } catch(e) {}
      try {
        const resp = await fetch(self.registration.scope, { cache: 'no-store' });
        if (resp.ok) await cache.put(new Request(self.registration.scope), resp);
      } catch(e) {}
      try {
        const resp = await fetch(self.registration.scope + 'manifest.json', { cache: 'no-store' });
        if (resp.ok) await cache.put(new Request(self.registration.scope + 'manifest.json'), resp);
      } catch(e) {}
      for (const url of CDN_ASSETS) {
        try {
          const resp = await fetch(new Request(url, { mode: 'cors' }));
          if (resp.ok) await cache.put(url, resp);
        } catch(e) { console.warn('Could not cache CDN asset:', url); }
      }
    })
  );
  // Do NOT skipWaiting here - let app control when to activate
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
      clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED' }));
    });
  }
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

  const scopePath = self.registration.scope.replace(self.location.origin, '');
  const isAppShell = isLocal && (
    url.pathname === scopePath ||
    url.pathname === scopePath + 'index.html' ||
    url.pathname.endsWith('/')
  );

  if (isAppShell) {
    // Network-first for app shell: always get latest
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(c => c || caches.match(self.registration.scope + 'index.html'))
        )
    );
    return;
  }

  // Cache-first for CDN assets
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
