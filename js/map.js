/* Fish Nasty — Leaflet map, basemaps, DNR depth layers, tap-to-depth */
window.FN = window.FN || {};

FN.map = (() => {
  const C = FN.config, U = FN.util;
  let map, lakeMarker, accessGroup, locateGroup, pinsGroup;
  const base = {}, overlays = {};
  const pinMarkers = new Map();
  const DEFAULTS = { basemap: 'sat', relief: true, contours: true, labels: true, names: true, opacity: 0.9, depthMin: 0, depthMax: 999, radar: false, radarLoop: true };
  const settings = Object.assign({}, DEFAULTS, U.store.get(C.storageKeys.layers, {}));
  settings.radar = false;   // radar is a session thing: never on at launch
  const listeners = { tap: [], zoom: [], hold: [], label: [] };

  /* ArcGIS "export" / "exportImage" rendered per tile (no tile cache on the DNR servers) */
  const DynamicLayer = L.TileLayer.extend({
    initialize(baseUrl, options) {
      this._base = baseUrl;
      L.TileLayer.prototype.initialize.call(this, '', Object.assign({
        tileSize: 512, zoomOffset: -1, updateWhenIdle: true, updateWhenZooming: false, updateInterval: 150, keepBuffer: 2,
        crossOrigin: 'anonymous' // CORS responses can be cached by the service worker
      }, options));
    },
    getTileUrl(coords) {
      const b = this._tileCoordsToBounds(coords);
      const sw = L.CRS.EPSG3857.project(b.getSouthWest());
      const ne = L.CRS.EPSG3857.project(b.getNorthEast());
      // Render scale: fills do not need retina resolution; lines get 1.5x on retina screens
      const scale = L.Browser.retina ? (this.options.renderScale || 1.5) : 1;
      const px = Math.round(this.getTileSize().x * scale);
      const p = new URLSearchParams({
        bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`, bboxSR: '3857', imageSR: '3857',
        size: `${px},${px}`, dpi: String(Math.round(96 * scale)), format: this.options.format || 'png32', transparent: 'true', f: 'image'
      });
      const params = typeof this.options.params === 'function' ? this.options.params(coords.z + (this.options.zoomOffset || 0) * -1) : (this.options.params || {});
      for (const [k, v] of Object.entries(params)) p.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      return `${this._base}/${this.options.op || 'export'}?${p.toString()}`;
    }
  });

  const sls = (rgba, width) => ({ type: 'esriSLS', style: 'esriSLSSolid', color: rgba, width });
  const mapLayer = id => ({ type: 'mapLayer', mapLayerId: id });

  function depthDef() {
    const { depthMin, depthMax } = settings;
    if (depthMin <= 0 && depthMax >= 999) return null;
    return `abs_depth >= ${depthMin} AND abs_depth <= ${depthMax}`;
  }

  function contourLayers(zoom) {
    const def = depthDef();
    const z = zoom || C.map.contourMinZoom;
    const layers = [];
    layers.push({
      id: 11, source: mapLayer(1),
      drawingInfo: { renderer: { type: 'simple', symbol: { type: 'esriSFS', style: 'esriSFSNull', outline: sls([255, 255, 255, 190], z >= 12 ? 1.2 : 0.8) } } }
    });
    if (def) layers.push({ id: 12, source: mapLayer(0), drawingInfo: { renderer: { type: 'simple', symbol: sls([200, 220, 240, 90], 0.8) } } });
    const colored = {
      id: 14, source: mapLayer(0),
      drawingInfo: {
        renderer: {
          type: 'classBreaks', field: 'abs_depth', minValue: 0,
          classBreakInfos: C.depthBands.map(b => ({ classMaxValue: b.max, symbol: sls([...b.rgb, 255], z >= 12 ? 1.5 : 1.1) }))
        }
      }
    };
    if (def) colored.definitionExpression = def;
    // Dark casing under the colored lines only once zoomed in (it doubles the server's drawing work)
    if (z >= 12) {
      const casing = { id: 13, source: mapLayer(0), drawingInfo: { renderer: { type: 'simple', symbol: sls([6, 18, 36, 180], 3.2) } } };
      if (def) casing.definitionExpression = def;
      layers.push(casing);
    }
    layers.push(colored);
    // Depth numbers ride along in the same request from zoom 13 (no separate label layer / request)
    if (settings.labels && z >= C.map.labelMinZoom) layers.push(...labelLayers());
    return layers;
  }

  function labelLayers() {
    const def = depthDef();
    const l = {
      id: 15, source: mapLayer(0),
      drawingInfo: {
        renderer: { type: 'simple', symbol: sls([0, 0, 0, 0], 0) },
        showLabels: true,
        labelingInfo: [{
          labelExpression: '[abs_depth]',
          labelPlacement: 'esriServerLinePlacementCenterAlong',
          symbol: {
            type: 'esriTS', color: [255, 255, 255, 255], haloColor: [6, 18, 36, 255], haloSize: 1.5,
            font: { family: 'Arial', size: 9, weight: 'bold' }
          },
          minScale: 0, maxScale: 0
        }]
      }
    };
    if (def) l.definitionExpression = def;
    return [l];
  }

  // How much of the map the bottom sheet covers on a phone (0 when the sheet is closed or on desktop)
  function sheetCover() {
    if (!window.matchMedia('(max-width: 899px)').matches) return 0;
    const sheetEl = document.getElementById('sheet'), app = document.getElementById('app');
    if (!sheetEl || (app && app.classList.contains('panel-closed'))) return 0;
    return Math.max(0, Math.min(window.innerHeight * 0.55, window.innerHeight - sheetEl.getBoundingClientRect().top));
  }
  // Popup auto-pan padding so popups land clear of the search bar, the tool stack and the sheet
  function padOpts() {
    const mobile = window.matchMedia('(max-width: 899px)').matches;
    const mapRect = map.getContainer().getBoundingClientRect();
    const tb = document.querySelector('.topbar'), fabs = document.querySelector('.fabs'), app = document.getElementById('app');
    const top = (mobile || (app && app.classList.contains('panel-closed'))) && tb ? tb.getBoundingClientRect().bottom - mapRect.top + 10 : 14;
    const right = fabs && fabs.offsetParent ? Math.max(14, mapRect.right - fabs.getBoundingClientRect().left + 10) : 14;
    return { tl: L.point(14, top), br: L.point(right, sheetCover() + 14) };
  }
  function init(el) {
    // Open where the map was last left; the very first time, open on Dassel
    const saved = U.store.get(C.storageKeys.view, null);
    const start = saved && isFinite(saved.lat) && isFinite(saved.lon) && isFinite(saved.zoom) ? { center: [saved.lat, saved.lon], zoom: saved.zoom } : { center: C.map.center, zoom: C.map.zoom };
    map = L.map(el, {
      center: start.center, zoom: start.zoom, minZoom: C.map.minZoom, maxZoom: C.map.maxZoom,
      zoomControl: false, attributionControl: true, worldCopyJump: false,
      zoomSnap: 0.5, wheelDebounceTime: 60, inertiaDeceleration: 2500, fadeAnimation: false, markerZoomAnimation: false
    });
    map.attributionControl.setPrefix('');
    // Every popup (pins, landings, depth taps) gets nudged into the part of the map that is actually visible
    map.on('popupopen', e => {
      const p = e.popup; if (!p || !p.options.autoPan) return;
      const o = padOpts();
      p.options.autoPanPaddingTopLeft = o.tl; p.options.autoPanPaddingBottomRight = o.br;
      if (typeof p._adjustPan === 'function') p._adjustPan();
    });

    const fast = { maxZoom: 19, updateWhenZooming: false, keepBuffer: 3 };
    base.sat = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', Object.assign({ attribution: 'Imagery © Esri' }, fast)),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', Object.assign({ opacity: 0.9 }, fast))
    ]);
    base.topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Topo © Esri' });
    base.street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    base.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO' });

    overlays.relief = new DynamicLayer(C.gis.relief, { op: 'exportImage', minZoom: 9, opacity: settings.opacity, renderScale: 1, format: 'png8', params: { noData: '255', noDataInterpretation: 'esriNoDataMatchAll' }, attribution: 'Depth data © MN DNR' });
    overlays.contours = new DynamicLayer(C.gis.bathy, { minZoom: C.map.contourMinZoom, opacity: 1, renderScale: 1.5, params: z => ({ dynamicLayers: contourLayers(z) }) });
    overlays.outlines = new DynamicLayer(C.gis.bathy, {
      minZoom: 8, maxZoom: C.map.contourMinZoom - 1, renderScale: 1, format: 'png8',
      params: { dynamicLayers: [{ id: 21, source: mapLayer(1), drawingInfo: { renderer: { type: 'simple', symbol: { type: 'esriSFS', style: 'esriSFSSolid', color: [111, 179, 236, 70], outline: sls([200, 230, 255, 220], 1) } } } }] }
    });

    accessGroup = L.layerGroup().addTo(map);
    locateGroup = L.layerGroup().addTo(map);
    pinsGroup = L.layerGroup().addTo(map);
    labelGroup.addTo(map);
    applySettings();
    map.on('moveend zoomend', scheduleLabels);
    scheduleLabels();
    let viewTimer = null;
    map.on('moveend', () => { clearTimeout(viewTimer); viewTimer = setTimeout(() => { const c = map.getCenter(); U.store.set(C.storageKeys.view, { lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), zoom: map.getZoom() }); }, 400); });

    map.on('click', e => { for (const fn of listeners.tap) fn(e.latlng); });
    // Right-click on desktop, long-press on touch screens
    map.on('contextmenu', e => { for (const fn of listeners.hold) fn(e.latlng); });
    map.on('zoomend moveend', () => { for (const fn of listeners.zoom) fn(map.getZoom()); });
    return map;
  }

  function applySettings() {
    for (const k of Object.keys(base)) if (map.hasLayer(base[k])) map.removeLayer(base[k]);
    (base[settings.basemap] || base.sat).addTo(map);
    map.getContainer().classList.toggle('basemap-light', settings.basemap === 'street' || settings.basemap === 'topo');
    const want = { outlines: true, relief: settings.relief, contours: settings.contours };
    for (const [k, on] of Object.entries(want)) {
      const l = overlays[k];
      if (on && !map.hasLayer(l)) l.addTo(map);
      if (!on && map.hasLayer(l)) map.removeLayer(l);
    }
    overlays.relief.setOpacity(settings.opacity);
    if (accessGroup) accessGroup.bringToFront && accessGroup.bringToFront();
    syncRadar();
    U.store.set(C.storageKeys.layers, Object.assign({}, settings, { radar: false }));
  }

  /* ---------- weather radar: NWS NEXRAD composite, tiles by Iowa State Mesonet, new frame every 5 minutes ---------- */
  const RADAR_FRAMES = ['-m25m', '-m20m', '-m15m', '-m10m', '-m05m', ''];   // 25 minutes ago ... now
  const radar = { layers: [], frames: 0, timer: 0, refresh: 0, idx: 0 };
  const radarUrl = sfx => `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913${sfx}/{z}/{x}/{y}.png?t={t}`;
  function stopRadar() {
    clearTimeout(radar.timer); clearInterval(radar.refresh); radar.timer = 0; radar.refresh = 0;
    for (const l of radar.layers) if (map.hasLayer(l)) map.removeLayer(l);
    radar.layers = []; radar.frames = 0; radar.idx = 0;
  }
  function radarTick() {
    const n = radar.layers.length; if (!n) return;
    radar.layers.forEach((l, i) => l.setOpacity(i === radar.idx ? 0.72 : 0));
    const last = radar.idx === n - 1;
    radar.idx = (radar.idx + 1) % n;
    radar.timer = setTimeout(radarTick, last ? 1600 : 650);   // hold on the latest frame
  }
  function syncRadar() {
    if (!settings.radar) { stopRadar(); return; }
    const frames = settings.radarLoop !== false ? RADAR_FRAMES : [''];
    if (radar.frames !== frames.length) {
      stopRadar();
      if (!map.getPane('radar')) { map.createPane('radar'); map.getPane('radar').style.zIndex = 430; map.getPane('radar').style.pointerEvents = 'none'; }
      radar.layers = frames.map(sfx => L.tileLayer(radarUrl(sfx), { pane: 'radar', opacity: 0, maxNativeZoom: 12, maxZoom: 19, updateWhenZooming: false, keepBuffer: 2, t: () => Math.floor(Date.now() / 300000), attribution: 'Radar: NWS NEXRAD via IEM' }).addTo(map));
      radar.frames = frames.length; radar.idx = frames.length - 1;
      radar.refresh = setInterval(() => radar.layers.forEach(l => l.redraw()), 5 * 60 * 1000);
    }
    clearTimeout(radar.timer);
    if (frames.length === 1) radar.layers[0].setOpacity(0.72);
    else radarTick();
  }

  function update(patch) {
    const redraw = ('depthMin' in patch) || ('depthMax' in patch) || ('labels' in patch);
    Object.assign(settings, patch);
    applySettings();
    if (redraw) overlays.contours.redraw();
    if ('names' in patch) renderLabels();
  }

  /* ---------- lake name labels (DNR hydrography; big, readable, tappable) ---------- */
  const labelGroup = L.layerGroup();
  const labelCache = new Map();            // lake id -> { dow, name, acres, lat, lon }
  let labelFetched = null, labelTimer = null, labelReq = 0;
  const labelMinAcres = z => (z >= 15 ? 2 : z >= 14 ? 5 : z >= 13 ? 12 : z >= 12 ? 40 : 120);
  let currentDow = null;
  // UTM zone 15N (the DNR's native projection) -> WGS84, for the per-lake center points the layer carries
  function utmToLatLng(x, y, zone = 15) {
    const a = 6378137, e2 = 0.00669438, k0 = 0.9996, ep2 = e2 / (1 - e2);
    const xm = x - 500000, M = y / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
    const sin1 = Math.sin(phi1), cos1 = Math.cos(phi1), tan1 = Math.tan(phi1);
    const N1 = a / Math.sqrt(1 - e2 * sin1 * sin1), T1 = tan1 * tan1, C1 = ep2 * cos1 * cos1;
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * sin1 * sin1, 1.5), D = xm / (N1 * k0);
    const lat = phi1 - (N1 * tan1 / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / cos1;
    return { lat: lat * 180 / Math.PI, lng: lon * 180 / Math.PI };
  }
  function scheduleLabels() { clearTimeout(labelTimer); labelTimer = setTimeout(updateLabels, 180); }
  async function updateLabels() {
    const z = map.getZoom();
    if (z < C.map.nameMinZoom || !settings.names) { labelGroup.clearLayers(); return; }
    const view = map.getBounds(), minAcres = labelMinAcres(z);
    if (labelFetched && labelFetched.bounds.contains(view) && labelFetched.minAcres <= minAcres) { renderLabels(); return; }
    const b = view.pad(0.7);
    const my = ++labelReq;
    const env = { xmin: b.getWest(), ymin: b.getSouth(), xmax: b.getEast(), ymax: b.getNorth(), spatialReference: { wkid: 4326 } };
    const where = `acres >= ${minAcres} AND sub_flag = 'N' AND wb_class = 'Lake or Pond' AND pw_basin_name IS NOT NULL AND pw_basin_name NOT LIKE 'Unnamed%'`;
    const url = `${C.gis.hydro}/1/query?geometry=${encodeURIComponent(JSON.stringify(env))}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&where=${encodeURIComponent(where)}&outFields=dowlknum,pw_basin_name,acres,center_utm_x,center_utm_y&returnGeometry=false&resultRecordCount=600&f=json`;
    try {
      const d = await fetch(url).then(r => r.json());
      if (my !== labelReq) return;
      for (const f of d.features || []) {
        const a = f.attributes;
        if (a.center_utm_x == null || a.center_utm_y == null || !a.pw_basin_name) continue;
        const ll = utmToLatLng(a.center_utm_x, a.center_utm_y);
        const key = a.dowlknum || `${a.pw_basin_name}@${ll.lat.toFixed(3)},${ll.lng.toFixed(3)}`;
        labelCache.set(key, { dow: a.dowlknum, name: a.pw_basin_name, acres: a.acres || 0, lat: ll.lat, lon: ll.lng });
      }
      labelFetched = { bounds: b, minAcres };
    } catch (e) { /* offline or server hiccup: keep whatever names we already have */ }
    renderLabels();
  }
  function renderLabels() {
    labelGroup.clearLayers();
    const z = map.getZoom();
    if (z < C.map.nameMinZoom || !settings.names) return;
    const view = map.getBounds().pad(0.15), minA = labelMinAcres(z);
    const size = z >= 14 ? 'lg' : z >= 12 ? 'md' : 'sm';
    const pxW = size === 'lg' ? 9.5 : size === 'md' ? 8 : 7, pxH = size === 'lg' ? 64 : size === 'md' ? 56 : 48;
    // Biggest lakes first; skip a name whose box would overlap one already placed
    const placed = [];
    const cands = [...labelCache.values()].filter(l => l.acres >= minA && view.contains([l.lat, l.lon]) && !/^unnamed/i.test(l.name)).sort((a, b) => b.acres - a.acres);
    for (const l of cands) {
      const p = map.latLngToLayerPoint([l.lat, l.lon]);
      const w = Math.min(132, l.name.length * pxW + 20);
      if (placed.some(q => Math.abs(q.x - p.x) < (q.w + w) / 2 && Math.abs(q.y - p.y) < pxH)) continue;
      placed.push({ x: p.x, y: p.y, w });
      const isCurrent = currentDow && l.dow && U.dowPrefix(l.dow) === U.dowPrefix(currentDow);
      const badge = l.dow ? `<i class="bd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 12s4-6 10-6c4 0 8 6 8 6s-4 6-8 6c-6 0-10-6-10-6z"/><path d="M3 12l-1-4M3 12l-1 4"/><circle cx="15.5" cy="11" r="1" fill="currentColor"/></svg></i>` : '';
      const m = L.marker([l.lat, l.lon], {
        icon: L.divIcon({ className: `lake-label ${size}${isCurrent ? ' current' : ''}${l.dow ? '' : ' nobadge'}`, html: `<div class="ll">${badge}<span>${U.esc(l.name)}</span></div>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
        interactive: !!l.dow, keyboard: false, zIndexOffset: -200, title: l.dow ? `${l.name} — tap for lake info` : l.name
      });
      if (l.dow) m.on('click', () => { for (const fn of listeners.label) fn(l); });
      labelGroup.addLayer(m);
    }
  }

  let fitCount = 0;
  function showLake(lake, { fit = true } = {}) {
    currentDow = lake ? lake.id : null;
    if (lakeMarker) { map.removeLayer(lakeMarker); lakeMarker = null; }
    if (labelGroup) renderLabels();
    if (!lake || lake.lat == null) return;
    lakeMarker = L.marker([lake.lat, lake.lon], {
      icon: L.divIcon({ className: 'lake-pin', html: '<div class="pin"><span>🎣</span></div>', iconSize: [34, 42], iconAnchor: [17, 42] }),
      interactive: false
    }).addTo(map);
    if (fit) {
      // On phones the bottom sheet covers part of the map: keep the lake in the visible part
      const bottomPad = sheetCover();
      // The first fit after page load jumps straight there (fastest, and immune to paused animation frames); later ones glide
      const animate = fitCount++ > 0;
      if (lake.bbox) {
        const [w, s, e, n] = lake.bbox;
        map.fitBounds([[s, w], [n, e]], { paddingTopLeft: [30, 80], paddingBottomRight: [30, bottomPad + 30], maxZoom: 14, animate });
      } else map.setView([lake.lat, lake.lon], 12, { animate });
    }
  }

  function showAccess(sites) {
    accessGroup.clearLayers();
    for (const s of sites || []) {
      const m = L.marker([s.lat, s.lon], {
        icon: L.divIcon({ className: 'ramp-pin', html: '<div class="ramp">⛵</div>', iconSize: [26, 26], iconAnchor: [13, 13] })
      });
      m.bindPopup(`<strong>${U.esc(s.name)}</strong><br>${U.esc(s.launch || '')}${s.surface ? ' · ' + U.esc(s.surface) : ''}<br>${s.ramps != null ? s.ramps + ' ramp(s), ' : ''}${s.docks != null ? s.docks + ' dock(s)' : ''}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Directions ↗</a>`);
      accessGroup.addLayer(m);
    }
  }

  function flyTo(lat, lon, zoom) { map.flyTo([lat, lon], zoom || Math.max(map.getZoom(), 14), { duration: 0.8 }); }

  /* ---------- waypoints (pins) ---------- */
  function pinIcon(color) {
    return L.divIcon({
      className: 'wp-pin',
      html: `<div class="wp" style="--c:${color || '#ffb454'}"><svg viewBox="0 0 24 24"><path d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.6 7.5 13.5 7.5 13.5S19.5 14.6 19.5 9A7.5 7.5 0 0 0 12 1.5z"/><circle cx="12" cy="9" r="2.8"/></svg></div>`,
      iconSize: [30, 38], iconAnchor: [15, 37], popupAnchor: [0, -34]
    });
  }
  // Keeps existing markers (and any open popup) when only properties change
  function renderPins(pins, popupHtml) {
    const ids = new Set(pins.map(p => p.id));
    for (const [id, m] of pinMarkers) if (!ids.has(id)) { pinsGroup.removeLayer(m); pinMarkers.delete(id); }
    for (const p of pins) {
      let m = pinMarkers.get(p.id);
      if (!m) {
        m = L.marker([p.lat, p.lon], { icon: pinIcon(p.color), zIndexOffset: 600, title: p.name });
        m.bindPopup('', { maxWidth: 280, autoPanPaddingTopLeft: [12, 72], autoPanPaddingBottomRight: [80, 12] });   // keep clear of the search bar and tool stack
        m.on('popupopen', () => m.setPopupContent(m._fnPopup(m._fnPin)));   // fresh catch tally every time it opens
        pinsGroup.addLayer(m); pinMarkers.set(p.id, m);
      } else {
        m.setLatLng([p.lat, p.lon]);
        if (m._fnColor !== p.color) m.setIcon(pinIcon(p.color));
      }
      m._fnColor = p.color; m._fnPin = p; m._fnPopup = popupHtml;
      m.setPopupContent(popupHtml(p));
    }
  }
  function openPin(id, zoom) {
    const m = pinMarkers.get(id);
    if (!m) return;
    const ll = m.getLatLng(), z = Math.max(map.getZoom(), zoom || 13);
    const open = () => m.openPopup();
    if (map.getCenter().distanceTo(ll) > 5 || map.getZoom() !== z) { map.once('moveend', open); map.flyTo(ll, z, { duration: 0.6 }); }
    else open();
  }
  function setPlaceMode(on) { map.getContainer().classList.toggle('placing', !!on); }
  function closePopups() { map.closePopup(); }

  function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation is not supported on this device.'));
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        locateGroup.clearLayers();
        L.circle([lat, lon], { radius: Math.min(accuracy, 500), color: '#58d1ff', weight: 1, fillOpacity: 0.12 }).addTo(locateGroup);
        L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#1e90ff', fillOpacity: 1 }).addTo(locateGroup);
        resolve({ lat, lon, accuracy });
      }, err => reject(err), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  function popup(latlng, html) {
    L.popup({ closeButton: true, autoPan: true, maxWidth: 260 }).setLatLng(latlng).setContent(html).openOn(map);
  }

  const onTap = fn => listeners.tap.push(fn);
  const onZoom = fn => listeners.zoom.push(fn);
  const onHold = fn => listeners.hold.push(fn);
  const onLabel = fn => listeners.label.push(fn);
  // Closest named lake we know about (from the name labels fetched for the current area)
  function nearestLakeName(lat, lon, maxMeters = 4000) {
    let best = null, bestD = Infinity;
    for (const l of labelCache.values()) {
      const d = map.distance([lat, lon], [l.lat, l.lon]);
      if (d < bestD) { bestD = d; best = l; }
    }
    return best && bestD <= maxMeters ? best : null;
  }
  const getMap = () => map;
  const getSettings = () => settings;

  return { init, update, showLake, showAccess, flyTo, locate, popup, onTap, onZoom, onHold, onLabel, getMap, getSettings, DEFAULTS, renderPins, openPin, setPlaceMode, closePopups, utmToLatLng, nearestLakeName };
})();
