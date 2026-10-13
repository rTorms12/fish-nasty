/* Fish Nasty — service worker: offline app shell + cached data */
const VERSION = 'fn-v1.4.4';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/config.js', './js/species.js', './js/dnr.js', './js/weather.js', './js/solunar.js', './js/forecast.js', './js/map.js', './js/ui.js', './js/views.js', './js/cloud.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js'
];
const DATA_HOSTS = ['maps.dnr.state.mn.us', 'api.open-meteo.com'];
const DATA_CACHE = VERSION + '-data';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Live data: network first, fall back to the last cached copy (works offline for lakes you've opened)
  if (DATA_HOSTS.includes(url.hostname) || url.pathname.includes('/struc_water_access_sites/')) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) caches.open(DATA_CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  // Map tiles & dynamic layers: network only (too large to cache)
  if (url.hostname.includes('arcgisonline.com') || url.hostname.includes('gisdata.mn.gov') || url.hostname.includes('openstreetmap.org') || url.hostname.includes('cartocdn.com') || url.hostname.endsWith('supabase.co')) return;
  // Libraries from the CDN are versioned URLs: cache first
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    })));
    return;
  }
  // App shell (same origin): network first so updates show up on reload, cache fallback for offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
  }
});
