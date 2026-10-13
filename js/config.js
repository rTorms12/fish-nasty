/* Fish Nasty — configuration & shared constants */
window.FN = window.FN || {};

FN.config = {
  appName: 'Fish Nasty',
  version: '1.4.1',
  tz: 'America/Chicago',

  // Minnesota DNR LakeFinder (public JSON/HTML endpoints, CORS enabled)
  dnr: {
    search:   'https://maps.dnr.state.mn.us/cgi-bin/lakefinder/search.cgi?context=desktop',
    detail:   'https://maps.dnr.state.mn.us/cgi-bin/lakefinder/detail.cgi?type=lake_survey&id=',
    stocking: 'https://maps.dnr.state.mn.us/cgi-bin/lakefinder/fish_stocking.cgi?downum=',
    page:     'https://www.dnr.state.mn.us/lakefind/lake.html?id=',
    regs:     'https://www.dnr.state.mn.us/regulations/fishing/index.html'
  },

  // Minnesota Geospatial Commons / DNR ArcGIS services
  gis: {
    bathy:  'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathymetry/MapServer',
    relief: 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathy_shaded_relief/ImageServer',
    access: 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/struc_water_access_sites/FeatureServer/0'
  },

  weather: 'https://api.open-meteo.com/v1/forecast',

  // Supabase (sign-in, sync, catch log, buddies, statewide lake metrics). The publishable key is safe in a browser;
  // every table is protected by row-level security.
  supabase: {
    url: 'https://kmfyzjasrtpgdjcybqtr.supabase.co',
    key: 'sb_publishable_H8YMUAT5TQfWYslYl2cjIw_ELb32Mz0'
  },

  map: {
    center: [46.35, -94.2],
    zoom: 7,
    minZoom: 5,
    maxZoom: 18,
    contourMinZoom: 10,
    labelMinZoom: 13
  },

  // Depth bands (feet). Sequential single-hue ramp, shallow (light) -> deep (dark).
  depthBands: [
    { max: 5,   label: '0–5 ft',    color: '#dff1ff', rgb: [223, 241, 255] },
    { max: 10,  label: '5–10 ft',   color: '#a8d4f5', rgb: [168, 212, 245] },
    { max: 15,  label: '10–15 ft',  color: '#6fb3ec', rgb: [111, 179, 236] },
    { max: 20,  label: '15–20 ft',  color: '#3f8fdf', rgb: [63, 143, 223] },
    { max: 30,  label: '20–30 ft',  color: '#2a6fc4', rgb: [42, 111, 196] },
    { max: 40,  label: '30–40 ft',  color: '#1f54a3', rgb: [31, 84, 163] },
    { max: 60,  label: '40–60 ft',  color: '#173f85', rgb: [23, 63, 133] },
    { max: 100, label: '60–100 ft', color: '#102c66', rgb: [16, 44, 102] },
    { max: 999, label: '100+ ft',   color: '#0a1b47', rgb: [10, 27, 71] }
  ],

  counties: ['', 'Aitkin','Anoka','Becker','Beltrami','Benton','Big Stone','Blue Earth','Brown','Carlton','Carver','Cass','Chippewa','Chisago','Clay','Clearwater','Cook','Cottonwood','Crow Wing','Dakota','Dodge','Douglas','Faribault','Fillmore','Freeborn','Goodhue','Grant','Hennepin','Houston','Hubbard','Isanti','Itasca','Jackson','Kanabec','Kandiyohi','Kittson','Koochiching','Lac qui Parle','Lake','Lake of the Woods','Le Sueur','Lincoln','Lyon','McLeod','Mahnomen','Marshall','Martin','Meeker','Mille Lacs','Morrison','Mower','Murray','Nicollet','Nobles','Norman','Olmsted','Otter Tail','Pennington','Pine','Pipestone','Polk','Pope','Ramsey','Red Lake','Redwood','Renville','Rice','Rock','Roseau','St. Louis','Scott','Sherburne','Sibley','Stearns','Steele','Stevens','Swift','Todd','Traverse','Wabasha','Wadena','Waseca','Washington','Watonwan','Wilkin','Winona','Wright','Yellow Medicine'],

  storageKeys: {
    favorites: 'fn.favorites',
    recents: 'fn.recents',
    layers: 'fn.layers',
    species: 'fn.species',
    lastLake: 'fn.lastLake',
    pins: 'fn.pins',
    catches: 'fn.catches',
    tomb: 'fn.tomb',
    finder: 'fn.finder'
  },

  pinColors: ['#ffb454', '#ff6b6b', '#6cf0bd', '#58d1ff', '#c58bff', '#ffffff']
};

FN.util = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  num(n, d = 0) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  },
  titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|\s|\()([a-z])/g, (m, p, c) => p + c.toUpperCase());
  },
  pad2(n) { return String(n).padStart(2, '0'); },
  // Parse an Open-Meteo local time string ("2026-10-09T14:00") as local time
  parseLocal(str) {
    const [d, t] = str.split('T');
    const [y, m, day] = d.split('-').map(Number);
    const [hh, mm] = (t || '00:00').split(':').map(Number);
    return new Date(y, m - 1, day, hh, mm || 0, 0, 0);
  },
  fmtTime(d, opts) {
    if (!d || isNaN(d)) return '—';
    return d.toLocaleTimeString('en-US', Object.assign({ hour: 'numeric', minute: '2-digit' }, opts || {}));
  },
  fmtHour(d) {
    if (!d || isNaN(d)) return '—';
    return d.toLocaleTimeString('en-US', { hour: 'numeric' }).replace(' ', '').toLowerCase();
  },
  fmtDate(d, opts) {
    return d.toLocaleDateString('en-US', Object.assign({ weekday: 'short', month: 'short', day: 'numeric' }, opts || {}));
  },
  sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  },
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  store: {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  },
  depthBand(ft) {
    const bands = FN.config.depthBands;
    for (const b of bands) if (ft <= b.max) return b;
    return bands[bands.length - 1];
  },
  dowParent(dow) { return String(dow).slice(0, 6) + '00'; },
  dowPrefix(dow) { return String(dow).slice(0, 6); },
  windDir(deg) {
    if (deg == null || isNaN(deg)) return '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }
};
