/* Fish Nasty — service worker: offline app shell + cached data */
const VERSION = 'fn-v1.6.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/config.js', './js/species.js', './js/dnr.js', './js/weather.js', './js/solunar.js', './js/forecast.js', './js/map.js', './js/ui.js', './js/views.js', './js/cloud.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './img/species/walleye-sm.jpg', './img/species/northern-pike-sm.jpg', './img/species/crappie-sm.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js'
];
const DATA_HOSTS = ['maps.dnr.state.mn.us', 'api.open-meteo.com'];
const DATA_CACHE = 'fn-data-v2';          // survives app updates: lake data does not change with the code
const TILE_CACHE = 'fn-tiles-v1';
const TILE_MAX = 600;                    // ~600 depth tiles ≈ 40-60 MB on the device

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fn-v') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Weather: always fresh when online, last copy when offline
  if (url.hostname === 'api.open-meteo.com') {
    e.respondWith(fetch(req).then(res => { if (res.ok) caches.open(DATA_CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req)));
    return;
  }
  // DNR lake data (surveys, stocking, access, search): serve the cached copy instantly, refresh it in the background
  if (DATA_HOSTS.includes(url.hostname) || url.pathname.includes('/struc_water_access_sites/') || url.pathname.includes('/water_lake_bathymetry/MapServer/2/') || url.pathname.includes('/water_lake_bathymetry/MapServer/1/query')) {
    e.respondWith(staleWhileRevalidate(req, DATA_CACHE, 7 * 24 * 3600 * 1000));
    return;
  }
  // DNR depth tiles (rendered live by the state server, slow): keep up to TILE_MAX of them on the device
  if (url.hostname.endsWith('gisdata.mn.gov') && (url.pathname.endsWith('/export') || url.pathname.endsWith('/exportImage'))) {
    e.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit && !isStale(hit, 30 * 24 * 3600 * 1000)) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && res.type !== 'opaque') { const copy = await stamp(res.clone()); await c.put(req, copy); trimCache(TILE_CACHE, TILE_MAX); }
        return res;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  // Basemap tiles and anything else from other hosts: straight to the network (browser HTTP cache handles them)
  if (url.hostname.includes('arcgisonline.com') || url.hostname.includes('openstreetmap.org') || url.hostname.includes('cartocdn.com') || url.hostname.endsWith('supabase.co') || url.hostname.endsWith('gisdata.mn.gov')) return;
  // Libraries from the CDNs are versioned URLs: cache first
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone())); return res; })));
    return;
  }
  // App shell (same origin): network first so updates show up on reload, cache fallback for offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req, { ignoreSearch: true })));
  }
});

// ---- helpers ----
const stamp = res => { const h = new Headers(res.headers); h.set('x-fn-cached', String(Date.now())); return res.arrayBuffer().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: h })); };
const isStale = (res, maxAge) => { const t = Number(res.headers.get('x-fn-cached') || 0); return !t || Date.now() - t > maxAge; };
async function staleWhileRevalidate(req, cacheName, maxAge) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  const refresh = fetch(req).then(async res => { if (res.ok) c.put(req, await stamp(res.clone())); return res; }).catch(() => null);
  if (hit && !isStale(hit, maxAge)) { refresh.catch(() => {}); return hit; }
  const fresh = await refresh;
  return fresh || hit || Response.error();
}
const trimTimers = {};
function trimCache(name, max) {
  clearTimeout(trimTimers[name]);
  trimTimers[name] = setTimeout(async () => {
    const c = await caches.open(name); const keys = await c.keys();
    if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
  }, 3000);
}
