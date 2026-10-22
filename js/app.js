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
    rankings: null, lakeMetrics: null,
    bestbet: { species: U.store.get('fn.bestSpecies', 'WAE'), items: [], loading: false, error: null, source: null, days: [], computed: 0, sig: '', expanded: false, cache: new Map() },
    finder: Object.assign({ species: 'WAE', mode: 'big', scope: 'state', radius: 50, county: '', minLen: 0, limit: 20 }, U.store.get(K.finder, {})),
    user: null, profile: null, authMode: 'signin', authMsg: null, authEmail: '', authBusy: false, syncing: false, lastSync: null,
    catches: U.store.get(K.catches, []), tomb: Object.assign({ pins: [], catches: [], favorites: [] }, U.store.get(K.tomb, {})),
    catchForm: null, catchPhotoFile: null, catchBusy: false, openCatch: null, buddies: null,
    welcome: false, welcomeSeen: U.store.get('fn.welcome', false),
    profileRange: null, installPrompt: null, a2hsDismissed: U.store.get('fn.a2hs', false)
  };
  let reqId = 0;

  /* ---------- rendering ---------- */
  const body = $('#sheet-body');
  function render() {
    const scroll = body.scrollTop;
    const pinToEdit = S.view === 'pin' ? S.pins.find(p => p.id === S.editPin) : null;
    body.innerHTML = pinToEdit ? FN.ui.pinEditor(Object.assign({}, pinToEdit, S.editColor ? { color: S.editColor } : {}))
      : S.view === 'top' ? FN.ui.finder(S)
      : S.view === 'quick' ? FN.ui.quickForecast(S)
      : S.view === 'account' ? FN.ui.account(S)
      : S.view === 'profile' ? FN.ui.profile(S)
      : S.view === 'catch' ? FN.ui.catchForm(S)
      : S.view === 'catches' ? FN.ui.catches(S)
      : S.view === 'buddies' ? FN.ui.buddies(S)
      : S.view === 'report' ? FN.ui.reportForm(S)
      : (S.view === 'lake' && S.lake ? FN.ui.lake(S) : FN.ui.home(S));
    if (S._keepScroll) body.scrollTop = scroll; else body.scrollTop = 0;
    S._keepScroll = false;
    if (body.querySelector('img[data-photo]')) setTimeout(hydratePhotos, 0);
    const fb = document.getElementById('fab-forecast'); if (fb) fb.classList.toggle('on', S.view === 'quick');
    updateAvatar();
  }
  function updateAvatar() {
    const b = document.getElementById('btn-profile'); if (!b) return;
    const ini = FN.ui.initials(S);
    b.classList.toggle('signed', !!ini); b.classList.toggle('on', S.view === 'profile');
    b.querySelector('.ini').textContent = ini || '';
    b.title = ini ? `${(S.profile && S.profile.display_name) || S.user.email} · profile` : 'Profile';
  }
  function openProfile() {
    if (S.view !== 'profile') S.prevView = S.view;
    S.view = 'profile'; location.hash = 'profile'; document.title = 'Profile · Fish Nasty';
    if (cloudOn() && !S.buddies) loadBuddies(true).catch(() => {});
    render(); showPanel(); if (isMobile()) setSheet('full');
  }
  function exportCatches() {
    if (!S.catches.length) { toast('No catches to export yet'); return; }
    const blob = new Blob(['\ufeff' + FN.ui.catchesCSV(S.catches)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fish-nasty-catches-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast(`${S.catches.length} catch${S.catches.length === 1 ? '' : 'es'} exported`);
  }
  // Several data loads can land within a few milliseconds of each other; rebuild the panel once per frame
  let renderQueued = false, renderRaf = 0, renderTimer = 0;
  function rerender() {
    S._keepScroll = true;
    if (renderQueued) return;
    renderQueued = true;
    const go = () => { cancelAnimationFrame(renderRaf); clearTimeout(renderTimer); renderQueued = false; if (S._keepScroll) render(); };
    renderRaf = requestAnimationFrame(go);
    renderTimer = setTimeout(go, 60); // animation frames pause in background tabs; never wait on them
  }

  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), ms);
  }

  /* ---------- sheet ---------- */
  const sheet = $('#sheet');
  const SNAPS = ['collapsed', 'half', 'full', 'custom'];
  // The sheet is always laid out at its full height and slid down by --off px (compositor-only, so it stays smooth on phones)
  let sheetCustom = 0;                                                    // visible px when the user leaves it somewhere in between
  const sheetFull = () => sheet.getBoundingClientRect().height;           // translate does not change the measured height
  const sheetSab = () => parseFloat(getComputedStyle(sheet).paddingBottom) || 0;
  const halfVisible = () => Math.round(window.innerHeight * 0.46);
  const visibleFor = state => state === 'collapsed' ? 72 + sheetSab() : state === 'half' ? halfVisible() : state === 'custom' ? (sheetCustom || halfVisible()) : sheetFull();
  const setOffset = visible => sheet.style.setProperty('--off', Math.max(0, Math.round(sheetFull() - visible)) + 'px');
  function applySheet() {
    if (!isMobile()) { sheet.style.removeProperty('--off'); return; }
    setOffset(visibleFor(SNAPS.find(s => sheet.classList.contains(s)) || 'half'));
  }
  function setSheet(state) { sheet.classList.remove(...SNAPS); sheet.classList.add(state); sheet.style.height = ''; applySheet(); showPanel(); }
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(applySheet, 80); });
  const maxSheetHeight = () => { const tb = $('.topbar').getBoundingClientRect(); return Math.max(120, window.innerHeight - tb.bottom - 12); };
  function showPanel() { document.getElementById('app').classList.remove('panel-closed'); $('#panel-open').classList.add('hidden'); }
  // The X slides the panel off screen on every device; the "Panel" tab (or any lake, search result, pin or tool) brings it back
  function closePanel() {
    document.getElementById('app').classList.add('panel-closed');
    if (!isMobile()) $('#panel-open').classList.remove('hidden');   // phones: no tab; any lake, pin, search result, tool or the avatar brings the panel back
    FN.map.getMap().invalidateSize();
  }
  (function dragSetup() {
    const handle = $('#sheet-handle'), body = $('#sheet-body');
    const visibleNow = () => window.innerHeight - sheet.getBoundingClientRect().top;
    let startY = 0, startVis = 0, lastY = 0, lastT = 0, vel = 0, dragging = false, moved = false;
    function begin(y) { dragging = true; moved = false; startY = lastY = y; lastT = performance.now(); vel = 0; startVis = visibleNow(); sheet.classList.add('dragging'); }
    function move(y) {
      const dy = y - startY; if (Math.abs(dy) > 4) moved = true;
      const now = performance.now(); if (now - lastT > 0) vel = (y - lastY) / (now - lastT); lastY = y; lastT = now;   // px per ms, + = down
      setOffset(U.clamp(startVis - dy, 40, sheetFull()));
    }
    function finish(tapCycles) {
      if (!dragging) return; dragging = false; sheet.classList.remove('dragging');
      const vis = visibleNow(), max = sheetFull(), half = halfVisible(), cur = SNAPS.find(s => sheet.classList.contains(s)) || 'half';
      if (!moved) { if (tapCycles) setSheet(cur === 'collapsed' ? 'half' : cur === 'half' ? 'full' : 'half'); else applySheet(); return; }   // tap on the bar: collapsed -> half -> full -> half
      if (vel > 0.6) { if (vis > half + 60) setSheet('half'); else closePanel(); return; }     // quick flick down: full -> half, anything lower -> closed
      if (vel < -0.6) { setSheet('full'); return; }                                           // quick flick up
      if (vis < half * 0.5) closePanel();                                                     // dragged most of the way down: close
      else if (vis > max - 40) setSheet('full');
      else { sheetCustom = Math.round(vis); sheet.classList.remove(...SNAPS); sheet.classList.add('custom'); applySheet(); }   // leave it where it was dropped
    }
    // The bar: drag to resize, tap to cycle
    handle.addEventListener('pointerdown', e => { if (!isMobile()) return; begin(e.clientY); handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', e => { if (dragging) move(e.clientY); });
    const end = () => finish(true);
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    // The content: when it is scrolled to the top, pulling down drags the sheet instead of over-scrolling (swipe down to close)
    let tracking = false, took = false, tx = 0, ty = 0;
    body.addEventListener('touchstart', e => {
      if (!isMobile() || e.touches.length !== 1 || e.target.closest('input, textarea, select, svg')) { tracking = false; return; }
      tracking = true; took = false; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    }, { passive: true });
    body.addEventListener('touchmove', e => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!took) {
        const dx = t.clientX - tx, dy = t.clientY - ty;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;                                                 // too early to tell
        if (body.scrollTop > 0 || dy <= 0 || Math.abs(dx) > Math.abs(dy)) { tracking = false; return; }   // a normal scroll or a sideways swipe: leave it to the browser
        took = true; begin(t.clientY);
      }
      if (e.cancelable) e.preventDefault();
      move(t.clientY);
    }, { passive: false });
    const endTouch = () => { if (took) finish(false); tracking = false; took = false; };
    body.addEventListener('touchend', endTouch); body.addEventListener('touchcancel', endTouch);
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
    S.detail = S.stocking = S.access = S.weather = S.bite = null; S.bathy = null; S.history = null; S.dayIdx = 0; S.hourIdx = null; S.surveyIdx = 0;
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
    if (window.matchMedia('(max-width: 899px)').matches) setSheet('full');   // a lake opens full screen; pull the bar down to see the map
    FN.map.showLake(lake, { fit });   // after the sheet is sized, so the lake is framed in the part of the map the half-height sheet leaves visible
    FN.map.showAccess([]);
    render();

    // Load everything in parallel; render as each arrives
    FN.dnr.detail(lake.id).then(d => { if (my !== reqId) return; S.detail = d; S.loading.detail = false; if (d && !lake.species.length) { lake.species = latestSpeciesNames(d); lake.speciesCodes = lake.species.map(FN.speciesCode).filter(Boolean); } computeBite(); rerender(); })
      .catch(e => { if (my !== reqId) return; S.errors.detail = 'Could not load the DNR survey: ' + e.message; S.loading.detail = false; rerender(); });
    (lake.resources.fishStocking ? FN.dnr.stocking(lake.id) : Promise.resolve({ rows: [], notes: {} }))
      .then(st => { if (my !== reqId) return; S.stocking = st; S.loading.stocking = false; rerender(); })
      .catch(e => { if (my !== reqId) return; S.errors.stocking = 'Could not load stocking data: ' + e.message; S.loading.stocking = false; rerender(); });
    FN.dnr.bathyMeta(lake.id).then(b => { if (my !== reqId) return; S.bathy = b || { none: true }; rerender(); }).catch(() => {});
    FN.dnr.accessSites(lake).then(a => { if (my !== reqId) return; S.access = a; S.loading.access = false; FN.map.showAccess(a); rerender(); })
      .catch(() => { if (my !== reqId) return; S.access = []; S.loading.access = false; rerender(); });
    if (lake.lat != null) {
      Promise.all([FN.weather.forecast(lake.lat, lake.lon), FN.weather.history(lake.lat, lake.lon).catch(() => null)])
        .then(([w, hist]) => { if (my !== reqId) return; S.weather = w; S.history = hist; S.loading.weather = false; computeBite(); rerender(); })
        .catch(e => { if (my !== reqId) return; S.errors.weather = 'Weather unavailable: ' + e.message; S.loading.weather = false; rerender(); });
    } else { S.loading.weather = false; S.errors.weather = 'No coordinates for this lake.'; }
  }
  const latestSpeciesNames = d => { const s = d.surveys.find(x => x.catches.length); return s ? [...new Set(s.catches.map(c => c.name))] : []; };

  function lakeCtx() {
    const L = S.lake, D = S.detail;
    return { history: S.history, acres: (D && D.areaAcres) || (L && L.acres) || null, maxDepth: (D && D.maxDepth) || (L && L.maxDepth) || null, clarity: (D && D.avgClarity) || null };
  }
  function computeBite() {
    if (!S.weather || !S.lake) return;
    let sp = S.species;
    if (sp !== 'ALL' && !S.lake.speciesCodes.includes(sp)) sp = 'ALL';
    S.bite = FN.forecast.compute(S.weather, S.lake.lat, S.lake.lon, sp, S.catches, lakeCtx());
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
    if (isMobile() && sheet.classList.contains('full')) setSheet('half');   // home shows the map again
    if (S.favorites.length) runBestBet('favorites').catch(() => {});
  }

  /* ---------- best bet this weekend ---------- */
  function weekendDays() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = today.getDay(); // 0 Sun … 6 Sat
    if (dow === 0) return [today];
    const sat = new Date(today.getTime() + ((6 - dow) % 7) * 864e5);
    const sun = new Date(sat.getTime() + 864e5);
    return [sat, sun];
  }
  const milesBetween = (a, b) => { const R = 3958.8, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  async function bestBetCandidates(source) {
    const BB = S.bestbet;
    let metrics = S.lakeMetrics;
    if (!metrics && FN.cloud.available()) { try { metrics = S.lakeMetrics = await FN.cloud.lakeMetrics(); } catch (e) { metrics = null; } }
    const rowsFor = id => metrics ? metrics.rows.filter(r => r.id === id) : [];
    const list = [];
    if (source === 'favorites') {
      for (const f of S.favorites.slice(0, 12)) {
        let lat = f.lat, lon = f.lon, acres = f.acres, maxDepth = f.maxDepth;
        const m = rowsFor(f.id)[0];
        if (m) { lat = m.lat; lon = m.lon; acres = acres || m.acres; maxDepth = maxDepth || m.maxDepth; }
        if (lat == null) { try { const l = await FN.dnr.byId(f.id); if (l) { lat = l.lat; lon = l.lon; acres = acres || l.acres; maxDepth = maxDepth || l.maxDepth; } } catch (e) { /* skip */ } }
        if (lat != null) list.push({ id: f.id, name: f.name, county: f.county, lat, lon, acres, maxDepth });
      }
    } else {
      const map = FN.map.getMap();
      const here = S.location ? { lat: S.location.lat, lon: S.location.lon } : { lat: map.getCenter().lat, lon: map.getCenter().lng };
      BB.center = S.location ? 'you' : 'the map center';
      if (!metrics) throw new Error('Lake data is not available offline yet.');
      const sp = BB.species === 'ALL' ? 'WAE' : BB.species;
      // Candidates: lakes within 50 miles with a real sample behind their numbers, ranked by size of fish,
      // catch rate and lake size so tiny ponds with four netted fish don't float to the top
      const minN = { WAE: 30, NOP: 20, BLC: 30 }[sp] || 30;
      const near = metrics.rows
        .filter(r => r.species === sp && r.lat != null && (r.acres || 0) >= 200 && ((r.n || 0) >= minN || ((r.cpue || 0) >= 3 && (r.nets || 0) >= 3)))
        .map(r => ({ ...r, dist: milesBetween(here, r) })).filter(r => r.dist <= 50);
      const quality = r => (((r.n || 0) >= minN ? (r.pctBig || 0) : 0) + Math.min(r.cpue || 0, 30) * 1.5) * Math.log10(Math.max(10, r.acres || 10));
      near.sort((a, b) => quality(b) - quality(a));
      for (const r of near.slice(0, 10)) list.push({ id: r.id, name: r.name, county: r.county, lat: r.lat, lon: r.lon, acres: r.acres, maxDepth: r.maxDepth, dist: r.dist });
    }
    return list;
  }
  function metricLine(id, species) {
    const sp = species === 'ALL' ? 'WAE' : species;
    const m = S.lakeMetrics && S.lakeMetrics.rows.find(r => r.id === id && r.species === sp);
    if (!m) return '';
    const name = (FN.profileFor(sp) || {}).name || sp;
    const big = { WAE: 20, NOP: 30, BLC: 11 }[sp];
    const parts = [];
    if (m.n) parts.push(`${m.pctBig}% of ${U.num(m.n)} netted ${name.toLowerCase()} were ${big}″+, longest ${m.max}″`);
    if (m.cpue) parts.push(`${U.num(m.cpue, 1)} per net (${m.year})`);
    return parts.join(' · ');
  }
  async function runBestBet(source, force) {
    const BB = S.bestbet;
    source = source || (S.favorites.length ? 'favorites' : null);
    if (!source) return;
    const sig = `${source}:${S.favorites.map(f => f.id).join(',')}:${BB.species}`;
    if (!force && BB.sig === sig && Date.now() - BB.computed < 60 * 60000) return;
    BB.loading = true; BB.error = null; BB.source = source; BB.days = weekendDays(); rerender();
    try {
      const cands = await bestBetCandidates(source);
      BB.total = cands.length;
      const results = await Promise.all(cands.map(async c => {
        try {
          let w = BB.cache.get(c.id);
          if (!w || Date.now() - w.t > 30 * 60000) {
            const [weather, history] = await Promise.all([FN.weather.forecast(c.lat, c.lon), FN.weather.history(c.lat, c.lon).catch(() => null)]);
            w = { t: Date.now(), weather, history }; BB.cache.set(c.id, w);
          }
          const bite = FN.forecast.compute(w.weather, c.lat, c.lon, BB.species, S.catches, { history: w.history, acres: c.acres, maxDepth: c.maxDepth });
          const scores = BB.days.map(day => { const d = bite.days.find(x => U.sameDay(x.date, day)); return d ? { day: day.toLocaleDateString('en-US', { weekday: 'short' }), score: d.score, rating: d.rating, window: d.windows[0] ? FN.ui.windowText(d.windows[0]) : '' } : null; }).filter(Boolean);
          if (!scores.length) return null;
          const best = Math.max(...scores.map(s => s.score));
          return { id: c.id, name: c.name, county: c.county, dist: c.dist, scores, best, metric: metricLine(c.id, BB.species) };
        } catch (e) { return null; }
      }));
      BB.items = results.filter(Boolean).sort((a, b) => b.best - a.best);
      BB.sig = sig; BB.computed = Date.now();
    } catch (e) { BB.error = e.message; }
    BB.loading = false;
    if (S.view === 'home') rerender();
  }

  /* ---------- quick bite forecast for wherever you are looking ---------- */
  async function openQuick(source) {
    closeSearch(); closePinMenu(); $('#layers-panel').classList.add('hidden'); $('#legend').classList.add('hidden');
    const map = FN.map.getMap();
    let lat, lon, label = null;
    if (source === 'gps-cached' && S.location) { lat = S.location.lat; lon = S.location.lon; source = 'gps'; }
    else if (source === 'gps') {
      try { const loc = await FN.map.locate(); S.location = loc; lat = loc.lat; lon = loc.lon; }
      catch (e) { toast(e.code === 1 ? 'Location permission denied. Using the map center instead.' : 'Could not get your location. Using the map center.'); source = 'center'; }
    }
    if (source !== 'gps') { const c = map.getCenter(); lat = c.lat; lon = c.lng; }
    const near = FN.map.nearestLakeName(lat, lon);
    const same = S.quick && S.quick.weather && Math.abs(S.quick.lat - lat) < 0.01 && Math.abs(S.quick.lon - lon) < 0.015;
    S.quick = { source, lat, lon, near: near ? near.name : null, nearDow: near ? near.dow : null, weather: same ? S.quick.weather : null, bite: same ? S.quick.bite : null, loading: !same, error: null, codes: ['WAE', 'NOP', 'BLC', 'MUE', 'LMB', 'SMB', 'BLG', 'YEP', 'LAT'] };
    S.view = 'quick'; S.dayIdx = 0; S.hourIdx = null;
    render(); if (isMobile()) setSheet('full');
    if (same) return;
    try {
      const [w, hist] = await Promise.all([FN.weather.forecast(lat, lon), FN.weather.history(lat, lon).catch(() => null)]);
      if (S.view !== 'quick' || S.quick.lat !== lat) return;
      S.quick.weather = w; S.quick.history = hist; computeQuickBite();
    } catch (e) { S.quick.error = 'Weather unavailable: ' + e.message; }
    S.quick.loading = false;
    if (S.view === 'quick') rerender();
  }
  function computeQuickBite() {
    if (!S.quick || !S.quick.weather) return;
    const sp = S.species !== 'ALL' && S.quick.codes.includes(S.species) ? S.species : 'ALL';
    S.quick.bite = FN.forecast.compute(S.quick.weather, S.quick.lat, S.quick.lon, sp, S.catches, { history: S.quick.history });
  }

  /* ---------- lake finder (Top 20 + filters) ---------- */
  async function openTop() {
    closeSearch();
    S.view = 'top'; location.hash = 'top'; document.title = 'Lake finder · Fish Nasty';
    render();
    if (isMobile()) setSheet('full');
    if (!S.rankings && !S.loading.rankings) {
      S.loading.rankings = true;
      fetch('data/rankings.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(j => { S.rankings = j; }).catch(() => {})
        .finally(() => { S.loading.rankings = false; if (S.view === 'top' && !S.lakeMetrics) rerender(); });
    }
    if (!S.lakeMetrics && !S.loading.metrics && FN.cloud.available()) {
      S.loading.metrics = true; rerender();
      try { S.lakeMetrics = await FN.cloud.lakeMetrics(); } catch (e) { S.errors.metrics = e.message; }
      S.loading.metrics = false;
      if (S.view === 'top') rerender();
    }
  }

  /* ---------- cloud: sign-in & sync ---------- */
  const cloudOn = () => FN.cloud.available() && !!S.user;
  const saveFinder = () => U.store.set(K.finder, { species: S.finder.species, mode: S.finder.mode, scope: S.finder.scope, radius: S.finder.radius, county: S.finder.county, minLen: S.finder.minLen });
  function setAuthMsg(kind, text) { S.authMsg = text ? { kind, text } : null; }
  async function handleAuthForm(form) {
    const mode = S.authMode || 'signin';
    const val = id => { const el = form.querySelector('#' + id); return el ? el.value : ''; };
    const email = val('auth-email').trim(), password = val('auth-password'), name = val('auth-name').trim();
    S.authEmail = email; S.authBusy = true; setAuthMsg(null); rerender();
    try {
      if (mode === 'signin') { await FN.cloud.signIn(email, password); S.welcome = false; U.store.set('fn.welcome', true); }
      else if (mode === 'signup') {
        const d = await FN.cloud.signUp(email, password, name);
        if (d && d.session) setAuthMsg('ok', 'Account created — you are signed in.');
        else { setAuthMsg('ok', `Check ${email} for a confirmation link, then come back and sign in.`); S.authMode = 'signin'; }
      }
      else if (mode === 'magic') { await FN.cloud.magicLink(email); setAuthMsg('ok', `Sign-in link sent to ${email}. Open it on this device.`); }
      else if (mode === 'reset') { await FN.cloud.resetPassword(email); setAuthMsg('ok', `Password reset link sent to ${email}.`); S.authMode = 'signin'; }
    } catch (e) { setAuthMsg('err', e.message || 'Something went wrong.'); }
    S.authBusy = false; rerender();
  }
  async function onAuth(event, user) {
    const was = S.user;
    S.user = user || null;
    if (event === 'PASSWORD_RECOVERY') { S.view = 'account'; setAuthMsg('ok', 'You are signed in — set a new password below.'); render(); return; }
    if (S.user && (!was || was.id !== S.user.id || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      try { S.profile = await FN.cloud.getProfile(true); } catch (e) { S.profile = null; }
      if (S.view === 'account' && (event === 'SIGNED_IN' || S.welcome)) { S.welcome = false; U.store.set('fn.welcome', true); S.view = S.prevView && S.prevView !== 'account' ? S.prevView : 'home'; if (event === 'SIGNED_IN') toast(`Signed in as ${(S.profile && S.profile.display_name) || S.user.email}`); if (isMobile()) setSheet('half'); }
      rerender();
      syncAll().catch(e => console.warn('sync failed', e));
      loadBuddies(true).catch(() => {});
    } else if (!S.user && was) {
      S.profile = null; S.buddies = null; S.lastSync = null;
      if (['buddies', 'account', 'report'].includes(S.view)) S.view = 'home';
      render();
    } else rerender();
  }
  let pushTimer = null;
  function queuePush() {
    if (!cloudOn()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { FN.cloud.pushPins(S.pins).catch(() => {}); FN.cloud.pushFavorites(S.favorites).catch(() => {}); }, 1200);
  }
  async function syncAll() {
    if (!cloudOn() || S.syncing) return;
    S.syncing = true; if (['home', 'account'].includes(S.view)) rerender();
    try {
      // 1. deletions made while offline
      await FN.cloud.deletePins(S.tomb.pins); await FN.cloud.deleteCatches(S.tomb.catches); await FN.cloud.deleteFavorites(S.tomb.favorites);
      S.tomb = { pins: [], catches: [], favorites: [] }; U.store.set(K.tomb, S.tomb);
      // 2. pins: newest copy wins; pins deleted on another device disappear here too
      const serverPins = await FN.cloud.pullPins();
      const serverIds = new Set(serverPins.map(p => p.id));
      const local = new Map(S.pins.filter(p => !(p.serverId && !serverIds.has(p.id))).map(p => [p.id, p]));
      for (const sp of serverPins) {
        const lp = local.get(sp.id);
        if (!lp) local.set(sp.id, sp);
        else if ((sp.updated || sp.created) > (lp.updated || lp.created)) local.set(sp.id, Object.assign(lp, sp));
        else lp.serverId = sp.serverId;
      }
      S.pins = [...local.values()].sort((a, b) => (a.created < b.created ? 1 : -1));
      U.store.set(K.pins, S.pins); FN.map.renderPins(S.pins, FN.ui.pinPopup);
      await FN.cloud.pushPins(S.pins);
      // 3. favorites: union
      const serverFavs = await FN.cloud.pullFavorites();
      const have = new Set(S.favorites.map(f => f.id));
      for (const f of serverFavs) if (!have.has(f.id)) S.favorites.push(f);
      U.store.set(K.favorites, S.favorites);
      await FN.cloud.pushFavorites(S.favorites);
      // 4. catches: merge, upload any photos still only on this device
      const serverCatches = await FN.cloud.pullCatches();
      const sIds = new Set(serverCatches.map(c => c.id));
      const lc = new Map(S.catches.filter(c => !(c.serverId && !sIds.has(c.id))).map(c => [c.id, c]));
      for (const sc of serverCatches) {
        const l = lc.get(sc.id);
        if (!l) lc.set(sc.id, sc);
        else if (l.synced !== false && (sc.updated || sc.created) > (l.updated || l.created)) lc.set(sc.id, Object.assign(l, sc));
        else l.serverId = sc.serverId;
      }
      S.catches = [...lc.values()];
      // Keep catch ↔ pin links intact across devices: fill in whichever id is missing
      for (const c of S.catches) {
        if (!c.pinId && c.pinServerId) { const p = S.pins.find(x => x.serverId === c.pinServerId); if (p) { c.pinId = p.id; c.pinName = c.pinName || p.name; } }
        if (c.pinId && !c.pinServerId) { const p = pinById(c.pinId); if (p && p.serverId) c.pinServerId = p.serverId; }
      }
      for (const c of S.catches) if (c.photoLocal && !c.photoPath) { try { c.photoPath = await FN.cloud.uploadPhoto(dataURLToBlob(c.photoLocal), c.id); delete c.photoLocal; } catch (e) { /* try next time */ } }
      const pushed = await FN.cloud.pushCatches(S.catches);
      const idMap = new Map((pushed || []).map(r => [r.client_id, r.id]));
      for (const c of S.catches) { c.synced = true; if (idMap.get(c.id)) c.serverId = idMap.get(c.id); }
      U.store.set(K.catches, S.catches);
      S.lastSync = new Date();
    } finally {
      S.syncing = false;
      if (['home', 'account', 'catches', 'lake'].includes(S.view)) rerender();
    }
  }
  function dataURLToBlob(dataUrl) {
    const [h, b64] = dataUrl.split(','); const mime = (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  async function hydratePhotos() {
    if (!FN.cloud.available()) return;
    for (const img of body.querySelectorAll('img[data-photo]:not([src])')) {
      const u = await FN.cloud.photoUrl(img.dataset.photo);
      if (u) img.src = u; else img.remove();
    }
  }

  /* ---------- catch log ---------- */
  function openCatchForm(opts = {}) {
    const pin = opts.pinId ? pinById(opts.pinId) : null;
    const lake = S.lake;
    const existing = opts.id ? S.catches.find(c => c.id === opts.id) : null;
    if (S.view !== 'catch') S.prevView = S.view;
    S.catchForm = existing ? Object.assign({}, existing) : {
      id: null, species: (lake && ['WAE', 'NOP', 'BLC'].find(c => lake.speciesCodes.includes(c))) || 'WAE',
      lakeId: pin ? (pin.lakeId || (lake && lake.id) || null) : (lake ? lake.id : null),
      lakeName: pin ? (pin.lakeName || (lake && lake.name) || null) : (lake ? lake.name : null),
      pinId: pin ? pin.id : null, pinServerId: pin ? pin.serverId || null : null, pinName: pin ? pin.name : null,
      lat: pin ? pin.lat : (opts.lat || null), lon: pin ? pin.lon : (opts.lon || null),
      caughtAt: new Date().toISOString(), shared: false, released: false, notes: '', bait: '', length: null, weight: null
    };
    if (!existing && S.catchForm.lat == null && S.location) { S.catchForm.lat = S.location.lat; S.catchForm.lon = S.location.lon; }
    S.catchPhotoFile = null;
    S.view = 'catch'; render(); if (isMobile()) setSheet('full');
  }
  async function saveCatch(form) {
    const f = S.catchForm; if (!f) return;
    const val = id => { const el = form.querySelector('#' + id); return el ? el.value : ''; };
    f.length = parseFloat(val('catch-length')) || null; f.weight = parseFloat(val('catch-weight')) || null;
    f.bait = val('catch-bait').trim(); f.notes = val('catch-notes').trim();
    const when = val('catch-when'); if (when) f.caughtAt = new Date(when).toISOString();
    f.released = !!(form.querySelector('#catch-released') || {}).checked; f.shared = !!(form.querySelector('#catch-shared') || {}).checked;
    S.catchBusy = true; rerender();
    try {
      if (!f.id) { f.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); f.created = new Date().toISOString(); }
      f.updated = new Date().toISOString(); f.speciesName = FN.speciesName(f.species);
      if (!f.conditions || f.conditions.biteScore == null) f.conditions = await conditionsAt(new Date(f.caughtAt), f.lat != null ? f.lat : (S.lake && S.lake.lat), f.lon != null ? f.lon : (S.lake && S.lake.lon), f.species);
      if (S.catchPhotoFile) {
        if (cloudOn()) { try { f.photoPath = await FN.cloud.uploadPhoto(S.catchPhotoFile, f.id); delete f.photoLocal; } catch (e) { f.photoLocal = f.photoPreview; toast('Photo kept on this device; it uploads on the next sync'); } }
        else f.photoLocal = f.photoPreview;
      }
      delete f.photoPreview; f.synced = false;
      const i = S.catches.findIndex(c => c.id === f.id); if (i >= 0) S.catches[i] = f; else S.catches.unshift(f);
      U.store.set(K.catches, S.catches);
      if (cloudOn()) { try { const r = await FN.cloud.pushCatches([f]); f.synced = true; if (r && r[0]) f.serverId = r[0].id; U.store.set(K.catches, S.catches); } catch (e) { toast('Saved on this device; it syncs when you are back online'); } }
      toast(i >= 0 ? 'Catch updated' : 'Catch logged 🎣');
      S.catchForm = null; S.catchPhotoFile = null; S.catchBusy = false;
      S.view = S.prevView && S.prevView !== 'catch' ? S.prevView : 'home';
      if (S.view === 'lake' && !S.lake) S.view = 'home';
      if (S.view === 'pin') S.view = 'home';
      computeBite(); render();
      // Logged from a pin: land back on that pin so the new tally is right there
      if (f.pinId && i < 0 && S.view !== 'catches' && pinById(f.pinId)) { if (isMobile()) setSheet('collapsed'); FN.map.openPin(f.pinId); }
    } catch (e) { S.catchBusy = false; toast('Could not save: ' + e.message); rerender(); }
  }
  // Weather, barometer, moon and bite score at the moment of the catch
  async function conditionsAt(date, lat, lon, species) {
    const out = { hour: date.getHours(), month: date.getMonth() + 1, season: FN.seasonOf(date) };
    try {
      if (lat == null || lon == null) return out;
      const info = FN.solunar.dayInfo(date, lat, lon);
      out.moonPhase = info.phase; out.moonName = info.phaseName; out.solunar = Math.round(FN.solunar.strengthAt(date, info) * 100) / 100;
      let bite = (S.bite && S.lake && Math.abs(S.lake.lat - lat) < 0.05 && Math.abs(S.lake.lon - lon) < 0.08) ? S.bite : null;
      if (!bite) { const [weather, history] = await Promise.all([FN.weather.forecast(lat, lon), FN.weather.history(lat, lon).catch(() => null)]); bite = FN.forecast.compute(weather, lat, lon, species || 'ALL', S.catches, { history }); }
      const h = bite.hours.reduce((best, x) => (Math.abs(x.t - date) < Math.abs(best.t - date) ? x : best), bite.hours[0]);
      if (Math.abs(h.t - date) <= 2 * 3600 * 1000) {
        const w = h.weather;
        Object.assign(out, { temp: w.temp, pressure: w.pressure, wind: w.wind, windDir: w.windDir, gust: w.gust, cloud: w.cloud, code: w.code, precip: w.precip, biteScore: h.score });
        const pr = h.details.pressure || '';
        out.pressureTrend = pr.includes('falling') ? 'falling' : pr.includes('rising') ? 'rising' : 'steady';
      }
      // The day as a whole: high/low, sunrise/sunset, modeled water temperature
      const day = bite.days.find(d => FN.util.sameDay(d.date, date));
      if (day) {
        if (day.wx) { out.dayHi = day.wx.hi; out.dayLo = day.wx.lo; out.dayCode = day.wx.code; }
        if (day.water != null) out.waterTemp = Math.round(day.water * 10) / 10;
        out.sunrise = day.info.sunrise.toISOString(); out.sunset = day.info.sunset.toISOString();
        out.dayScore = day.score;
      } else if (bite.water && bite.water.today != null) out.waterTemp = Math.round(bite.water.today * 10) / 10;
    } catch (e) { /* partial conditions are fine */ }
    return out;
  }
  function deleteCatch(id) {
    const c = S.catches.find(x => x.id === id); if (!c) return;
    if (!confirm('Delete this catch?')) return;
    S.catches = S.catches.filter(x => x.id !== id); U.store.set(K.catches, S.catches);
    if (cloudOn()) FN.cloud.deleteCatches([id]).catch(() => { S.tomb.catches.push(id); U.store.set(K.tomb, S.tomb); });
    else if (c.synced) { S.tomb.catches.push(id); U.store.set(K.tomb, S.tomb); }
    if (S.view === 'catch') { S.catchForm = null; S.view = S.prevView && S.prevView !== 'catch' ? S.prevView : 'home'; }
    toast('Catch deleted'); computeBite(); render();
  }
  function photoChosen(file) {
    if (!file || !S.catchForm) return;
    S.catchPhotoFile = file;
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 640, s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      S.catchForm.photoPreview = cv.toDataURL('image/jpeg', 0.75);
      const input = body.querySelector('#catch-photo'); if (!input) return;
      let pv = input.parentNode.querySelector('.preview');
      if (!pv) { pv = document.createElement('div'); pv.className = 'preview'; input.parentNode.insertBefore(pv, input); }
      pv.innerHTML = `<img src="${S.catchForm.photoPreview}" alt=""><button type="button" class="btn small ghost" data-action="catch-photo-clear">Remove</button>`;
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that photo'); };
    img.src = url;
  }

  /* ---------- buddies ---------- */
  async function loadBuddies(quiet) {
    if (!cloudOn()) return;
    S.buddies = S.buddies || {}; S.buddies.error = null;
    if (!quiet) { S.buddies.loading = true; rerender(); }
    try {
      const [fr, feed, mine] = await Promise.all([FN.cloud.listFriendships(), FN.cloud.feed(), FN.cloud.myReports()]);
      S.buddies.friendships = fr; S.buddies.feed = feed; S.buddies.myReports = mine;
    } catch (e) { S.buddies.error = 'Could not load buddies: ' + e.message; }
    S.buddies.loading = false;
    if (S.view === 'buddies' || S.view === 'home') rerender();
  }
  function openBuddies() { S.prevView = 'home'; S.view = 'buddies'; render(); if (isMobile()) setSheet('full'); loadBuddies(false); }
  async function inviteBuddy(form) {
    const email = form.querySelector('#invite-email').value.trim();
    S.buddies = S.buddies || {};
    try {
      const r = await FN.cloud.invite(email);
      S.buddies.msg = { kind: 'ok', text: r.status === 'accepted' ? 'You are now buddies!' : r.registered ? `Request sent to ${email}.` : `${email} isn't on Fish Nasty yet. You'll be connected the moment they sign up with that email.` };
      form.reset();
    } catch (e) { S.buddies.msg = { kind: 'err', text: e.message }; }
    await loadBuddies(true); rerender();
  }
  async function respondBuddy(id, status) { try { await FN.cloud.respond(id, status); toast(status === 'accepted' ? 'Buddy added 👍' : 'Request declined'); } catch (e) { toast(e.message); } loadBuddies(true); }
  async function removeBuddy(id) { if (!confirm('Remove this buddy?')) return; try { await FN.cloud.removeFriendship(id); } catch (e) { toast(e.message); } loadBuddies(true); }
  function showFeedPin(lat, lon, name) {
    FN.map.flyTo(lat, lon, 14);
    setTimeout(() => FN.map.popup(L.latLng(lat, lon), `<strong>${U.esc(name)}</strong><br><span class="muted">shared by a buddy</span>`), 900);
    if (isMobile()) setSheet('collapsed');
  }
  async function postReport(form) {
    const text = form.querySelector('#report-body').value.trim(); if (!text) return;
    try { await FN.cloud.postReport(S.lake, text); toast('Report shared with your buddies'); S.view = S.lake ? 'lake' : 'home'; render(); loadBuddies(true); }
    catch (e) { toast(e.message); }
  }

  /* ---------- pins (waypoints) ---------- */
  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  function savePins() { U.store.set(K.pins, S.pins); FN.map.renderPins(S.pins, FN.ui.pinPopup); queuePush(); }
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
    const sh = $('#pin-shared'); if (sh) p.shared = sh.checked;
    p.updated = new Date().toISOString();
    savePins(); toast(p.shared && !cloudOn() ? 'Pin saved (sign in to share it)' : 'Pin saved'); leavePinEditor();
  }
  function deletePin(id) {
    const p = pinById(id); if (!p) return;
    if (!confirm(`Delete pin “${p.name}”?`)) return;
    S.pins = S.pins.filter(x => x.id !== id); savePins();
    if (cloudOn()) FN.cloud.deletePins([id]).catch(() => { S.tomb.pins.push(id); U.store.set(K.tomb, S.tomb); });
    else if (p.serverId) { S.tomb.pins.push(id); U.store.set(K.tomb, S.tomb); }
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
      const [w, hist] = await Promise.all([FN.weather.forecast(lat, lon), FN.weather.history(lat, lon).catch(() => null)]);
      S.homeWeather = w; S.homeBite = FN.forecast.compute(w, lat, lon, 'ALL', S.catches, { history: hist }); S.homeLabel = label;
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
      if (S.view === 'top') rerender();
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
  FN.map.onLabel(l => { if (!S.placeMode && l.dow) openLake(l.dow, { fit: false }); });
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
    if (a !== 'sheet-close' && a !== 'sheet-open') showPanel();
    switch (a) {
      case 'open-lake': openLake(el.dataset.id); break;
      case 'home': goHome(); break;
      case 'profile': openProfile(); break;
      case 'profile-range': S.profileRange = el.dataset.range; S._keepScroll = true; rerender(); break;
      case 'catch-species-filter': S.prevView = S.view; S.catchFilter = { species: el.dataset.code, name: el.dataset.name }; S.openCatch = null; S.view = 'catches'; render(); if (isMobile()) setSheet('full'); break;
      case 'catch-lake-filter': S.prevView = S.view; S.catchFilter = { lakeId: el.dataset.id || null, name: el.dataset.name }; S.openCatch = null; S.view = 'catches'; render(); if (isMobile()) setSheet('full'); break;
      case 'catch-export': exportCatches(); break;
      case 'a2hs-dismiss': S.a2hsDismissed = true; U.store.set('fn.a2hs', true); rerender(); break;
      case 'a2hs-install': { const ev = S.installPrompt; if (!ev) break; ev.prompt(); ev.userChoice.then(r => { if (r && r.outcome === 'accepted') { S.installPrompt = null; toast('Fish Nasty is on your home screen 📲'); rerender(); } }).catch(() => {}); break; }
      case 'tab': S.tab = el.dataset.tab; render(); if (window.matchMedia('(max-width: 899px)').matches) setSheet('full'); break;
      case 'fav': toggleFav(); break;
      case 'zoom-lake': FN.map.showLake(S.lake, { fit: true }); if (window.matchMedia('(max-width: 899px)').matches) setSheet('collapsed'); break;
      case 'species': S.species = el.dataset.code; U.store.set(K.species, S.species); S.hourIdx = null; computeBite(); computeQuickBite(); rerender(); break;
      case 'quick-center': openQuick('center'); break;
      case 'bestbet-species': S.bestbet.species = el.dataset.code; U.store.set('fn.bestSpecies', S.bestbet.species); runBestBet(S.bestbet.source, true); break;
      case 'bestbet-more': S.bestbet.expanded = !S.bestbet.expanded; rerender(); break;
      case 'bestbet-favorites': runBestBet('favorites', true); break;
      case 'bestbet-nearby': (async () => { if (!S.location) { try { S.location = await FN.map.locate(); } catch (e) { toast('Using the map center since location is off.'); } } runBestBet('nearby', true); })(); break;
      case 'quick-gps': openQuick('gps'); break;
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
      case 'account': if (S.view !== 'account') S.prevView = S.view; S.view = 'account'; setAuthMsg(null); render(); if (isMobile()) setSheet('full'); break;
      case 'auth-mode': S.authMode = el.dataset.mode; setAuthMsg(null); rerender(); break;
      case 'welcome-skip': S.welcome = false; S.welcomeSeen = true; U.store.set('fn.welcome', true); S.view = 'home'; render(); if (isMobile()) setSheet('half'); break;
      case 'sheet-close': closePanel(); break;
      case 'sheet-open': if (isMobile()) setSheet('half'); else showPanel(); FN.map.getMap().invalidateSize(); break;
      case 'signout': FN.cloud.signOut().then(() => toast('Signed out')); break;
      case 'sync-now': syncAll().then(() => toast('Synced')).catch(e => toast('Sync failed: ' + e.message)); break;
      case 'catches': S.prevView = S.view === 'profile' ? 'profile' : 'home'; S.catchFilter = null; S.view = 'catches'; render(); if (isMobile()) setSheet('full'); break;
      case 'catches-at-pin': { const p = pinById(el.dataset.id); FN.map.closePopups(); S.prevView = S.view === 'catches' ? S.prevView : S.view; S.catchFilter = p ? { pinId: p.id, name: p.name } : null; S.view = 'catches'; render(); if (isMobile()) setSheet('full'); break; }
      case 'catch-filter-clear': S.catchFilter = null; rerender(); break;
      case 'catch-new': FN.map.closePopups(); openCatchForm({ pinId: el.dataset.pinId, lat: el.dataset.lat ? Number(el.dataset.lat) : null, lon: el.dataset.lon ? Number(el.dataset.lon) : null }); break;
      case 'catch-edit': openCatchForm({ id: el.dataset.id }); break;
      case 'catch-cancel': S.catchForm = null; S.catchPhotoFile = null; S.view = S.prevView && S.prevView !== 'catch' ? S.prevView : 'home'; if (S.view === 'lake' && !S.lake) S.view = 'home'; render(); break;
      case 'catch-delete': deleteCatch(el.dataset.id); break;
      case 'catch-open': {
        S.openCatch = S.openCatch === el.dataset.id ? null : el.dataset.id;
        if (S.view !== 'catches') {   // tapped from a pin or lake page: open the log scoped to that spot, with this catch expanded
          const c = S.catches.find(x => x.id === el.dataset.id); const p = c && c.pinId ? pinById(c.pinId) : null;
          S.openCatch = el.dataset.id; S.prevView = S.view; S.catchFilter = p ? { pinId: p.id, name: p.name } : null; S.view = 'catches'; render(); if (isMobile()) setSheet('full'); break;
        }
        rerender(); break;
      }
      case 'catch-species': if (S.catchForm) { S.catchForm.species = el.dataset.code; body.querySelectorAll('[data-action="catch-species"]').forEach(b => b.classList.toggle('on', b === el)); } break;
      case 'catch-photo-clear': if (S.catchForm) { S.catchForm.photoPreview = null; S.catchForm.photoPath = null; S.catchForm.photoLocal = null; S.catchPhotoFile = null; const pv = el.closest('.preview'); if (pv) pv.remove(); const inp = body.querySelector('#catch-photo'); if (inp) inp.value = ''; } break;
      case 'buddies': openBuddies(); break;
      case 'buddy-accept': respondBuddy(el.dataset.id, 'accepted'); break;
      case 'buddy-decline': respondBuddy(el.dataset.id, 'declined'); break;
      case 'buddy-remove': removeBuddy(el.dataset.id); break;
      case 'feed-pin': showFeedPin(Number(el.dataset.lat), Number(el.dataset.lon), el.dataset.name); break;
      case 'pin-save-copy': { const it = S.buddies && S.buddies.feed && S.buddies.feed[Number(el.dataset.i)]; if (it && it.pin) addPin(it.pin.lat, it.pin.lon, { name: `${it.pin.name} (${it.who})`, depth: it.pin.depth, lakeId: it.pin.lakeId, lakeName: it.pin.lakeName, source: 'buddy' }); break; }
      case 'report-new': if (!S.user) { toast('Sign in to share lake reports'); break; } S.prevView = S.view; S.view = 'report'; render(); if (isMobile()) setSheet('full'); break;
      case 'report-cancel': S.view = S.lake ? 'lake' : 'home'; render(); break;
      case 'report-delete': FN.cloud.deleteReport(el.dataset.id).then(() => loadBuddies(true)).catch(e => toast(e.message)); break;
      case 'finder-species': S.finder.species = el.dataset.code; S.finder.minLen = 0; S.finder.limit = 20; saveFinder(); rerender(); break;
      case 'finder-mode': S.finder.mode = el.dataset.mode; S.finder.limit = 20; saveFinder(); rerender(); break;
      case 'finder-scope': S.finder.scope = el.dataset.scope; S.finder.limit = 20; saveFinder(); rerender(); if (S.finder.scope === 'near' && !S.location) locateNearby(); break;
      case 'finder-more': S.finder.limit += 20; rerender(); break;
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
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.finder) {
      if (el.dataset.finder === 'radius') S.finder.radius = Number(el.value);
      else if (el.dataset.finder === 'county') S.finder.county = el.value;
      else if (el.dataset.finder === 'minLen') S.finder.minLen = Number(el.value);
      S.finder.limit = 20; saveFinder(); rerender();
    } else if (el.dataset.file === 'catch-photo') photoChosen(el.files && el.files[0]);
  });
  document.addEventListener('submit', e => {
    const form = e.target.closest('form[data-form]'); if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    if (kind === 'auth') handleAuthForm(form);
    else if (kind === 'profile') FN.cloud.updateProfile({ display_name: form.querySelector('#profile-name').value.trim().slice(0, 40) }).then(p => { S.profile = p; toast('Name saved'); rerender(); }).catch(err => toast(err.message));
    else if (kind === 'newpass') FN.cloud.updatePassword(form.querySelector('#newpass').value).then(() => { toast('Password updated'); form.reset(); }).catch(err => toast(err.message));
    else if (kind === 'catch') saveCatch(form);
    else if (kind === 'invite') inviteBuddy(form);
    else if (kind === 'report') postReport(form);
  });

  function toggleFav() {
    if (!S.lake) return;
    const i = S.favorites.findIndex(f => f.id === S.lake.id);
    if (i >= 0) {
      S.favorites.splice(i, 1); toast('Removed from favorites');
      if (cloudOn()) FN.cloud.deleteFavorites([S.lake.id]).catch(() => { S.tomb.favorites.push(S.lake.id); U.store.set(K.tomb, S.tomb); });
      else { S.tomb.favorites.push(S.lake.id); U.store.set(K.tomb, S.tomb); }
    } else {
      const fav = { id: S.lake.id, name: S.lake.name, county: S.lake.county, town: S.lake.town, acres: S.lake.acres, maxDepth: S.lake.maxDepth };
      S.favorites.unshift(fav); toast('Saved to favorites ★');
      if (cloudOn()) FN.cloud.pushFavorites([fav]).catch(() => {});
    }
    U.store.set(K.favorites, S.favorites); rerender();
    S.bestbet.sig = '';
  }

  /* ---------- top bar & fabs ---------- */
  $('#btn-profile').addEventListener('click', () => (S.view === 'profile' ? goHome() : openProfile()));
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installPrompt = e; if (['home', 'profile'].includes(S.view)) rerender(); });
  window.addEventListener('appinstalled', () => { S.installPrompt = null; toast('Fish Nasty is on your home screen 📲'); rerender(); });
  $('#btn-top').addEventListener('click', openTop);
  $('#fab-locate').addEventListener('click', locateNearby);
  $('#fab-forecast').addEventListener('click', () => { if (S.view === 'quick') { S.view = S.lake ? 'lake' : 'home'; render(); } else openQuick(S.location ? 'gps-cached' : 'center'); });
  $('#fab-pin').addEventListener('click', () => { const m = $('#pin-menu'); if (m.classList.contains('hidden')) { m.innerHTML = FN.ui.pinMenu(); m.classList.remove('hidden'); $('#layers-panel').classList.add('hidden'); $('#legend').classList.add('hidden'); } else closePinMenu(); });
  $('#fab-zoomin').addEventListener('click', () => FN.map.getMap().zoomIn());
  $('#fab-zoomout').addEventListener('click', () => FN.map.getMap().zoomOut());
  const syncToolState = () => { $('#fab-layers').classList.toggle('on', !$('#layers-panel').classList.contains('hidden')); $('#fab-legend').classList.toggle('on', !$('#legend').classList.contains('hidden')); $('#fab-pin').classList.toggle('on', !$('#pin-menu').classList.contains('hidden') || S.placeMode); $('#fab-forecast').classList.toggle('on', S.view === 'quick'); };
  new MutationObserver(syncToolState).observe(document.getElementById('app'), { attributes: true, subtree: true, attributeFilter: ['class'] });
  $('#fab-layers').addEventListener('click', () => { renderLayers(); $('#layers-panel').classList.toggle('hidden'); $('#legend').classList.add('hidden'); closePinMenu(); });
  $('#fab-legend').addEventListener('click', () => { $('#legend').classList.toggle('hidden'); $('#layers-panel').classList.add('hidden'); closePinMenu(); });
  function renderLayers() { $('#layers-panel').innerHTML = FN.ui.layersPanel(FN.map.getSettings()); }
  $('#legend').innerHTML = FN.ui.legend();

  /* ---------- boot ---------- */
  function routeFromHash() {
    const m = location.hash.match(/lake\/(\d{8})/);
    if (m) openLake(m[1]);
    else if (location.hash === '#top') openTop();
    else if (location.hash === '#profile') openProfile();
    else if (['lake', 'top', 'profile'].includes(S.view)) goHome();
  }
  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/lake\/(\d{8})/);
    if (m && (!S.lake || S.lake.id !== m[1] || S.view !== 'lake')) openLake(m[1]);
    else if (location.hash === '#top' && S.view !== 'top') openTop();
    else if (location.hash === '#profile' && S.view !== 'profile') openProfile();
    else if (!m && !['#top', '#profile'].includes(location.hash) && ['lake', 'top', 'profile'].includes(S.view)) goHome();
    if (S.view === 'pin' && !m) leavePinEditor();
  });

  FN.map.init('map');
  FN.map.renderPins(S.pins, FN.ui.pinPopup);
  if (FN.cloud.init()) FN.cloud.onAuth(onAuth);
  else {
    window.addEventListener('supabase-ready', () => { if (FN.cloud.init()) { FN.cloud.onAuth(onAuth); rerender(); } });
    window.addEventListener('supabase-failed', () => rerender());
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cloudOn() && (!S.lastSync || Date.now() - S.lastSync > 120000)) syncAll().catch(() => {}); });
  render();
  if (S.lastLake) {
    // Show a bite forecast for the last lake while the user decides
    FN.dnr.byId(S.lastLake.id).then(l => { if (l && l.lat != null && !S.homeBite) loadHomeBite(l.lat, l.lon, l.name); }).catch(() => {});
  }
  routeFromHash();
  if (window.matchMedia('(max-width: 899px)').matches) setSheet(location.hash ? 'half' : 'half');
  if (S.view === 'home' && S.favorites.length) setTimeout(() => runBestBet('favorites').catch(() => {}), 800);
  const showWelcome = () => { if (S.welcomeSeen || S.user || location.hash.includes('lake/')) return; S.welcome = true; S.authMode = 'signup'; S.prevView = 'home'; S.view = 'account'; render(); if (isMobile()) setSheet('full'); };
  if (FN.cloud.available()) showWelcome(); else window.addEventListener('supabase-ready', showWelcome, { once: true });

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
  FN.app = { openLake, goHome, addPin, openTop, syncAll, state: S };
})();
