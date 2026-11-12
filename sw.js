/* Fish Nasty — service worker: offline app shell + cached data */
const VERSION = 'fn-v1.14.0';
const V = VERSION.replace('fn-v', '');
const ver = u => `${u}?v=${V}`;           // index.html asks for these with the version on the end; cache them under that exact address
const SHELL = [
  './', './index.html', './manifest.webmanifest', ver('./css/app.css'),
  ...['config', 'species', 'dnr', 'weather', 'solunar', 'forecast', 'map', 'ui', 'views', 'cloud', 'app'].map(n => ver(`./js/${n}.js`)),
  './icons/icon-192.png', './icons/apple-touch-icon.png', './icons/favicon-64.png',
  './img/species/walleye-sm.jpg', './img/species/northern-pike-sm.jpg', './img/species/crappie-sm.jpg', './img/species/largemouth-bass-sm.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js'
];
const DATA_HOSTS = ['maps.dnr.state.mn.us', 'api.open-meteo.com'];
const DATA_CACHE = 'fn-data-v2';          // survives app updates: lake data does not change with the code
const DATA_MAX = 400;                     // lake pages, surveys, stocking tables kept on the device
const TILE_CACHE = 'fn-tiles-v1';
const TILE_MAX = 600;                     // ~600 depth tiles ≈ 40-60 MB on the device

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

  // Radar tiles and NWS alerts: live only, never cached
  if (url.hostname === 'mesonet.agron.iastate.edu' || url.hostname === 'api.weather.gov') return;
  // Weather: always fresh when online, last copy when offline
  if (url.hostname === 'api.open-meteo.com') {
    e.respondWith(fetch(req).then(res => { if (res.ok) caches.open(DATA_CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req)));
    return;
  }
  // Statewide lake rankings (public, refreshed monthly): one document per species, good for a day, kept for offline
  if (url.hostname.endsWith('supabase.co') && url.pathname.endsWith('/rpc/lake_metrics')) {
    e.respondWith(staleWhileRevalidate(req, DATA_CACHE, 24 * 3600 * 1000));
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
  // Basemap tiles, account data and anything else from other hosts: straight to the network (browser HTTP cache handles them)
  if (url.hostname.includes('arcgisonline.com') || url.hostname.includes('openstreetmap.org') || url.hostname.includes('cartocdn.com') || url.hostname.endsWith('supabase.co') || url.hostname.endsWith('gisdata.mn.gov')) return;
  // Libraries from the CDNs are versioned URLs: cache first
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone())); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // The page itself: network first, so a new release shows up on the next open — but never hang on a weak signal
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) { e.respondWith(networkFirst(req, 3000)); return; }
  // Code and styles carry their version in the address (?v=1.13.0) and never change under it: answer from the device at once
  if (url.searchParams.has('v')) { e.respondWith(cacheFirst(req, e, true)); return; }
  // Artwork and icons do not change
  if (url.pathname.includes('/img/') || url.pathname.includes('/icons/')) { e.respondWith(cacheFirst(req, e, false)); return; }
  // Everything else (the bundled rankings file, the manifest): network first with a short wait
  e.respondWith(networkFirst(req, 4000));
});

// ---- helpers ----
const stamp = res => { const h = new Headers(res.headers); h.set('x-fn-cached', String(Date.now())); return res.arrayBuffer().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: h })); };
const isStale = (res, maxAge) => { const t = Number(res.headers.get('x-fn-cached') || 0); return !t || Date.now() - t > maxAge; };
async function staleWhileRevalidate(req, cacheName, maxAge) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  const refresh = fetch(req).then(async res => { if (res.ok) { await c.put(req, await stamp(res.clone())); if (cacheName === DATA_CACHE) trimCache(DATA_CACHE, DATA_MAX); } return res; }).catch(() => null);
  if (hit && !isStale(hit, maxAge)) { refresh.catch(() => {}); return hit; }
  const fresh = await refresh;
  return fresh || hit || Response.error();
}
// Network first, but if the network has not answered within `ms` use the copy on the device (the network answer still updates the cache)
async function networkFirst(req, ms) {
  const cache = await caches.open(VERSION);
  const cached = () => cache.match(req, { ignoreSearch: true });
  const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  net.catch(() => {});
  let timer;
  const slow = new Promise(resolve => { timer = setTimeout(() => cached().then(resolve), ms); });
  try {
    const first = await Promise.race([net, slow]);
    clearTimeout(timer);
    return first || await net;                 // nothing cached yet: keep waiting for the network
  } catch (err) {
    clearTimeout(timer);
    return (await cached()) || Response.error();
  }
}
// Cache first. With `refresh`, also re-check quietly in the background so a file changed without a version bump heals on the next open
async function cacheFirst(req, event, refresh) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) {
    if (refresh) event.waitUntil(fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) return cache.put(req, res); }).catch(() => {}));
    return hit;
  }
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) { return (await cache.match(req, { ignoreSearch: true })) || Response.error(); }
}
const trimTimers = {};
function trimCache(name, max) {
  clearTimeout(trimTimers[name]);
  trimTimers[name] = setTimeout(async () => {
    const c = await caches.open(name); const keys = await c.keys();
    if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
  }, 3000);
}
