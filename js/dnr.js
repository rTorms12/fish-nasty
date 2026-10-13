/* Fish Nasty — Minnesota DNR data access (LakeFinder + ArcGIS services) */
window.FN = window.FN || {};

FN.dnr = (() => {
  const C = FN.config;
  const mem = new Map();

  async function getJSON(url, opts = {}) {
    if (mem.has(url)) return mem.get(url);
    const p = fetch(url, { mode: 'cors', ...opts }).then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      return r.json();
    });
    mem.set(url, p);
    p.catch(() => mem.delete(url));
    return p;
  }
  async function getText(url) {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.text();
  }

  /* ---------- LakeFinder search results -> normalized lake summary ---------- */
  function normalize(r) {
    const pt = (r.point && r.point['epsg:4326']) || null;
    const bb = (r.bbox && r.bbox['epsg:4326']) || null;
    let species = [];
    if (Array.isArray(r.fishSpecies)) species = r.fishSpecies.join(',').split(',').map(s => s.trim()).filter(Boolean);
    const m = r.morphology || {};
    return {
      id: String(r.id),
      name: r.name,
      county: r.county || '',
      countyId: r.county_id,
      town: r.nearest_town || '',
      lat: pt ? pt[1] : null,
      lon: pt ? pt[0] : null,
      bbox: bb, // [minLon, minLat, maxLon, maxLat]
      acres: Number(m.area) || 0,
      maxDepth: Number(m.max_depth) || 0,
      meanDepth: Number(m.mean_depth) || 0,
      littoral: Number(m.littoral_area) || 0,
      shoreMiles: Number(m.shore_length) || 0,
      species,
      speciesCodes: species.map(FN.speciesCode).filter(Boolean),
      invasive: r.invasiveSpecies || [],
      regs: r.specialFishingRegs || [],
      resources: r.resources || {},
      mapIds: r.mapid || [],
      border: r.border || '',
      notes: r.notes || '',
      pcaId: r.pca_id || ''
    };
  }

  async function search(name, countyId) {
    const q = String(name || '').trim();
    if (!q && !countyId) return [];
    let url = `${C.dnr.search}&name=${encodeURIComponent(q)}`;
    if (countyId) url += `&county=${encodeURIComponent(countyId)}`;
    const d = await getJSON(url);
    const res = (d && d.results) || [];
    return res.map(normalize).sort((a, b) => {
      // Prefer lakes with surveys and bigger water; exact name matches first
      const ax = a.name.toLowerCase() === q.toLowerCase() ? 1 : 0;
      const bx = b.name.toLowerCase() === q.toLowerCase() ? 1 : 0;
      if (ax !== bx) return bx - ax;
      const as = a.resources.lakeSurvey ? 1 : 0, bs = b.resources.lakeSurvey ? 1 : 0;
      if (as !== bs) return bs - as;
      return b.acres - a.acres;
    });
  }

  async function byId(id) {
    const d = await getJSON(`${C.dnr.search}&id=${encodeURIComponent(id)}`);
    const r = d && d.results && d.results[0];
    return r ? normalize(r) : null;
  }

  // Sub-basin DOW ids (e.g. 11020301) often have no survey; fall back to the parent (11020300)
  async function resolve(id) {
    id = String(id);
    let lake = null;
    try { lake = await byId(id); } catch (e) { /* ignore */ }
    if (lake && lake.resources.lakeSurvey && lake.acres > 0) return lake;
    if (!id.endsWith('00')) {
      try {
        const parent = await byId(FN.util.dowParent(id));
        if (parent && (parent.resources.lakeSurvey || parent.acres > 0)) return parent;
      } catch (e) { /* ignore */ }
    }
    return lake;
  }

  /* ---------- Fisheries survey detail ---------- */
  async function detail(id) {
    const d = await getJSON(`${C.dnr.detail}${encodeURIComponent(id)}`);
    if (!d || d.status !== 'SUCCESS' || !d.result) return null;
    const r = d.result;
    const surveys = (r.surveys || []).map(s => ({
      id: s.surveyID,
      date: s.surveyDate,
      type: s.surveyType,
      subType: s.surveySubType,
      narrative: s.narrative || '',
      catches: (s.fishCatchSummaries || []).map(c => ({
        species: c.species,
        name: FN.speciesName(c.species),
        gear: c.gear,
        gearCount: Number(c.gearCount) || 0,
        totalCatch: Number(c.totalCatch) || 0,
        totalWeight: Number(c.totalWeight) || 0,
        avgWeight: parseFloat(c.averageWeight) || 0,
        cpue: parseFloat(c.CPUE) || 0,
        normalCount: c.quartileCount || '',
        normalWeight: c.quartileWeight || ''
      })),
      lengths: s.lengths || {}
    })).sort((a, b) => (a.date < b.date ? 1 : -1));
    const clarity = (r.waterClarity || []).map(([d, ft]) => ({ date: d, ft: parseFloat(ft) })).filter(x => !isNaN(x.ft));
    return {
      id: r.DOWNumber,
      name: r.lakeName,
      county: r.county,
      areaAcres: parseFloat(r.areaAcres) || 0,
      littoralAcres: parseFloat(r.littoralAcres) || 0,
      maxDepth: parseFloat(r.maxDepthFeet) || 0,
      meanDepth: parseFloat(r.meanDepthFeet) || 0,
      shoreMiles: parseFloat(r.shoreLengthMiles) || 0,
      avgClarity: parseFloat(r.averageWaterClarity) || null,
      clarity,
      accesses: r.accesses || [],
      office: r.officeCode,
      surveys
    };
  }

  /* ---------- Stocking (HTML table -> rows) ---------- */
  async function stocking(id) {
    const html = await getText(`${C.dnr.stocking}${encodeURIComponent(id)}`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = [...doc.querySelectorAll('table')];
    const rows = [];
    let year = null;
    const main = tables[0];
    if (main) {
      for (const tr of main.querySelectorAll('tbody tr, tr')) {
        const tds = [...tr.querySelectorAll('td')];
        if (tds.length < 4) continue;
        const y = tds[0].textContent.replace(/ /g, '').trim();
        if (/^\d{4}$/.test(y)) year = Number(y);
        const spCell = tds[1];
        const noteRefs = [...spCell.querySelectorAll('sup')].map(s => s.textContent.trim());
        spCell.querySelectorAll('sup').forEach(s => s.remove());
        const species = spCell.textContent.trim();
        rows.push({
          year,
          species,
          code: FN.speciesCode(species),
          size: tds[2].textContent.trim(),
          number: Number(tds[3].textContent.replace(/[^0-9.]/g, '')) || 0,
          pounds: tds[4] ? (Number(tds[4].textContent.replace(/[^0-9.]/g, '')) || 0) : 0,
          notes: noteRefs
        });
      }
    }
    const notes = {};
    for (const t of tables.slice(1)) {
      for (const td of t.querySelectorAll('td')) {
        const m = td.textContent.trim().match(/^(\d+)\s*-\s*(.+)$/);
        if (m) notes[m[1]] = m[2].trim();
      }
    }
    return { rows: rows.filter(r => r.year), notes };
  }

  /* ---------- Public water access sites (ArcGIS FeatureServer) ----------
     Two lookups, merged: by DOW lake id, and everything inside the lake's bounding box.
     Many DNR access records (about 550 of 3,000) carry no lake id at all — river mouths, Upper Red Lake's
     landings at Waskish, small lakes — so the id lookup alone misses them. */
  const ACCESS_FIELDS = 'objectid,access_name,administrator,launch_type,ramp_surface,number_of_ramps,number_of_docks,number_of_toilets,trailer_parking_spaces_non_ada,directions,lake_name,dow_lake_id,alerts';
  const accessFeature = f => ({
    oid: f.properties.objectid || f.id,
    name: f.properties.access_name,
    admin: f.properties.administrator,
    launch: f.properties.launch_type,
    surface: f.properties.ramp_surface,
    ramps: f.properties.number_of_ramps,
    docks: f.properties.number_of_docks,
    toilets: f.properties.number_of_toilets,
    trailerSpaces: f.properties.trailer_parking_spaces_non_ada,
    directions: f.properties.directions,
    alerts: f.properties.alerts,
    lakeName: f.properties.lake_name,
    dow: f.properties.dow_lake_id,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0]
  });
  async function accessSites(lake) {
    const id = typeof lake === 'string' ? lake : lake.id;
    const prefix = FN.util.dowPrefix(id);
    const byId = getJSON(`${C.gis.access}/query?where=${encodeURIComponent(`dow_lake_id LIKE '${prefix}%'`)}&outFields=${ACCESS_FIELDS}&outSR=4326&f=geojson`).catch(() => null);
    let byBox = Promise.resolve(null);
    const bb = lake && lake.bbox;
    if (bb) {
      const pad = 0.006; // ~0.4 mi — catches landings on inlet rivers and just off the shoreline
      const env = { xmin: bb[0] - pad, ymin: bb[1] - pad, xmax: bb[2] + pad, ymax: bb[3] + pad, spatialReference: { wkid: 4326 } };
      byBox = getJSON(`${C.gis.access}/query?geometry=${encodeURIComponent(JSON.stringify(env))}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${ACCESS_FIELDS}&outSR=4326&f=geojson`).catch(() => null);
    }
    const [a, b] = await Promise.all([byId, byBox]);
    const out = new Map();
    for (const f of (a && a.features) || []) { const s = accessFeature(f); out.set(s.oid || `${s.lat},${s.lon}`, s); }
    const lakeName = (lake && lake.name ? lake.name : '').toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
    const nameMatch = s => lakeName && ((s.lakeName && s.lakeName.toLowerCase().includes(lakeName)) || (s.name && s.name.toLowerCase().includes(lakeName + ' lake')) || (s.name && s.name.toLowerCase().startsWith(lakeName)));
    const candidates = [];
    for (const f of (b && b.features) || []) {
      const s = accessFeature(f);
      const key = s.oid || `${s.lat},${s.lon}`;
      if (out.has(key)) continue;
      if (s.dow && FN.util.dowPrefix(s.dow) !== prefix && !nameMatch(s)) continue; // tagged to a different lake
      if ((s.dow && FN.util.dowPrefix(s.dow) === prefix) || nameMatch(s)) out.set(key, s);
      else candidates.push([key, s]);
    }
    // Untagged sites inside the box (river mouths, bays): keep them when they sit close to a known landing,
    // or when the DNR has no landing tagged to this lake at all (Upper Red Lake's Waskish accesses, for example)
    const tagged = [...out.values()];
    const dist = (p, q) => { const R = 6371000, dLat = (q.lat - p.lat) * Math.PI / 180, dLon = (q.lon - p.lon) * Math.PI / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * Math.PI / 180) * Math.cos(q.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
    for (const [key, s] of candidates) {
      const close = !tagged.length || tagged.some(t => dist(t, s) <= 2500);
      if (close) { s.nearby = true; out.set(key, s); }
    }
    return [...out.values()].sort((x, y) => (x.nearby ? 1 : 0) - (y.nearby ? 1 : 0) || String(x.name).localeCompare(String(y.name)));
  }

  /* ---------- Lakes with depth maps near a point (ArcGIS bathymetry outlines) ---------- */
  async function nearby(lat, lon, meters = 20000, limit = 30) {
    const g = encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }));
    const url = `${C.gis.bathy}/1/query?geometry=${g}&geometryType=esriGeometryPoint&inSR=4326&distance=${meters}&units=esriSRUnit_Meter&spatialRel=esriSpatialRelIntersects&outFields=dowlknum,lake_name,cty_name,acres&returnGeometry=true&returnCentroid=true&outSR=4326&orderByFields=acres%20DESC&resultRecordCount=${limit * 3}&f=json`;
    const d = await getJSON(url);
    const seen = new Set();
    const out = [];
    for (const f of (d && d.features) || []) {
      const a = f.attributes;
      const parent = FN.util.dowParent(a.dowlknum);
      if (seen.has(parent) || (a.acres || 0) < 20) continue;
      seen.add(parent);
      const c = f.centroid || {};
      out.push({ id: parent, dow: a.dowlknum, name: a.lake_name, county: FN.util.titleCase(a.cty_name), acres: a.acres, lat: c.y, lon: c.x });
      if (out.length >= limit) break;
    }
    return out;
  }

  /* ---------- Depth at a point (identify on the bathymetric DEM + outline) ---------- */
  async function identify(lat, lon, bounds, sizePx) {
    const p = new URLSearchParams({
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      sr: '4326',
      layers: 'all:1,3',
      tolerance: '2',
      mapExtent: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
      imageDisplay: `${sizePx.x},${sizePx.y},96`,
      returnGeometry: 'false',
      f: 'json'
    });
    const d = await getJSON(`${C.gis.bathy}/identify?${p.toString()}`);
    const res = { depth: null, lake: null };
    for (const r of (d && d.results) || []) {
      if (r.layerId === 3) {
        const v = r.attributes && (r.attributes['Stretch.Pixel Value'] ?? r.attributes['Pixel Value']);
        const n = parseFloat(v);
        if (!isNaN(n)) res.depth = Math.abs(n);
      } else if (r.layerId === 1 && !res.lake) {
        const a = r.attributes || {};
        res.lake = { dow: a.DOWLKNUM || a.dowlknum, name: a.LAKE_NAME || a.lake_name, acres: parseFloat(a.ACRES || a.acres) || 0 };
      }
    }
    if (res.depth == null && res.lake) {
      // Fall back to the nearest contour line
      try {
        const q = new URLSearchParams({
          geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', distance: '40', units: 'esriSRUnit_Meter',
          spatialRel: 'esriSpatialRelIntersects', outFields: 'depth', returnGeometry: 'false', f: 'json'
        });
        const c = await getJSON(`${C.gis.bathy}/0/query?${q.toString()}`);
        const depths = ((c && c.features) || []).map(f => Math.abs(f.attributes.depth)).filter(x => !isNaN(x));
        if (depths.length) res.depth = Math.max(...depths);
        res.approx = true;
      } catch (e) { /* ignore */ }
    }
    return res;
  }

  /* ---------- Depth-map vintage: when the DNR did the fieldwork behind the contours ---------- */
  async function bathyMeta(id) {
    const prefix = FN.util.dowPrefix(id);
    const url = `${C.gis.bathy}/2/query?where=${encodeURIComponent(`dowlknum LIKE '${prefix}%'`)}&outFields=dowlknum,lake_name,fldw_end,data_src,mapid&returnGeometry=false&f=json`;
    const d = await getJSON(url);
    const rows = ((d && d.features) || []).map(f => f.attributes);
    if (!rows.length) return null;
    const parseYear = v => { const m = String(v || '').match(/(19|20)\d{2}/); return m ? Number(m[0]) : null; };
    const years = rows.map(r => parseYear(r.fldw_end)).filter(Boolean);
    const src = { 'ORIG MAP': 'digitized from the original DNR survey map', 'TOPO MAP/DRG': 'digitized from a topographic map', 'GPS': 'GPS/sonar survey', 'GET SOURCE': 'source not recorded' };
    return { year: years.length ? Math.max(...years) : null, years, source: src[rows[0].data_src] || rows[0].data_src || 'unknown', mapIds: rows.map(r => r.mapid).filter(Boolean), basins: rows.length };
  }

  return { search, byId, resolve, detail, stocking, accessSites, nearby, identify, bathyMeta };
})();
