// Service worker voor apps.3l.nl.
//
// Twee doelen, in deze volgorde:
//  1. Chrome op Android laat een site alleen als échte webapp (WebAPK, zonder
//     browser-UI) installeren als er een service worker met een fetch-handler is.
//  2. De pagina's blijven offline bereikbaar zodra ze één keer geladen zijn.
//
// Strategie is bewust **network-first**: de one-offs in deze repo veranderen vaak,
// en een cache-first worker zou oude versies blijven serveren tot de cache wordt
// geleegd. De cache is hier dus alleen een fallback, geen bron van waarheid.

const CACHE = 'plekkie-v2';

// De schil vooraf cachen, plus one-offs die offline mee moeten (stokken: voor
// in de schuur of het bos). Overige apps komen in de cache zodra je ze bezoekt.
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/stokken/',
  '/stokken/materialen.html',
  '/stokken/stenen.html',
  '/stokken/technieken.html',
  '/stokken/gereedschap.html',
  '/stokken/stijl.css',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // Individueel toevoegen: één 404 mag de hele installatie niet laten mislukken.
      .then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;  // externe assets ongemoeid laten

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // Offline en een onbekende pagina opgevraagd: val terug op de landingspagina.
        if (request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return new Response('Offline en niet in de cache.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});
