/* Fish Nasty — app controller: state, events, data loading, sheet, PWA */
(() => {
  const C = FN.config, U = FN.util, K = C.storageKeys;
  const $ = s => document.querySelector(s);

  const S = {
    view: 'home', tab: 'overview',
    lake: null, detail: null, stocking: null, access: null, weather: null, bite: null,
    species: U.store.get(K.species, 'ALL'), dayIdx: 0, hourIdx: null, surveyIdx: 0, lengthSpecies: null,
    loading: {}, errors: {},
    favorites: U.store.get(K.favorites, []), recents: U.store.get(K.recents, []), lastLake: U.store.get(K.lastLake, null),
    nearby: null, location: null, homeWeather: null, homeBite: null, homeLabel: null,
    searchList: null, searchQ: '',
    pins: U.store.get(K.pins, []), placeMode: false, editPin: null, prevView: 'home', editColor: null,
    rankings: null, topSpecies: U.store.get('fn.topSpecies', 'WAE'), topMode: U.store.get('fn.topMode', 'big')
  };
  let reqId = 0;

  /* ---------- rendering ---------- */
  const body = $('#sheet-body');
  function render() {
    const scroll = body.scrollTop;
    const pinToEdit = S.view === 'pin' ? S.pins.find(p => p.id === S.editPin) : null;
    body.innerHTML = pinToEdit ? FN.ui.pinEditor(Object.assign({}, pinToEdit, S.editColor ? { color: S.editColor } : {}))
      : S.view === 'top' ? FN.ui.top(S)
      : (S.view === 'lake' && S.lake ? FN.ui.lake(S) : FN.ui.home(S));
    if (S._keepScroll) body.scrollTop = scroll; else body.scrollTop = 0;
    S._keepScroll = false;
  }
  function rerender() { S._keepScroll = true; render(); }

  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), ms);
  }

  /* ---------- sheet ---------- */
  const sheet = $('#sheet');
  const SNAPS = ['collapsed', 'half', 'full'];
  function setSheet(state) { sheet.classList.remove(...SNAPS); sheet.classList.add(state); sheet.style.height = ''; }
  (function dragSetup() {
    const handle = $('#sheet-handle');
    let startY = 0, startH = 0, dragging = false, moved = false;
    handle.addEventListener('pointerdown', e => {
      if (window.matchMedia('(min-width: 900px)').matches) return;
      dragging = true; moved = false; startY = e.clientY; startH = sheet.getBoundingClientRect().height;
      handle.setPointerCapture(e.pointerId); sheet.classList.add('dragging');
    });
    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dy = e.clientY - startY; if (Math.abs(dy) > 4) moved = true;
      const h = U.clamp(startH - dy, 60, window.innerHeight * 0.94);
      sheet.style.height = h + 'px';
    });
    const end = () => {
      if (!dragging) return; dragging = false; sheet.classList.remove('dragging');
      const h = sheet.getBoundingClientRect().height, vh = window.innerHeight;
      if (!moved) { // tap cycles
        const cur = SNAPS.find(s => sheet.classList.contains(s)) || 'half';
        setSheet(cur === 'collapsed' ? 'half' : cur === 'half' ? 'full' : 'collapsed');
        return;
      }
      const targets = { collapsed: 72, half: vh * 0.46, full: vh * 0.9 };
      let best = 'half', bd = Infinity;
      for (const [k, v] of Object.entries(targets)) { const d = Math.abs(v - h); if (d < bd) { bd = d; best = k; } }
      setSheet(best);
    };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  })();

  /* ---------- search ---------- */
  const searchEl = $('#search'), resultsEl = $('#search-results');
  let searchTimer = null;
  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim();
    $('#search-clear').classList.toggle('hidden', !q);
    clearTimeout(searchTimer);
    if (q.length < 2) { resultsEl.classList.add('hidden'); S.searchList = null; return; }
    searchTimer = setTimeout(() => runSearch(q), 300);
  });
  searchEl.addEventListener('focus', () => { if (S.searchList) resultsEl.classList.remove('hidden'); });
  searchEl.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(searchTimer); runSearch(searchEl.value.trim()); } if (e.key === 'Escape') closeSearch(); });
  $('#search-clear').addEventListener('click', () => { searchEl.value = ''; closeSearch(); $('#search-clear').classList.add('hidden'); });
  async function runSearch(q) {
    if (!q) return;
    resultsEl.innerHTML = FN.ui.spinner('Searching LakeFinder…'); resultsEl.classList.remove('hidden');
    const my = ++reqId;
    try {
      let list;
      if (/^\d{8}$/.test(q)) { const l = await FN.dnr.resolve(q); list = l ? [l] : []; }
      else list = await FN.dnr.search(q);
      if (my !== reqId) return;
      S.searchList = list; S.searchQ = q;
      resultsEl.innerHTML = FN.ui.searchResults(list, q);
    } catch (e) {
      if (my !== reqId) return;
      resultsEl.innerHTML = `<div class="sr-empty">Search failed (${U.esc(e.message)}). Check your connection.</div>`;
    }
  }
  function closeSearch() { resultsEl.classList.add('hidden'); searchEl.blur(); }

  /* ---------- lake loading ---------- */
  async function openLake(id, { fit = true } = {}) {
    closeSearch();
    const my = ++reqId;
    S.view = 'lake'; S.tab = S.tab === 'overview' || !S.lake || S.lake.id !== id ? 'overview' : S.tab;
    S.loading = { lake: true, detail: true, stocking: true, access: true, weather: true }; S.errors = {};
    S.detail = S.stocking = S.access = S.weather = S.bite = null; S.dayIdx = 0; S.hourIdx = null; S.surveyIdx = 0;
    let lake = (S.lake && S.lake.id === id) ? S.lake : null;
    if (!lake) {
      body.innerHTML = FN.ui.spinner('Loading lake…');
      try { lake = await FN.dnr.resolve(id); } catch (e) { lake = null; }
      if (my !== reqId) return;
      if (!lake) { toast('Could not find that lake in LakeFinder.'); S.view = 'home'; render(); return; }
    }
    S.lake = lake; S.loading.lake = false;
    location.hash = `lake/${lake.id}`;
    document.title = `${lake.name} · Fish Nasty`;
    pushRecent(lake);
    FN.map.showLake(lake, { fit });
    FN.map.showAccess([]);
    if (window.matchMedia('(max-width: 899px)').matches) setSheet('half');
    render();

    // Load everything in parallel; render as each arrives
    FN.dnr.detail(lake.id).then(d => { if (my !== reqId) return; S.detail = d; S.loading.detail = false; if (d && !lake.species.length) { lake.species = latestSpeciesNames(d); lake.speciesCodes = lake.species.map(FN.speciesCode).filter(Boolean); } rerender(); })
      .catch(e => { if (my !== reqId) return; S.errors.detail = 'Could not load the DNR survey: ' + e.message; S.loading.detail = false; rerender(); });
    (lake.resources.fishStocking ? FN.dnr.stocking(lake.id) : Promise.resolve({ rows: [], notes: {} }))
      .then(st => { if (my !== reqId) return; S.stocking = st; S.loading.stocking = false; rerender(); })
      .catch(e => { if (my !== reqId) return; S.errors.stocking = 'Could not load stocking data: ' + e.message; S.loading.stocking = false; rerender(); });
    FN.dnr.accessSites(lake).then(a => { if (my !== reqId) return; S.access = a; S.loading.access = false; FN.map.showAccess(a); rerender(); })
      .catch(() => { if (my !== reqId) return; S.access = []; S.loading.access = false; rerender(); });
    if (lake.lat != null) {
      FN.weather.forecast(lake.lat, lake.lon).then(w => { if (my !== reqId) return; S.weather = w; S.loading.weather = false; computeBite(); rerender(); })
        .catch(e => { if (my !== reqId) return; S.errors.weather = 'Weather unavailable: ' + e.message; S.loading.weather = false; rerender(); });
    } else { S.loading.weather = false; S.errors.weather = 'No coordinates for this lake.'; }
  }
  const latestSpeciesNames = d => { const s = d.surveys.find(x => x.catches.length); return s ? [...new Set(s.catches.map(c => c.name))] : []; };

  function computeBite() {
    if (!S.weather || !S.lake) return;
    let sp = S.species;
    if (sp !== 'ALL' && !S.lake.speciesCodes.includes(sp)) sp = 'ALL';
    S.bite = FN.forecast.compute(S.weather, S.lake.lat, S.lake.lon, sp);
  }

  function pushRecent(lake) {
    const item = { id: lake.id, name: lake.name, county: lake.county, town: lake.town, acres: lake.acres, maxDepth: lake.maxDepth };
    S.recents = [item, ...S.recents.filter(r => r.id !== lake.id)].slice(0, 8);
    U.store.set(K.recents, S.recents);
    S.lastLake = item; U.store.set(K.lastLake, item);
  }

  function goHome() {
    S.view = 'home'; location.hash = ''; document.title = 'Fish Nasty';
    render();
  }

  /* ---------- top 20 lakes ---------- */
  async function openTop() {
    closeSearch();
    S.view = 'top'; location.hash = 'top'; document.title = 'Top 20 lakes · Fish Nasty';
    render();
    if (isMobile()) setSheet('full');
    if (!S.rankings && !S.loading.rankings) {
      S.loading.rankings = true; S.errors.rankings = null; rerender();
      try {
        const r = await fetch('data/rankings.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status === 404 ? 'data/rankings.json has not been built yet (run tools/build_rankings.py).' : 'HTTP ' + r.status);
        S.rankings = await r.json();
      } catch (e) { S.errors.rankings = 'Could not load the rankings: ' + e.message; }
      S.loading.rankings = false;
      if (S.view === 'top') rerender();
    }
  }

  /* ---------- pins (waypoints) ---------- */
  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  function savePins() { U.store.set(K.pins, S.pins); FN.map.renderPins(S.pins, FN.ui.pinPopup); }
  function pinById(id) { return S.pins.find(p => p.id === id); }

  async function addPin(lat, lon, extra = {}) {
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const pin = {
      id, name: extra.name || `Pin ${S.pins.length + 1}`, lat: +Number(lat).toFixed(6), lon: +Number(lon).toFixed(6),
      depth: extra.depth != null && Number(extra.depth) >= 1 ? Number(extra.depth) : null, lakeId: extra.lakeId || null, lakeName: extra.lakeName || null,
      notes: '', color: C.pinColors[0], created: new Date().toISOString(), source: extra.source || 'tap', accuracy: extra.accuracy || null
    };
    if (pin.lakeName && pin.name.startsWith('Pin ')) pin.name = `${pin.lakeName}${pin.depth != null ? ' · ' + pin.depth + ' ft' : ''}`;
    S.pins.unshift(pin); savePins();
    FN.map.closePopups();
    if (isMobile()) setSheet('collapsed');
    FN.map.openPin(id, extra.source === 'gps' ? 14 : undefined);
    toast('Pin dropped — tap it to name it');
    if (S.view !== 'pin') rerender();
    if (pin.depth == null || !pin.lakeName) {
      // Fill in depth and lake from the DNR bathymetry (no need to be zoomed in)
      try {
        const b = L.latLngBounds([pin.lat - 0.01, pin.lon - 0.015], [pin.lat + 0.01, pin.lon + 0.015]);
        const res = await FN.dnr.identify(pin.lat, pin.lon, b, { x: 512, y: 512 });
        const live = pinById(id); if (!live) return;
        if (res.depth != null && res.depth >= 1 && live.depth == null) live.depth = Math.round(res.depth);
        if (res.lake && !live.lakeName) { live.lakeId = res.lake.dow; live.lakeName = res.lake.name; }
        if (live.name.startsWith('Pin ') && live.lakeName) live.name = `${live.lakeName}${live.depth != null ? ' · ' + live.depth + ' ft' : ''}`;
        savePins(); if (S.view !== 'pin') rerender();
      } catch (e) { /* no depth data here */ }
    }
  }
  async function pinMyLocation() {
    closePinMenu();
    toast('Getting a GPS fix…', 6000);
    try {
      const loc = await FN.map.locate();
      S.location = loc;
      addPin(loc.lat, loc.lon, { source: 'gps', accuracy: loc.accuracy });
    } catch (e) { toast(e.code === 1 ? 'Location permission denied. Enable it in your browser settings.' : 'Could not get your location.'); }
  }
  function setPlaceMode(on) {
    S.placeMode = !!on;
    FN.map.setPlaceMode(on);
    $('#place-hint').classList.toggle('hidden', !on);
    if (on) { closePinMenu(); $('#legend').classList.add('hidden'); $('#layers-panel').classList.add('hidden'); if (isMobile()) setSheet('collapsed'); }
  }
  function closePinMenu() { $('#pin-menu').classList.add('hidden'); }
  function editPin(id) {
    if (!pinById(id)) return;
    if (S.view !== 'pin') S.prevView = S.view;
    S.view = 'pin'; S.editPin = id; S.editColor = null;
    render();
    if (isMobile()) setSheet('full');
    const inp = $('#pin-name'); if (inp) { inp.focus(); inp.select(); }
  }
  function leavePinEditor() { S.view = S.prevView === 'lake' && S.lake ? 'lake' : 'home'; S.editPin = null; S.editColor = null; render(); }
  function savePinEdits(id) {
    const p = pinById(id); if (!p) return;
    const name = ($('#pin-name') || {}).value, notes = ($('#pin-notes') || {}).value;
    if (name != null && name.trim()) p.name = name.trim().slice(0, 60);
    if (notes != null) p.notes = notes.trim().slice(0, 500);
    if (S.editColor) p.color = S.editColor;
    savePins(); toast('Pin saved'); leavePinEditor();
  }
  function deletePin(id) {
    const p = pinById(id); if (!p) return;
    if (!confirm(`Delete pin “${p.name}”?`)) return;
    S.pins = S.pins.filter(x => x.id !== id); savePins();
    FN.map.closePopups();
    if (S.view === 'pin') leavePinEditor(); else rerender();
    toast('Pin deleted');
  }
  async function copyPin(id) {
    const p = pinById(id); if (!p) return;
    const text = `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
    try { await navigator.clipboard.writeText(text); toast(`Copied ${text}`); } catch (e) { prompt('Coordinates', text); }
  }

  /* ---------- home bite (location or last lake) ---------- */
  async function loadHomeBite(lat, lon, label) {
    S.loading.home = true;
    try {
      const w = await FN.weather.forecast(lat, lon);
      S.homeWeather = w; S.homeBite = FN.forecast.compute(w, lat, lon, 'ALL'); S.homeLabel = label;
    } catch (e) { /* offline */ }
    S.loading.home = false;
    if (S.view === 'home') rerender();
  }

  async function locateNearby() {
    toast('Finding your location…', 4000);
    try {
      const loc = await FN.map.locate();
      S.location = loc;
      FN.map.flyTo(loc.lat, loc.lon, 11);
      loadHomeBite(loc.lat, loc.lon, 'your location');
      try { S.nearby = await FN.dnr.nearby(loc.lat, loc.lon, 25000, 20); } catch (e) { S.nearby = []; }
      if (S.view === 'home') rerender();
      if (!S.nearby.length) toast('No mapped lakes within 15 miles.');
    } catch (e) {
      toast(e.code === 1 ? 'Location permission denied. Enable it in your browser settings.' : 'Could not get your location.');
    }
  }

  /* ---------- map tap: depth ---------- */
  FN.map.onTap(async latlng => {
    if (S.placeMode) { setPlaceMode(false); addPin(latlng.lat, latlng.lng, { source: 'tap' }); return; }
    const map = FN.map.getMap();
    if (map.getZoom() < 10) return;
    try {
      const res = await FN.dnr.identify(latlng.lat, latlng.lng, map.getBounds(), map.getSize());
      if (res.depth == null && !res.lake) return;
      FN.map.popup(latlng, FN.ui.depthPopup(res, S.lake && S.lake.id, latlng));
    } catch (e) { /* ignore */ }
  });
  FN.map.onHold(latlng => { if (S.placeMode) setPlaceMode(false); addPin(latlng.lat, latlng.lng, { source: 'hold' }); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.placeMode) setPlaceMode(false); });
  const hint = $('#zoom-hint');
  FN.map.onZoom(z => { hint.classList.toggle('hidden', z >= C.map.contourMinZoom); });

  /* ---------- events (delegated) ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) {
      if (!e.target.closest('.search') && !e.target.closest('#search-results')) resultsEl.classList.add('hidden');
      if (!e.target.closest('#layers-panel') && !e.target.closest('#fab-layers')) $('#layers-panel').classList.add('hidden');
      if (!e.target.closest('#pin-menu') && !e.target.closest('#fab-pin')) closePinMenu();
      return;
    }
    const a = el.dataset.action;
    switch (a) {
      case 'open-lake': openLake(el.dataset.id); break;
      case 'home': goHome(); break;
      case 'tab': S.tab = el.dataset.tab; render(); if (window.matchMedia('(max-width: 899px)').matches) setSheet('full'); break;
      case 'fav': toggleFav(); break;
      case 'zoom-lake': FN.map.showLake(S.lake, { fit: true }); if (window.matchMedia('(max-width: 899px)').matches) setSheet('collapsed'); break;
      case 'species': S.species = el.dataset.code; U.store.set(K.species, S.species); S.hourIdx = null; computeBite(); rerender(); break;
      case 'day': S.dayIdx = Number(el.dataset.i); S.hourIdx = null; rerender(); break;
      case 'hour': S.hourIdx = Number(el.dataset.i); rerender(); break;
      case 'locate-nearby': locateNearby(); break;
      case 'fly': FN.map.flyTo(Number(el.dataset.lat), Number(el.dataset.lon), 15); if (window.matchMedia('(max-width: 899px)').matches) setSheet('collapsed'); break;
      case 'layers-close': $('#layers-panel').classList.add('hidden'); break;
      case 'basemap': FN.map.update({ basemap: el.dataset.v }); renderLayers(); break;
      case 'depth-reset': FN.map.update({ depthMin: 0, depthMax: 999 }); renderLayers(); break;
      case 'top': openTop(); break;
      case 'top-species': S.topSpecies = el.dataset.code; U.store.set('fn.topSpecies', S.topSpecies); rerender(); break;
      case 'top-mode': S.topMode = el.dataset.mode; U.store.set('fn.topMode', S.topMode); rerender(); break;
      case 'pin-gps': pinMyLocation(); break;
      case 'pin-place': setPlaceMode(true); break;
      case 'pin-cancel': setPlaceMode(false); break;
      case 'pin-menu-close': closePinMenu(); break;
      case 'pin-here': FN.map.closePopups(); addPin(Number(el.dataset.lat), Number(el.dataset.lon), { source: 'tap', depth: el.dataset.depth != null ? Number(el.dataset.depth) : null, lakeId: el.dataset.lakeId || null, lakeName: el.dataset.lakeName || null }); break;
      case 'pin-open': e.stopPropagation(); if (isMobile()) setSheet('collapsed'); FN.map.openPin(el.dataset.id); break;
      case 'pin-edit': e.stopPropagation(); editPin(el.dataset.id); break;
      case 'pin-back': leavePinEditor(); break;
      case 'pin-save': savePinEdits(el.dataset.id); break;
      case 'pin-delete': deletePin(el.dataset.id); break;
      case 'pin-copy': copyPin(el.dataset.id); break;
      case 'pin-color': S.editColor = el.dataset.c; document.querySelectorAll('.colors button').forEach(b => b.classList.toggle('on', b === el)); break;
    }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.change === 'survey') { S.surveyIdx = Number(el.value); S.lengthSpecies = null; rerender(); }
    else if (el.dataset.change === 'length-species') { S.lengthSpecies = el.value; rerender(); }
    else if (el.dataset.toggle) FN.map.update({ [el.dataset.toggle]: el.checked });
    else if (el.dataset.depth) {
      const s = FN.map.getSettings();
      const v = Number(el.value);
      const patch = el.dataset.depth === 'min' ? { depthMin: v, depthMax: Math.max(v + 1, s.depthMax) } : { depthMax: v, depthMin: Math.min(v - 1, s.depthMin) };
      if (patch.depthMin < 0) patch.depthMin = 0;
      FN.map.update(patch); renderLayers();
    }
  });
  document.addEventListener('input', e => { if (e.target.dataset.range === 'opacity') FN.map.update({ opacity: Number(e.target.value) }); });

  function toggleFav() {
    if (!S.lake) return;
    const i = S.favorites.findIndex(f => f.id === S.lake.id);
    if (i >= 0) { S.favorites.splice(i, 1); toast('Removed from favorites'); }
    else { S.favorites.unshift({ id: S.lake.id, name: S.lake.name, county: S.lake.county, town: S.lake.town, acres: S.lake.acres, maxDepth: S.lake.maxDepth }); toast('Saved to favorites ★'); }
    U.store.set(K.favorites, S.favorites); rerender();
  }

  /* ---------- top bar & fabs ---------- */
  $('#btn-home').addEventListener('click', goHome);
  $('#btn-top').addEventListener('click', openTop);
  $('#fab-locate').addEventListener('click', locateNearby);
  $('#fab-pin').addEventListener('click', () => { const m = $('#pin-menu'); if (m.classList.contains('hidden')) { m.innerHTML = FN.ui.pinMenu(); m.classList.remove('hidden'); $('#layers-panel').classList.add('hidden'); $('#legend').classList.add('hidden'); } else closePinMenu(); });
  $('#fab-zoomin').addEventListener('click', () => FN.map.getMap().zoomIn());
  $('#fab-zoomout').addEventListener('click', () => FN.map.getMap().zoomOut());
  $('#fab-layers').addEventListener('click', () => { renderLayers(); $('#layers-panel').classList.toggle('hidden'); $('#legend').classList.add('hidden'); closePinMenu(); });
  $('#fab-legend').addEventListener('click', () => { $('#legend').classList.toggle('hidden'); $('#layers-panel').classList.add('hidden'); closePinMenu(); });
  function renderLayers() { $('#layers-panel').innerHTML = FN.ui.layersPanel(FN.map.getSettings()); }
  $('#legend').innerHTML = FN.ui.legend();

  /* ---------- boot ---------- */
  function routeFromHash() {
    const m = location.hash.match(/lake\/(\d{8})/);
    if (m) openLake(m[1]);
    else if (location.hash === '#top') openTop();
    else if (S.view === 'lake' || S.view === 'top') goHome();
  }
  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/lake\/(\d{8})/);
    if (m && (!S.lake || S.lake.id !== m[1] || S.view !== 'lake')) openLake(m[1]);
    else if (location.hash === '#top' && S.view !== 'top') openTop();
    else if (!m && location.hash !== '#top' && (S.view === 'lake' || S.view === 'top')) goHome();
    if (S.view === 'pin' && !m) leavePinEditor();
  });

  FN.map.init('map');
  FN.map.renderPins(S.pins, FN.ui.pinPopup);
  render();
  if (S.lastLake) {
    // Show a bite forecast for the last lake while the user decides
    FN.dnr.byId(S.lastLake.id).then(l => { if (l && l.lat != null && !S.homeBite) loadHomeBite(l.lat, l.lon, l.name); }).catch(() => {});
  }
  routeFromHash();
  if (window.matchMedia('(max-width: 899px)').matches) setSheet(location.hash ? 'half' : 'half');

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // When an updated service worker takes over, reload once so the new version is what's on screen
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !navigator.serviceWorker.controller) return;
      reloaded = true; location.reload();
    });
  }
  window.addEventListener('offline', () => toast('You are offline — cached lakes still work, live data will not update.'));
  FN.app = { openLake, goHome, addPin, state: S };
})();
