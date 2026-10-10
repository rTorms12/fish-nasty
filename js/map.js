/* Fish Nasty — Leaflet map, basemaps, DNR depth layers, tap-to-depth */
window.FN = window.FN || {};

FN.map = (() => {
  const C = FN.config, U = FN.util;
  let map, lakeMarker, accessGroup, locateGroup, pinsGroup;
  const base = {}, overlays = {};
  const pinMarkers = new Map();
  const DEFAULTS = { basemap: 'sat', relief: true, contours: true, labels: true, opacity: 0.9, depthMin: 0, depthMax: 999 };
  const settings = Object.assign({}, DEFAULTS, U.store.get(C.storageKeys.layers, {}));
  const listeners = { tap: [], zoom: [], hold: [] };

  /* ArcGIS "export" / "exportImage" rendered per tile (no tile cache on the DNR servers) */
  const DynamicLayer = L.TileLayer.extend({
    initialize(baseUrl, options) {
      this._base = baseUrl;
      L.TileLayer.prototype.initialize.call(this, '', Object.assign({ tileSize: 512, zoomOffset: -1, updateWhenIdle: true, keepBuffer: 1 }, options));
    },
    getTileUrl(coords) {
      const b = this._tileCoordsToBounds(coords);
      const sw = L.CRS.EPSG3857.project(b.getSouthWest());
      const ne = L.CRS.EPSG3857.project(b.getNorthEast());
      const scale = L.Browser.retina ? 2 : 1;
      const px = this.getTileSize().x * scale;
      const p = new URLSearchParams({
        bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`, bboxSR: '3857', imageSR: '3857',
        size: `${px},${px}`, dpi: String(96 * scale), format: 'png32', transparent: 'true', f: 'image'
      });
      const params = typeof this.options.params === 'function' ? this.options.params() : (this.options.params || {});
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

  function contourLayers() {
    const def = depthDef();
    const layers = [];
    layers.push({
      id: 11, source: mapLayer(1),
      drawingInfo: { renderer: { type: 'simple', symbol: { type: 'esriSFS', style: 'esriSFSNull', outline: sls([255, 255, 255, 190], 1.2) } } }
    });
    if (def) layers.push({ id: 12, source: mapLayer(0), drawingInfo: { renderer: { type: 'simple', symbol: sls([200, 220, 240, 90], 0.8) } } });
    const casing = { id: 13, source: mapLayer(0), drawingInfo: { renderer: { type: 'simple', symbol: sls([6, 18, 36, 180], 3.2) } } };
    const colored = {
      id: 14, source: mapLayer(0),
      drawingInfo: {
        renderer: {
          type: 'classBreaks', field: 'abs_depth', minValue: 0,
          classBreakInfos: C.depthBands.map(b => ({ classMaxValue: b.max, symbol: sls([...b.rgb, 255], 1.5) }))
        }
      }
    };
    if (def) { casing.definitionExpression = def; colored.definitionExpression = def; }
    layers.push(casing, colored);
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

  function init(el) {
    map = L.map(el, {
      center: C.map.center, zoom: C.map.zoom, minZoom: C.map.minZoom, maxZoom: C.map.maxZoom,
      zoomControl: false, attributionControl: true, worldCopyJump: false
    });
    map.attributionControl.setPrefix('');

    base.sat = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.9 })
    ]);
    base.topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Topo © Esri' });
    base.street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    base.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO' });

    overlays.relief = new DynamicLayer(C.gis.relief, { op: 'exportImage', minZoom: 9, opacity: settings.opacity, params: { noData: '255', noDataInterpretation: 'esriNoDataMatchAll' }, attribution: 'Depth data © MN DNR' });
    overlays.contours = new DynamicLayer(C.gis.bathy, { minZoom: C.map.contourMinZoom, opacity: 1, params: () => ({ dynamicLayers: contourLayers() }) });
    overlays.labels = new DynamicLayer(C.gis.bathy, { minZoom: C.map.labelMinZoom, opacity: 1, params: () => ({ dynamicLayers: labelLayers() }) });
    overlays.outlines = new DynamicLayer(C.gis.bathy, {
      minZoom: 8, maxZoom: C.map.contourMinZoom - 1,
      params: { dynamicLayers: [{ id: 21, source: mapLayer(1), drawingInfo: { renderer: { type: 'simple', symbol: { type: 'esriSFS', style: 'esriSFSSolid', color: [111, 179, 236, 70], outline: sls([200, 230, 255, 220], 1) } } } }] }
    });

    accessGroup = L.layerGroup().addTo(map);
    locateGroup = L.layerGroup().addTo(map);
    pinsGroup = L.layerGroup().addTo(map);
    applySettings();

    map.on('click', e => { for (const fn of listeners.tap) fn(e.latlng); });
    // Right-click on desktop, long-press on touch screens
    map.on('contextmenu', e => { for (const fn of listeners.hold) fn(e.latlng); });
    map.on('zoomend moveend', () => { for (const fn of listeners.zoom) fn(map.getZoom()); });
    return map;
  }

  function applySettings() {
    for (const k of Object.keys(base)) if (map.hasLayer(base[k])) map.removeLayer(base[k]);
    (base[settings.basemap] || base.sat).addTo(map);
    const want = { outlines: true, relief: settings.relief, contours: settings.contours, labels: settings.contours && settings.labels };
    for (const [k, on] of Object.entries(want)) {
      const l = overlays[k];
      if (on && !map.hasLayer(l)) l.addTo(map);
      if (!on && map.hasLayer(l)) map.removeLayer(l);
    }
    overlays.relief.setOpacity(settings.opacity);
    if (accessGroup) accessGroup.bringToFront && accessGroup.bringToFront();
    U.store.set(C.storageKeys.layers, settings);
  }

  function update(patch) {
    const depthChanged = ('depthMin' in patch) || ('depthMax' in patch);
    Object.assign(settings, patch);
    applySettings();
    if (depthChanged) { overlays.contours.redraw(); overlays.labels.redraw(); }
  }

  function showLake(lake, { fit = true } = {}) {
    if (lakeMarker) { map.removeLayer(lakeMarker); lakeMarker = null; }
    if (!lake || lake.lat == null) return;
    lakeMarker = L.marker([lake.lat, lake.lon], {
      icon: L.divIcon({ className: 'lake-pin', html: '<div class="pin"><span>🎣</span></div>', iconSize: [34, 42], iconAnchor: [17, 42] }),
      interactive: false
    }).addTo(map);
    if (fit) {
      // On phones the bottom sheet covers part of the map: keep the lake in the visible part
      const mobile = window.matchMedia('(max-width: 899px)').matches;
      const sheetEl = document.getElementById('sheet');
      const bottomPad = mobile && sheetEl ? Math.min(sheetEl.getBoundingClientRect().height, window.innerHeight * 0.5) : 0;
      if (lake.bbox) {
        const [w, s, e, n] = lake.bbox;
        map.fitBounds([[s, w], [n, e]], { paddingTopLeft: [30, 80], paddingBottomRight: [30, bottomPad + 30], maxZoom: 14, animate: true });
      } else map.setView([lake.lat, lake.lon], 12);
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
        m.bindPopup('', { maxWidth: 280 });
        pinsGroup.addLayer(m); pinMarkers.set(p.id, m);
      } else {
        m.setLatLng([p.lat, p.lon]);
        if (m._fnColor !== p.color) m.setIcon(pinIcon(p.color));
      }
      m._fnColor = p.color;
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
  const getMap = () => map;
  const getSettings = () => settings;

  return { init, update, showLake, showAccess, flyTo, locate, popup, onTap, onZoom, onHold, getMap, getSettings, DEFAULTS, renderPins, openPin, setPlaceMode, closePopups };
})();
