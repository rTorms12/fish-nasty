/* Fish Nasty — HTML rendering (sheet views, charts, panels) */
window.FN = window.FN || {};

FN.ui = (() => {
  const U = FN.util, C = FN.config, esc = U.esc;

  const ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 6 21l1.3-6.8-5-4.7 6.8-.8z"/></svg>',
    locate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>',
    legend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    fish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 12s4-6 10-6c4 0 8 6 8 6s-4 6-8 6c-6 0-10-6-10-6z"/><path d="M3 12l-1-4M3 12l-1 4"/><circle cx="15.5" cy="11" r="1" fill="currentColor"/></svg>'
  };

  const ratingBadge = r => `<span class="badge ${r.cls}">${r.word}</span>`;
  // Realistic species artwork (img/species/*.jpg) with the emoji as a fallback until the image loads
  const SPECIES_IMG = { WAE: 'walleye', SAR: 'walleye', WAS: 'walleye', NOP: 'northern-pike', SIP: 'northern-pike', BLC: 'crappie', WHC: 'crappie', CRP: 'crappie', HCR: 'crappie' };
  const speciesIcon = (code, size = 'sm') => {
    const p = FN.profileFor(code);
    const emoji = p ? p.icon : '';
    const slug = SPECIES_IMG[code];
    if (!slug) return `<span class="sp-emoji">${emoji}</span>`;
    return `<span class="sp-pic ${size}"><img src="img/species/${slug}${size === 'lg' ? '' : '-sm'}.jpg" alt="${esc(p ? p.name : code)}" decoding="async" onerror="this.parentNode.classList.add('err'); this.remove()"><span class="sp-emoji">${emoji}</span></span>`;
  };
  const scoreRing = (score, size = 56) => {
    const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - score / 100);
    const cls = FN.forecast.rating(score).cls;
    return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="Bite score ${score}">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
      <circle class="bar" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      <text x="50%" y="50%" dy="0.36em" text-anchor="middle">${score}</text></svg>`;
  };
  const stat = (label, value, unit = '') => `<div class="stat"><div class="v">${value}<small>${unit}</small></div><div class="l">${label}</div></div>`;
  const spinner = msg => `<div class="loading"><div class="spin"></div><span>${esc(msg || 'Loading…')}</span></div>`;
  const errorBox = msg => `<div class="error">${esc(msg)}</div>`;
  const windowText = w => `${U.fmtTime(w.start, { minute: undefined })}–${U.fmtTime(w.end, { minute: undefined })}`.replace(/:00/g, '');

  /* ---------------- HOME ---------------- */
  function home(S) {
    const favs = S.favorites || [];
    const parts = [];
    parts.push(`<div class="hero"><div class="logo">${ICON.fish}</div><div><h1>Fish Nasty</h1><p>Minnesota lake maps, DNR surveys, stocking records and a bite forecast.</p></div></div>`);
    if (!S.user && FN.cloud && FN.cloud.available()) {
      parts.push(`<button class="card link signin-card" data-action="account"><div class="row"><div class="avatar">☁️</div><div class="grow"><div class="big">Sign in or create an account</div><div class="muted small">Back up and sync your pins and favorites, keep a catch log with photos, and share spots with buddies.</div></div><div class="chev">›</div></div></button>`);
    }

    // Bite now
    if (S.homeBite) {
      const b = S.homeBite, day = b.days[0];
      const now = new Date();
      const cur = b.hours.filter(h => h.t <= now).pop() || b.hours[0];
      const label = S.homeLabel || 'Your area';
      const wx = S.homeWeather && S.homeWeather.current;
      parts.push(`<div class="card bite-now">
        <div class="row"><div>${scoreRing(cur.score, 64)}</div>
          <div class="grow"><div class="eyebrow">Bite now · ${esc(label)}</div>
            <div class="big">${ratingBadge(cur.rating)} <span class="muted">${esc(b.profile.name)}</span></div>
            ${day ? `<div class="muted small">Today ${day.score}/100 · best ${day.windows.length ? day.windows.map(windowText).join(', ') : 'no standout window'}</div>` : ''}
            ${wx ? `<div class="muted small">${FN.weather.describe(wx.code)[1]} ${Math.round(wx.temp)}°F · wind ${Math.round(wx.wind)} mph ${U.windDir(wx.windDir)} · ${FN.weather.hPaToInHg(wx.pressure)} inHg · ${cur.info.phaseIcon} ${esc(cur.info.phaseName)}</div>` : ''}
          </div></div>
        <div class="actions"><button class="btn" data-action="locate-nearby">${ICON.locate} Use my location</button>${S.lastLake ? `<button class="btn ghost" data-action="open-lake" data-id="${esc(S.lastLake.id)}">Open ${esc(S.lastLake.name)}</button>` : ''}</div>
      </div>`);
    } else {
      parts.push(`<div class="card bite-now"><div class="row"><div class="grow"><div class="eyebrow">Bite forecast</div><div class="muted small">${S.loading.home ? 'Checking the weather and moon…' : 'Turn on location to see the bite forecast for where you are, or open any lake below.'}</div></div></div>
        <div class="actions"><button class="btn" data-action="locate-nearby">${ICON.locate} Use my location</button></div></div>`);
    }

    parts.push(`<button class="card link top-link" data-action="top"><div class="row"><div class="trophy">🏆</div><div class="grow"><div class="big">Lake finder · Top 20</div><div class="muted small">Biggest and most walleye, pike and crappie — statewide, near you, or by county — from every DNR survey</div></div><div class="chev">›</div></div></button>`);
    if (S.user) {
      const pending = (S.buddies && S.buddies.friendships || []).filter(f => f.status === 'pending' && f.addressee_id === S.user.id).length;
      parts.push(`<div class="card account"><div class="row"><div class="avatar">${esc(((S.profile && S.profile.display_name) || S.user.email || '?').slice(0, 1).toUpperCase())}</div><div class="grow"><div class="big">${esc((S.profile && S.profile.display_name) || S.user.email)}</div><div class="muted small">${S.syncing ? 'Syncing…' : S.lastSync ? 'Synced ' + U.fmtTime(S.lastSync) : 'Signed in'} · pins, favorites and catches are backed up</div></div><button class="icon-btn mini" data-action="account" title="Account">${ICON.edit}</button></div>
        <div class="actions"><button class="btn" data-action="catches">🎣 Catch log${S.catches.length ? ` <em class="count">${S.catches.length}</em>` : ''}</button><button class="btn ghost" data-action="buddies">👥 Buddies${pending ? ` <em class="count hot">${pending}</em>` : ''}</button><button class="btn ghost" data-action="catch-new">+ Log a catch</button></div></div>`);
    } else if (window.supabaseLoadFailed) {
      parts.push(`<div class="card"><div class="eyebrow">Account features unavailable</div><p class="small">This device blocked the sign-in library (cdn.jsdelivr.net / unpkg.com). A content blocker, VPN or DNS filter is the usual cause. Pins, favorites and catches still work on this device.</p></div>`);
    } else if (FN.cloud && FN.cloud.available()) {
      if (S.catches && S.catches.length) parts.push(`<button class="card link" data-action="catches"><div class="row"><div class="trophy">🎣</div><div class="grow"><div class="big">Catch log <span class="muted">· ${S.catches.length}</span></div><div class="muted small">Kept on this device. Sign in to back it up and sync.</div></div><div class="chev">›</div></div></button>`);
    }
    if (S.nearby && S.nearby.length) {
      parts.push(`<h2>Lakes with depth maps near you</h2><div class="list">${S.nearby.slice(0, 12).map(l => lakeRow({ id: l.id, name: l.name, county: l.county, acres: l.acres })).join('')}</div>`);
    }
    parts.push(`<h2>Favorite lakes <span class="muted small">(${favs.length})</span></h2>`);
    if (favs.length) parts.push(`<div class="list">${favs.map(lakeRow).join('')}</div>`);
    else parts.push(`<p class="muted small">Search for a lake above, then tap the <strong>★</strong> on its page to keep it here.</p>`);
    const recents = S.recents || [];
    parts.push(`<h2>Recent lakes</h2>`);
    if (recents.length) parts.push(`<div class="list">${recents.slice(0, 8).map(lakeRow).join('')}</div>`);
    else parts.push(`<p class="muted small">Lakes you open will show up here.</p>`);
    parts.push(`<h2>My pins <span class="muted small">(${(S.pins || []).length})</span></h2>`);
    if (S.pins && S.pins.length) parts.push(`<div class="list">${S.pins.map(pinRow).join('')}</div>`);
    else parts.push(`<p class="muted small">No pins yet. Tap the <strong>pin</strong> button on the map to drop one at your GPS location or at a spot you choose. You can also long-press (right-click on a computer) anywhere on the map.</p>`);
    parts.push(`<div class="foot">Data: Minnesota DNR LakeFinder (surveys, stocking, species), MN Geospatial Commons lake bathymetry, Open-Meteo weather, SunCalc moon/sun. Not affiliated with the Minnesota DNR. Check current regulations before you fish.<br><br>Fish Nasty v${esc(C.version)} · ${FN.cloud && FN.cloud.available() ? 'cloud connected' : window.supabaseLoadFailed === 'error' ? 'cloud library failed to start on this device' : window.supabaseLoadFailed ? 'cloud library blocked on this device' : 'cloud library loading…'}</div>`);
    return parts.join('');
  }

  const lakeRow = l => `<button class="lrow" data-action="open-lake" data-id="${esc(l.id)}"><div><div class="t">${esc(l.name)}</div><div class="s">${esc(l.county || '')}${l.county ? ' County' : ''}${l.town ? ' · near ' + esc(l.town) : ''}</div></div><div class="r">${l.acres ? U.num(l.acres) + ' ac' : ''}${l.maxDepth ? '<br>' + U.num(l.maxDepth) + ' ft max' : ''}</div></button>`;

  const pinRow = p => `<div class="lrow pin-row"><button class="pin-open grow" data-action="pin-open" data-id="${esc(p.id)}"><i class="dot" style="background:${esc(p.color || '#ffb454')}"></i><span><span class="t">${esc(p.name)}</span><span class="s">${p.lakeName ? esc(p.lakeName) + ' · ' : ''}${p.depth != null ? p.depth + ' ft · ' : ''}${new Date(p.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${p.notes ? ' · ' + esc(p.notes.slice(0, 40)) : ''}</span></span></button><button class="icon-btn mini" data-action="pin-edit" data-id="${esc(p.id)}" title="Edit pin">${ICON.edit}</button></div>`;

  function searchResults(list, q) {
    if (!list) return '';
    if (!list.length) return `<div class="sr-empty">No lakes named “${esc(q)}”. Try part of the name (e.g. “Minnet”) or a DOW number.</div>`;
    return list.slice(0, 40).map(l => `<button class="sr" data-action="open-lake" data-id="${esc(l.id)}"><div><div class="t">${esc(l.name)} <span class="muted">${esc(l.id)}</span></div><div class="s">${esc(l.county)} County${l.town ? ' · near ' + esc(l.town) : ''}</div></div><div class="r">${l.acres ? U.num(l.acres) + ' ac' : ''}${l.maxDepth ? ' · ' + U.num(l.maxDepth) + ' ft' : ''}${l.resources.lakeMap ? ' · 🗺️' : ''}</div></button>`).join('');
  }

  /* ---------------- LAKE ---------------- */
  function lake(S) {
    const L = S.lake;
    const isFav = (S.favorites || []).some(f => f.id === L.id);
    const tabs = [['overview', 'Overview'], ['survey', 'Survey'], ['stocking', 'Stocking'], ['forecast', 'Forecast'], ['access', 'Access']];
    let body = '';
    switch (S.tab) {
      case 'survey': body = survey(S); break;
      case 'stocking': body = stocking(S); break;
      case 'forecast': body = forecast(S); break;
      case 'access': body = access(S); break;
      default: body = overview(S);
    }
    return `<div class="lake-head">
      <button class="icon-btn" data-action="home" title="Home">${ICON.back}</button>
      <div class="grow"><h1>${esc(L.name)}</h1><div class="s">${esc(L.county)} County${L.town ? ' · near ' + esc(L.town) : ''} · DOW ${esc(L.id)}</div></div>
      <button class="icon-btn fav ${isFav ? 'on' : ''}" data-action="fav" title="Favorite">${ICON.star}</button>
      <button class="icon-btn" data-action="zoom-lake" title="Zoom to lake">${ICON.locate}</button>
    </div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="tab-body">${body}</div>`;
  }

  function overview(S) {
    const L = S.lake, D = S.detail;
    const maxD = (D && D.maxDepth) || L.maxDepth, meanD = (D && D.meanDepth) || L.meanDepth;
    const acres = (D && D.areaAcres) || L.acres, litt = (D && D.littoralAcres) || L.littoral, shore = (D && D.shoreMiles) || L.shoreMiles;
    const clarity = D && D.avgClarity;
    const stockedCodes = new Set(((S.stocking && S.stocking.rows) || []).filter(r => r.year >= new Date().getFullYear() - 6).map(r => r.code));
    const parts = [];
    parts.push(`<div class="stats">${stat('acres', U.num(acres))}${stat('max depth', U.num(maxD), ' ft')}${stat('mean depth', meanD ? U.num(meanD, 1) : '—', meanD ? ' ft' : '')}${stat('littoral (<15 ft)', litt ? Math.round(100 * litt / Math.max(1, acres)) : '—', litt ? '%' : '')}${stat('shoreline', shore ? U.num(shore, 1) : '—', shore ? ' mi' : '')}${stat('clarity', clarity ? U.num(clarity, 1) : '—', clarity ? ' ft' : '')}</div>`);

    if (S.bathy) {
      const b = S.bathy;
      parts.push(b.none
        ? `<p class="muted small">🗺️ No DNR depth map exists for this lake, so the map shows the outline only.</p>`
        : `<p class="muted small">🗺️ Depth map: DNR fieldwork ${b.year ? b.year : 'date unknown'}${b.years.length > 1 ? ` (${Math.min(...b.years)}–${Math.max(...b.years)} across ${b.basins} basins)` : ''}, ${esc(b.source)}. Contours are 5-ft steps (10 ft on some big lakes); depths between lines are interpolated, so treat tap-to-read depths as ±3 ft.</p>`);
    }
    if (S.bite && S.bite.days[0]) {
      const d = S.bite.days[0];
      parts.push(`<button class="card link" data-action="tab" data-tab="forecast"><div class="row">${scoreRing(d.score, 56)}<div class="grow"><div class="eyebrow">Today's bite · ${esc(S.bite.profile.name)}</div><div class="big">${ratingBadge(d.rating)}</div><div class="muted small">${d.windows.length ? 'Best: ' + d.windows.map(windowText).join(', ') : 'No standout window'} · ${d.info.phaseIcon} ${esc(d.info.phaseName)}</div></div><div class="chev">›</div></div></button>`);
    } else if (S.loading.weather) parts.push(`<div class="card">${spinner('Building bite forecast…')}</div>`);

    // Species
    const sp = L.species.length ? L.species : (D ? latestSpecies(D) : []);
    parts.push(`<h2>Fish species <span class="muted small">(DNR surveys, last 10 yrs)</span></h2>`);
    if (sp.length) {
      parts.push(`<div class="chips">${sp.map(n => { const code = FN.speciesCode(n); const game = code && FN.isGameFish(code); const prof = code && FN.profileFor(code); return `<span class="chip pic ${game ? 'game' : ''}">${code ? speciesIcon(code, 'sm') + ' ' : ''}${esc(U.titleCase(n))}${stockedCodes.has(code) ? ' <em title="stocked in the last 6 years">stocked</em>' : ''}</span>`; }).join('')}</div>`);
    } else parts.push(`<p class="muted">No species list published for this lake.</p>`);

    // Where to look: walleye, pike and crappie, for the current season (spring / summer / fall / ice)
    const season = FN.seasonOf(new Date());
    const present = new Set(sp.map(FN.speciesCode).filter(Boolean).map(c => (FN.profileFor(c) || {}).name));
    const trio = ['WAE', 'NOP', 'BLC'].map(FN.profileFor).filter(p => !sp.length || present.has(p.name));
    const seasonTitle = season === 'winter' ? 'Where to look through the ice' : `Where to look this ${season}`;
    if (trio.length) parts.push(`<h2>${seasonTitle}</h2><div class="list tight">${trio.map(p => `<div class="krow"><div class="k">${speciesIcon(p.code || ['WAE', 'NOP', 'BLC'].find(c => FN.profileFor(c).name === p.name), 'md')} <span>${esc(p.name)}</span></div><div class="v">${esc(p.depth[season])}</div></div>`).join('')}</div><p class="muted small">Changes with the season: spring (ice-out to May), summer, fall, and ice (December–March).</p>`);

    const lakePins = (S.pins || []).filter(p => pinOnLake(p, L));
    if (lakePins.length) parts.push(`<h2>My pins on this lake</h2><div class="list">${lakePins.map(pinRow).join('')}</div>`);
    const lakeCatches = (S.catches || []).filter(c => c.lakeId && U.dowPrefix(c.lakeId) === U.dowPrefix(L.id));
    parts.push(`<h2>Catch log</h2><div class="actions"><button class="btn small" data-action="catch-new">+ Log a catch here</button>${S.user ? `<button class="btn small ghost" data-action="report-new">📝 Lake report to buddies</button>` : ''}</div>`);
    if (lakeCatches.length) parts.push(`<div class="list">${lakeCatches.slice(0, 5).map(c => FN.ui.catchRow(c)).join('')}</div><div class="actions"><button class="btn small ghost" data-action="catches">Open catch log (${S.catches.length})</button></div>`);
    else if (!S.user) parts.push(`<p class="muted small">Catches are kept on this device until you sign in; then they're backed up and synced.</p>`);

    if (L.regs && L.regs.length) {
      parts.push(`<h2>Special regulations</h2><div class="regs">${L.regs.map(r => `${r.location ? `<div class="muted small">${esc(r.location)}</div>` : ''}<ul>${(r.regs || []).map(x => `<li><strong>${esc((x.species || []).join(', '))}:</strong> ${esc(x.text)}</li>`).join('')}</ul>`).join('')}<a class="ext" href="${C.dnr.regs}" target="_blank" rel="noopener">Statewide regulations ${ICON.ext}</a></div>`);
    }
    if (L.invasive && L.invasive.length) parts.push(`<div class="warn">⚠️ Infested waters: ${esc(L.invasive.join(', '))}. Clean, drain, dry.</div>`);
    if (D && D.clarity && D.clarity.length) {
      const last = D.clarity[D.clarity.length - 1];
      parts.push(`<p class="muted small">Water clarity: avg ${U.num(D.avgClarity, 1)} ft Secchi · latest ${U.num(last.ft, 1)} ft (${esc(last.date)}) · ${D.clarity.length} readings.</p>`);
    }
    parts.push(`<div class="links"><a class="ext" href="${C.dnr.page}${esc(L.id)}" target="_blank" rel="noopener">DNR LakeFinder page ${ICON.ext}</a></div>`);
    return parts.join('');
  }

  const latestSpecies = D => {
    const s = D.surveys.find(x => x.catches.length);
    return s ? [...new Set(s.catches.map(c => c.name))] : [];
  };

  /* ---------------- SURVEY (walleye · pike · crappie only) ---------------- */
  const TARGETS = [
    { key: 'WAE', name: 'Walleye', codes: ['WAE'], big: 20, trophy: 25 },
    { key: 'NOP', name: 'Northern pike', codes: ['NOP', 'SIP'], big: 30, trophy: 36 },
    { key: 'BLC', name: 'Crappie', codes: ['BLC', 'WHC', 'CRP', 'HCR'], big: 11, trophy: 13 }
  ];
  const gearShort = g => String(g || '').replace('Standard ', '').replace(' sets', '').replace('gill nets', 'gill net').replace('trap nets', 'trap net').replace('electrofishing', 'electrofishing run');
  function mergeLengths(lengths, codes) {
    const counts = new Map();
    for (const c of codes) {
      const L = lengths && lengths[c];
      if (!L || !L.fishCount || !L.fishCount.length) continue;
      for (const [inch, n] of L.fishCount) counts.set(Number(inch), (counts.get(Number(inch)) || 0) + Number(n));
    }
    if (!counts.size) return null;
    const inches = [...counts.keys()];
    return { minimum_length: Math.min(...inches), maximum_length: Math.max(...inches), fishCount: [...counts.entries()] };
  }
  const surveyHasTarget = sv => TARGETS.some(t => mergeLengths(sv.lengths, t.codes) || sv.catches.some(c => t.codes.includes(c.species)));

  function survey(S) {
    const D = S.detail;
    if (S.loading.detail) return spinner('Loading DNR fisheries surveys…');
    if (S.errors.detail) return errorBox(S.errors.detail);
    if (!D || !D.surveys.length) return `<p class="muted">The DNR has not published a fisheries survey for this lake.</p>`;
    const list = D.surveys.filter(surveyHasTarget);
    if (!list.length) return `<p class="muted">The DNR surveys for this lake did not net any walleye, northern pike or crappie.</p>`;
    const idx = Math.min(S.surveyIdx || 0, list.length - 1);
    const sv = list[idx];
    const parts = [];
    parts.push(`<div class="field"><label>Survey</label><select data-change="survey">${list.map((s, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${esc(s.date)} — ${esc(s.subType || s.type)}</option>`).join('')}</select></div>`);

    for (const t of TARGETS) {
      const catches = sv.catches.filter(c => t.codes.includes(c.species)).sort((a, b) => b.cpue - a.cpue);
      const len = mergeLengths(sv.lengths, t.codes);
      if (!catches.length && !len) continue;
      const p = FN.profileFor(t.key);
      const block = [];
      block.push(`<div class="sp-head">${speciesIcon(t.key, 'lg')}<h2>${esc(t.name)}</h2></div>`);
      if (catches.length) {
        block.push(`<table class="tbl"><thead><tr><th>Gear</th><th class="n">Per net</th><th class="n">Normal</th><th class="n">Caught</th><th class="n">Avg lb</th></tr></thead><tbody>${catches.map(c => `<tr><td>${esc(gearShort(c.gear))} <span class="muted">×${U.num(c.gearCount, 1)}</span></td><td class="n"><strong>${U.num(c.cpue, 2)}</strong> ${rangeFlag(c.cpue, c.normalCount)}</td><td class="n muted">${esc(c.normalCount || '—')}</td><td class="n">${U.num(c.totalCatch)}</td><td class="n">${c.avgWeight ? U.num(c.avgWeight, 2) : '—'}</td></tr>`).join('')}</tbody></table>`);
      }
      if (len) {
        const n = len.fishCount.reduce((a, [, c]) => a + c, 0);
        const nBig = len.fishCount.reduce((a, [inch, c]) => a + (inch >= t.big ? c : 0), 0);
        const nTrophy = len.fishCount.reduce((a, [inch, c]) => a + (inch >= t.trophy ? c : 0), 0);
        block.push(`<div class="stats three"><div class="stat"><div class="v">${U.num(n)}</div><div class="l">measured</div></div><div class="stat"><div class="v">${len.maximum_length}<small>in</small></div><div class="l">longest</div></div><div class="stat"><div class="v">${n ? Math.round(100 * nBig / n) : 0}<small>%</small></div><div class="l">${t.big}″ or longer${nTrophy ? ` · ${nTrophy} over ${t.trophy}″` : ''}</div></div></div>`);
        block.push(lengthChart(len, t.big));
      }
      parts.push(`<div class="sp-block">${block.join('')}</div>`);
    }
    parts.push(`<p class="muted small">“Per net” is catch per unit effort for that gear. “Normal” is the statewide 25th–75th percentile for lakes of this class; ▲ above, ▼ below. Highlighted bars are ${TARGETS.map(t => `${t.name.toLowerCase()} ${t.big}″+`).join(', ')}.</p>`);
    if (sv.narrative) parts.push(`<details class="narr"><summary>Status of the fishery (DNR write-up)</summary><div class="prose">${sanitize(sv.narrative)}</div></details>`);
    return parts.join('');
  }

  function rangeFlag(cpue, normal) {
    const m = String(normal || '').match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (!m) return '';
    const lo = parseFloat(m[1]), hi = parseFloat(m[2]);
    if (cpue > hi) return '<span class="up" title="above normal range">▲</span>';
    if (cpue < lo) return '<span class="down" title="below normal range">▼</span>';
    return '';
  }

  function sanitize(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,link,img').forEach(n => n.remove());
    doc.querySelectorAll('*').forEach(n => { for (const a of [...n.attributes]) if (/^on/i.test(a.name) || a.name === 'style') n.removeAttribute(a.name); });
    return doc.body.innerHTML;
  }

  function lengthChart(len, bigFrom) {
    const counts = new Map(len.fishCount.map(([inch, n]) => [Number(inch), Number(n)]));
    const min = Number(len.minimum_length), max = Number(len.maximum_length);
    const bars = [];
    for (let i = min; i <= max; i++) bars.push({ inch: i, n: counts.get(i) || 0 });
    const W = 560, H = 160, padL = 28, padB = 26, padT = 10;
    const maxN = Math.max(1, ...bars.map(b => b.n));
    const bw = (W - padL - 8) / bars.length;
    const total = bars.reduce((a, b) => a + b.n, 0);
    const svg = bars.map((b, i) => {
      const h = (H - padB - padT) * b.n / maxN;
      const x = padL + i * bw, y = H - padB - h;
      return `<g class="bar ${bigFrom != null && b.inch >= bigFrom ? 'big' : ''}"><title>${b.inch}″: ${b.n} fish</title><rect x="${(x + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>${bars.length <= 30 || i % 2 === 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${b.inch}</text>` : ''}</g>`;
    }).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" class="len-chart" role="img" aria-label="Length distribution"><line x1="${padL}" y1="${H - padB}" x2="${W - 8}" y2="${H - padB}" class="axis"/><text x="${padL - 4}" y="${padT + 8}" text-anchor="end" class="axis-l">${maxN}</text><text x="${padL - 4}" y="${H - padB}" text-anchor="end" class="axis-l">0</text>${svg}</svg><div class="muted small">${total} fish measured · ${min}–${max} in</div></div>`;
  }

  /* ---------------- TOP 20 LAKES ---------------- */
  function top(S) {
    const R = S.rankings;
    const head = `<div class="lake-head"><button class="icon-btn" data-action="home" title="Home">${ICON.back}</button><div class="grow"><h1>Top 20 lakes</h1><div class="s">${R ? `DNR surveys since ${R.minYear} · ${U.num(R.lakesWithData)} of ${U.num(R.lakesScanned)} surveyed lakes had walleye, pike or crappie data` : 'From Minnesota DNR fisheries surveys'}</div></div></div>`;
    if (S.loading.rankings) return head + spinner('Loading rankings…');
    if (!R) return head + errorBox(S.errors.rankings || 'Rankings are not built yet. Run tools/build_rankings.py to create data/rankings.json.');
    const code = R.species[S.topSpecies] ? S.topSpecies : 'WAE';
    const sp = R.species[code];
    const chips = ['WAE', 'NOP', 'BLC'].filter(c => R.species[c]).map(c => `<button class="chip sel pic ${code === c ? 'on' : ''}" data-action="top-species" data-code="${c}">${speciesIcon(c, 'sm')} ${esc(R.species[c].name)}</button>`).join('');
    const mode = S.topMode === 'many' ? 'many' : 'big';
    const seg = `<div class="seg"><button class="${mode === 'big' ? 'on' : ''}" data-action="top-mode" data-mode="big">🏆 Biggest fish</button><button class="${mode === 'many' ? 'on' : ''}" data-action="top-mode" data-mode="many">🎣 Most fish</button></div>`;
    const list = mode === 'big' ? sp.bigLakes : sp.manyLakes;
    const rows = list.map((l, i) => {
      const metric = mode === 'big'
        ? `<b>${l.pctBig}%</b> of ${U.num(l.n)} netted fish were ${sp.big}″+ · longest ${l.max}″${l.nTrophy ? ` · ${l.nTrophy} over ${sp.trophy}″` : ''} · ${(l.years || []).join(', ')}`
        : `<b>${U.num(l.cpue, 1)}</b> per ${esc(gearShort(l.gear))} · ${U.num(l.catch)} caught in ${l.nets} nets · ${l.year}${l.normal && l.normal !== 'N/A' ? ` · normal ${esc(l.normal)}` : ''}`;
      return `<button class="toprow" data-action="open-lake" data-id="${esc(l.id)}"><div class="rank">${i + 1}</div><div class="grow"><div class="t">${esc(l.name)} <span class="muted small">${esc(l.county)} Co. · ${U.num(l.acres)} ac</span></div><div class="s">${metric}</div></div><div class="chev">›</div></button>`;
    }).join('');
    const note = mode === 'big'
      ? `<p class="muted small">Ranked by the share of netted ${sp.name.toLowerCase()} measuring ${sp.big}″ or longer in the lake's two most recent surveys with length data (at least ${sp.minN} fish measured, lakes over 50 acres, ${U.num(sp.eligibleBig)} lakes qualified). “Longest” is the biggest fish the DNR measured.</p>`
      : `<p class="muted small">Ranked by catch per net in the most recent survey (${esc(sp.gearNote)} where available, at least 2 nets, lakes over 50 acres, ${U.num(sp.eligibleMany)} lakes qualified). “Normal” is the statewide 25th–75th percentile for similar lakes.</p>`;
    return head + `<div class="chips scroll">${chips}</div>` + seg + (rows ? `<div class="list">${rows}</div>` : `<p class="muted">No lakes qualified.</p>`) + note + `<p class="muted small">Built ${esc(R.built)} from Minnesota DNR LakeFinder survey data. Nets sample a lake on one day, so treat these as strong leads, not guarantees.</p>`;
  }

  /* ---------------- STOCKING ---------------- */
  function stocking(S) {
    if (S.loading.stocking) return spinner('Loading stocking records…');
    if (S.errors.stocking) return errorBox(S.errors.stocking);
    const st = S.stocking;
    if (!st || !st.rows.length) return `<p class="muted">No DNR stocking records for this lake${S.lake.resources.fishStocking ? '' : ' (not a stocked lake)'}.</p>`;
    const years = [...new Set(st.rows.map(r => r.year))].sort((a, b) => b - a);
    const bySpecies = {};
    for (const r of st.rows) { const k = r.species; bySpecies[k] = bySpecies[k] || { n: 0, lb: 0, years: new Set() }; bySpecies[k].n += r.number; bySpecies[k].lb += r.pounds; bySpecies[k].years.add(r.year); }
    const parts = [];
    parts.push(`<div class="chips">${Object.entries(bySpecies).sort((a, b) => b[1].years.size - a[1].years.size).map(([k, v]) => { const p = FN.profileFor(FN.speciesCode(k)); return `<span class="chip game">${p ? p.icon + ' ' : ''}${esc(k)} <em>${v.years.size} yr${v.years.size === 1 ? '' : 's'}</em></span>`; }).join('')}</div>`);
    parts.push(`<table class="tbl"><thead><tr><th>Year</th><th>Species</th><th>Size</th><th class="n">Number</th><th class="n">Pounds</th></tr></thead><tbody>${years.map(y => st.rows.filter(r => r.year === y).map((r, i) => `<tr><td>${i === 0 ? y : ''}</td><td>${esc(r.species)}${r.notes.length ? `<sup title="${esc(r.notes.map(n => st.notes[n] || n).join('; '))}">${r.notes.join(',')}</sup>` : ''}</td><td>${esc(r.size)}</td><td class="n">${U.num(r.number)}</td><td class="n">${r.pounds ? U.num(r.pounds, 1) : '—'}</td></tr>`).join('')).join('')}</tbody></table>`);
    const used = new Set(st.rows.flatMap(r => r.notes));
    if (used.size) parts.push(`<div class="muted small">${[...used].sort().map(n => `<div><sup>${n}</sup> ${esc(st.notes[n] || '')}</div>`).join('')}</div>`);
    parts.push(`<p class="muted small">Source: Minnesota DNR fish stocking records (LakeFinder). Fry are newly hatched; fingerlings are first-year fish; yearlings and adults are larger.</p>`);
    return parts.join('');
  }

  /* ---------------- FORECAST ---------------- */
  function forecast(S) {
    if (S.loading.weather) return spinner('Fetching weather, moon and sun data…');
    if (S.errors.weather) return errorBox(S.errors.weather);
    const B = S.bite, W = S.weather;
    if (!B || !W) return `<p class="muted">Forecast unavailable.</p>`;
    const parts = [];
    // species chips
    const present = new Set(S.lake.speciesCodes);
    const codes = ['ALL', ...FN.PROFILE_ORDER.filter(c => present.has(c))];
    const seen = new Set();
    parts.push(`<div class="chips scroll">${codes.map(c => { const p = c === 'ALL' ? FN.PROFILES.ALL : FN.profileFor(c); if (!p || seen.has(p.name)) return ''; seen.add(p.name); return `<button class="chip sel pic ${S.species === c ? 'on' : ''}" data-action="species" data-code="${c}">${c === 'ALL' ? p.icon : speciesIcon(c, 'sm')} ${esc(p.name)}</button>`; }).join('')}</div>`);

    // current conditions
    const cur = W.current, now = new Date();
    const curHour = B.hours.filter(h => h.t <= now).pop() || B.hours[0];
    const i = B.hours.indexOf(curHour);
    const p3 = i >= 3 ? curHour.weather.pressure - B.hours[i - 3].weather.pressure : 0;
    const trend = p3 <= -1 ? '↓ falling' : p3 >= 1 ? '↑ rising' : '→ steady';
    const wxd = FN.weather.describe(cur.code);
    parts.push(`<div class="card"><div class="row">${scoreRing(curHour.score, 64)}<div class="grow"><div class="eyebrow">Right now</div><div class="big">${ratingBadge(curHour.rating)} <span class="muted">${esc(B.profile.name)}</span></div>
      <div class="wx">${wxd[1]} ${esc(wxd[0])} · ${Math.round(cur.temp)}°F (feels ${Math.round(cur.feels)}°) · wind ${Math.round(cur.wind)} mph ${U.windDir(cur.windDir)}${cur.gust ? ', gusts ' + Math.round(cur.gust) : ''} · clouds ${cur.cloud}%</div>
      <div class="wx muted">Barometer ${FN.weather.hPaToInHg(cur.pressure)} inHg ${trend} · ${curHour.info.phaseIcon} ${esc(curHour.info.phaseName)} (${Math.round(curHour.info.illumination * 100)}% lit)</div></div></div></div>`);

    // 7-day strip
    const di = Math.min(S.dayIdx || 0, B.days.length - 1);
    parts.push(`<div class="days">${B.days.map((d, k) => { const wx = d.wx ? FN.weather.describe(d.wx.code) : ['', '']; return `<button class="day ${k === di ? 'on' : ''} ${d.rating.cls}" data-action="day" data-i="${k}"><div class="dn">${k === 0 ? 'Today' : d.date.toLocaleDateString('en-US', { weekday: 'short' })}</div><div class="ic">${wx[1]}</div><div class="sc">${d.score}</div><div class="rw">${d.rating.word}</div>${d.wx ? `<div class="hl">${Math.round(d.wx.hi)}° / ${Math.round(d.wx.lo)}°</div>` : ''}</button>`; }).join('')}</div>`);

    const d = B.days[di];
    if (d) {
      const wx = d.wx;
      parts.push(`<div class="dayhead"><div><h2>${U.fmtDate(d.date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>${wx ? `<div class="muted small">${FN.weather.describe(wx.code)[0]} · ${Math.round(wx.hi)}°/${Math.round(wx.lo)}° · wind to ${Math.round(wx.windMax)} mph${wx.pop ? ' · ' + wx.pop + '% precip' : ''}</div>` : ''}</div>${ratingBadge(d.rating)}</div>`);
      parts.push(`<div class="windows">${d.windows.length ? d.windows.map(w => `<div class="win"><div class="t">${windowText(w)}</div><div class="s">peak ${w.peak}</div></div>`).join('') : '<div class="muted small">No window scores above 60 — fish the low-light periods and solunar times below.</div>'}</div>`);
      parts.push(biteChart(d, S.hourIdx));
      const hrSel = S.hourIdx != null ? d.hours.find(h => h.t.getHours() === S.hourIdx) : null;
      const hr = hrSel || d.hours.slice().sort((a, b) => b.score - a.score)[0];
      if (hr) {
        const ex = FN.forecast.explain(hr);
        parts.push(`<div class="why"><div class="eyebrow">${hrSel ? '' : 'Best hour · '}${U.fmtTime(hr.t)} — score ${hr.score} ${ratingBadge(hr.rating)}</div><ul>${ex.map(x => `<li class="${x.value >= 0 ? 'pos' : 'neg'}"><span class="val">${x.value >= 0 ? '+' : ''}${x.value.toFixed(0)}</span><span>${esc(x.label)}${x.detail ? ` <em>${esc(x.detail)}</em>` : ''}</span></li>`).join('')}</ul></div>`);
      }
      const inf = d.info;
      parts.push(`<div class="suncard"><div><div class="eyebrow">Sun</div><div>↑ ${U.fmtTime(inf.sunrise)} · ↓ ${U.fmtTime(inf.sunset)}</div></div>
        <div><div class="eyebrow">Moon ${inf.phaseIcon}</div><div>${esc(inf.phaseName)}${inf.moonrise ? ' · rise ' + U.fmtTime(inf.moonrise) : ''}${inf.moonset ? ' · set ' + U.fmtTime(inf.moonset) : ''}</div></div>
        <div><div class="eyebrow">Solunar periods</div><div class="periods">${inf.periods.map(p => `<span class="per ${p.type}">${p.type === 'major' ? '●' : '○'} ${U.fmtTime(new Date(p.center.getTime() - p.half * 60000))}–${U.fmtTime(new Date(p.center.getTime() + p.half * 60000))} <em>${esc(p.label)}</em></span>`).join('')}</div></div></div>`);
      if (d.drivers.pos.length || d.drivers.neg.length) parts.push(`<div class="drivers">${d.drivers.pos.map(x => `<span class="chip pos">+ ${esc(x.label)}</span>`).join('')}${d.drivers.neg.map(x => `<span class="chip neg">− ${esc(x.label)}</span>`).join('')}</div>`);
    }

    const ins = FN.forecast.insights(S.catches, B.species);
    if (ins) {
      const top = (arr, fmt) => arr.length ? fmt(arr[0]) : '—';
      parts.push(`<div class="card insights"><div class="eyebrow">Your ${esc(B.profile.name.toLowerCase())} history · ${ins.n} catch${ins.n === 1 ? '' : 'es'}</div>
        <div class="irow"><span>Best time</span><b>${top(ins.byPeriod, ([k, v]) => `${k} (${v})`)}</b></div>
        <div class="irow"><span>Best barometer</span><b>${top(ins.byPressure, ([k, v]) => `${k} (${v})`)}</b></div>
        <div class="irow"><span>Best moon</span><b>${top(ins.byMoon, ([k, v]) => `${ins.moonLabel(k)} (${v})`)}</b></div>
        <div class="irow"><span>Best month</span><b>${top(ins.byMonth, ([k, v]) => `${k} (${v})`)}</b></div>
        ${ins.biggest ? `<div class="irow"><span>Biggest</span><b>${ins.biggest.length}″${ins.biggest.lakeName ? ' · ' + esc(ins.biggest.lakeName) : ''}</b></div>` : ''}
        <div class="muted small">${ins.n >= 5 ? 'The hourly scores above include a personal adjustment from this history.' : 'Log 5+ catches of this species and the forecast starts adjusting to your results.'}</div></div>`);
    }
    const prof = B.profile;
    if (prof.depth) {
      const season = FN.seasonOf(d ? d.date : new Date());
      parts.push(`<h2>${speciesIcon(prof.code || B.species, 'sm')} ${esc(prof.name)} this ${season}</h2><p><strong>Depth:</strong> ${esc(prof.depth[season])}</p><p class="muted">${esc(prof.tips || '')}</p>`);
    }
    parts.push(`<p class="muted small">The bite score blends solunar periods (moon overhead/underfoot, rise/set), moon phase, dawn/dusk, barometric trend, wind, cloud cover, precipitation, temperature swings and the season — weighted for the selected species. It is guidance, not a guarantee. Lightning = get off the water.</p>`);
    return parts.join('');
  }

  function biteChart(day, selHour) {
    const W = 600, H = 170, padL = 10, padR = 10, padT = 14, padB = 30;
    const hrs = day.hours;
    const n = 24, bw = (W - padL - padR) / n;
    const inf = day.info;
    const xFor = t => padL + ((t - day.date) / 3600000) * bw;
    const nightRects = [];
    const sr = xFor(inf.sunrise), ss = xFor(inf.sunset);
    nightRects.push(`<rect class="night" x="${padL}" y="${padT}" width="${Math.max(0, sr - padL).toFixed(1)}" height="${H - padT - padB}"/>`);
    nightRects.push(`<rect class="night" x="${ss.toFixed(1)}" y="${padT}" width="${Math.max(0, W - padR - ss).toFixed(1)}" height="${H - padT - padB}"/>`);
    const periods = inf.periods.map(p => { const a = xFor(new Date(p.center.getTime() - p.half * 60000)), b = xFor(new Date(p.center.getTime() + p.half * 60000)); return `<rect class="per ${p.type}" x="${Math.max(padL, a).toFixed(1)}" y="${H - padB + 2}" width="${Math.max(2, Math.min(W - padR, b) - Math.max(padL, a)).toFixed(1)}" height="4" rx="2"><title>${esc(p.label)} ${U.fmtTime(p.center)}</title></rect>`; });
    const bars = hrs.map(h => {
      const x = xFor(h.t), hh = (H - padT - padB) * h.score / 100, y = H - padB - hh;
      const on = selHour != null && h.t.getHours() === selHour;
      return `<g class="bar ${h.rating.cls} ${on ? 'on' : ''}" data-action="hour" data-i="${h.t.getHours()}"><rect class="hit" x="${x.toFixed(1)}" y="${padT}" width="${bw.toFixed(1)}" height="${H - padT - padB}"/><rect class="b" x="${(x + 1.5).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${hh.toFixed(1)}" rx="3"/><title>${U.fmtTime(h.t)}: ${h.score} (${h.rating.word})</title></g>`;
    });
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21].map(hh => `<text x="${(padL + hh * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis-l">${hh === 0 ? '12am' : hh < 12 ? hh + 'am' : hh === 12 ? '12pm' : (hh - 12) + 'pm'}</text>`);
    const grid = [25, 50, 75].map(v => { const y = H - padB - (H - padT - padB) * v / 100; return `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" class="bite-chart" role="img" aria-label="Hourly bite score">${nightRects.join('')}${grid.join('')}${bars.join('')}${periods.join('')}${ticks.join('')}</svg><div class="legend-row"><span><i class="sw night"></i>night</span><span><i class="sw major"></i>major period</span><span><i class="sw minor"></i>minor period</span><span class="muted">tap a bar for details</span></div></div>`;
  }

  /* ---------------- ACCESS ---------------- */
  function access(S) {
    if (S.loading.access) return spinner('Finding public accesses…');
    const sites = S.access || [];
    const D = S.detail;
    const parts = [];
    if (sites.length) {
      parts.push(`<div class="list">${sites.map(s => `<div class="acc"><div class="t">${esc(s.name)}${s.nearby ? ' <span class="muted small">(nearby, on a connected river or bay)</span>' : ''}</div><div class="s">${esc(s.launch || '')}${s.surface ? ' · ' + esc(s.surface) : ''}${s.ramps != null ? ' · ' + s.ramps + ' ramp' + (s.ramps === 1 ? '' : 's') : ''}${s.docks ? ' · ' + s.docks + ' dock' + (s.docks === 1 ? '' : 's') : ''}${s.trailerSpaces ? ' · ' + s.trailerSpaces + ' trailer spots' : ''}${s.toilets ? ' · restroom' : ''}</div>${s.admin ? `<div class="s muted">${esc(s.admin)}</div>` : ''}${s.directions ? `<div class="s">${esc(s.directions)}</div>` : ''}${s.alerts ? `<div class="warn small">${esc(s.alerts)}</div>` : ''}<div class="actions"><button class="btn small" data-action="fly" data-lat="${s.lat}" data-lon="${s.lon}">Show on map</button><a class="btn small ghost" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Directions ${ICON.ext}</a></div></div>`).join('')}</div>`);
    } else if (D && D.accesses.length) {
      parts.push(`<div class="list">${D.accesses.map(a => `<div class="acc"><div class="t">${esc(a.accessTypeId || 'Access')} — ${esc(a.ownerTypeId || '')}</div><div class="s">${esc(a.lakeAccessComments || '')} ${esc(a.location || '')}</div></div>`).join('')}</div>`);
    } else parts.push(`<p class="muted">No public water access sites are listed for this lake.</p>`);
    parts.push(`<p class="muted small">Source: Minnesota DNR public water access inventory.</p>`);
    return parts.join('');
  }

  /* ---------------- PINS ---------------- */
  const pinOnLake = (p, L) => {
    if (p.lakeId && L.id && U.dowPrefix(p.lakeId) === U.dowPrefix(L.id)) return true;
    if (L.bbox) { const [w, s, e, n] = L.bbox; return p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n; }
    return false;
  };
  const coords = p => `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
  function pinPopup(p) {
    return `<div class="pin-popup">
      <div class="pp-name"><i class="dot" style="background:${esc(p.color || '#ffb454')}"></i>${esc(p.name)}</div>
      <div class="pp-meta">${p.lakeName ? esc(p.lakeName) + ' · ' : ''}${p.depth != null ? p.depth + ' ft deep · ' : ''}${new Date(p.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${p.source === 'gps' ? ' · GPS' : ''}${p.shared ? ' · shared with buddies' : ''}</div>
      ${p.notes ? `<div class="pp-notes">${esc(p.notes)}</div>` : ''}
      <div class="pp-coords">${coords(p)}</div>
      <div class="pp-actions">
        <button class="btn small" data-action="pin-edit" data-id="${esc(p.id)}">${ICON.edit} Edit</button>
        <a class="btn small ghost" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}" target="_blank" rel="noopener">Directions ${ICON.ext}</a>
        <button class="btn small ghost" data-action="pin-copy" data-id="${esc(p.id)}">Copy coords</button>
        <button class="btn small ghost" data-action="catch-new" data-pin-id="${esc(p.id)}">🎣 Log catch</button>
        ${p.lakeId ? `<button class="btn small ghost" data-action="open-lake" data-id="${esc(p.lakeId)}">Lake info</button>` : ''}
        <button class="btn small danger" data-action="pin-delete" data-id="${esc(p.id)}">Delete</button>
      </div></div>`;
  }
  function pinEditor(p) {
    return `<div class="lake-head">
      <button class="icon-btn" data-action="pin-back" title="Back">${ICON.back}</button>
      <div class="grow"><h1>Edit pin</h1><div class="s">${p.lakeName ? esc(p.lakeName) + ' · ' : ''}${p.depth != null ? p.depth + ' ft · ' : ''}${coords(p)}</div></div>
    </div>
    <div class="field"><label>Name</label><input type="text" id="pin-name" value="${esc(p.name)}" maxlength="60" autocomplete="off"></div>
    <div class="field"><label>Notes</label><textarea id="pin-notes" rows="4" placeholder="What you caught, bait, structure, time of day…">${esc(p.notes || '')}</textarea></div>
    <div class="field"><label>Color</label><div class="colors">${C.pinColors.map(c => `<button class="${(p.color || '#ffb454') === c ? 'on' : ''}" style="background:${c}" data-action="pin-color" data-c="${c}" aria-label="color"></button>`).join('')}</div></div>
    <label class="switch"><input type="checkbox" id="pin-shared" ${p.shared ? 'checked' : ''}><span>Share this pin with my buddies${FN.app && FN.app.state.user ? '' : ' <em class="muted">(sign in to share)</em>'}</span></label>
    <div class="actions"><button class="btn" data-action="pin-save" data-id="${esc(p.id)}">Save</button><button class="btn ghost" data-action="pin-open" data-id="${esc(p.id)}">Show on map</button><button class="btn ghost danger" data-action="pin-delete" data-id="${esc(p.id)}">Delete</button></div>
    <p class="muted small">Pins are saved on this device. Dropped ${new Date(p.created).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}${p.accuracy ? ` · GPS accuracy ±${Math.round(p.accuracy)} m` : ''}.</p>`;
  }
  const pinMenu = () => `<div class="panel-head"><strong>Drop a pin</strong><button class="icon-btn" data-action="pin-menu-close">${ICON.close}</button></div>
    <button class="menu-item" data-action="pin-gps">${ICON.locate}<span><b>At my location</b><small>Uses your phone's GPS</small></span></button>
    <button class="menu-item" data-action="pin-place">${ICON.pin}<span><b>Pick a spot</b><small>Then tap the map where you want it</small></span></button>
    <p class="muted small">Tip: long-press (right-click on a computer) anywhere on the map to drop a pin instantly. Tapping a mapped lake shows the depth with a “Drop pin here” button.</p>`;

  /* ---------------- LAYERS PANEL / LEGEND ---------------- */
  function layersPanel(s) {
    const bands = C.depthBands;
    const mins = [0, ...bands.slice(0, -1).map(b => b.max)];
    return `<div class="panel-head"><strong>Map layers</strong><button class="icon-btn" data-action="layers-close">${ICON.close}</button></div>
    <div class="seg">${[['sat', 'Satellite'], ['topo', 'Topo'], ['street', 'Streets'], ['dark', 'Dark']].map(([k, n]) => `<button class="${s.basemap === k ? 'on' : ''}" data-action="basemap" data-v="${k}">${n}</button>`).join('')}</div>
    <label class="switch"><input type="checkbox" data-toggle="relief" ${s.relief ? 'checked' : ''}><span>Depth shading</span></label>
    <label class="switch"><input type="checkbox" data-toggle="contours" ${s.contours ? 'checked' : ''}><span>Depth contours</span></label>
    <label class="switch"><input type="checkbox" data-toggle="labels" ${s.labels ? 'checked' : ''}><span>Depth labels (zoom 13+)</span></label>
    <label class="range"><span>Shading opacity</span><input type="range" min="0.2" max="1" step="0.05" value="${s.opacity}" data-range="opacity"></label>
    <div class="depth-filter"><div class="eyebrow">Highlight depth range</div><div class="row">
      <select data-depth="min">${mins.map(v => `<option value="${v}" ${v === s.depthMin ? 'selected' : ''}>${v} ft</option>`).join('')}</select><span>to</span>
      <select data-depth="max">${bands.map(b => `<option value="${b.max}" ${b.max === s.depthMax ? 'selected' : ''}>${b.max === 999 ? 'max' : b.max + ' ft'}</option>`).join('')}</select>
      <button class="btn small ghost" data-action="depth-reset">Reset</button></div></div>
    <p class="muted small">Contours appear at zoom 10+. Depth data: MN DNR lake bathymetry (not for navigation).</p>`;
  }
  const legend = () => `<div class="legend-title">Depth</div>${C.depthBands.map(b => `<div class="lg"><i style="background:${b.color}"></i>${b.label}</div>`).join('')}`;

  const depthPopup = (res, currentId, latlng) => {
    let html = '';
    if (res.depth != null) html += `<div class="pd">${res.approx ? '≈ ' : ''}${Math.round(res.depth)} ft</div>`;
    else html += `<div class="pd muted">No depth data</div>`;
    if (res.lake) html += `<div class="pl">${esc(res.lake.name)}</div>`;
    html += `<div class="pp-actions">`;
    html += `<button class="btn small" data-action="pin-here" data-lat="${latlng.lat}" data-lon="${latlng.lng}" ${res.depth != null ? `data-depth="${Math.round(res.depth)}"` : ''} ${res.lake ? `data-lake-id="${esc(res.lake.dow)}" data-lake-name="${esc(res.lake.name)}"` : ''}>${ICON.pin} Drop pin here</button>`;
    if (res.lake && (!currentId || U.dowPrefix(res.lake.dow) !== U.dowPrefix(currentId))) html += `<button class="btn small ghost" data-action="open-lake" data-id="${esc(res.lake.dow)}">Open lake</button>`;
    html += `</div>`;
    return `<div class="depth-popup">${html}</div>`;
  };

  return { ICON, home, lake, top, searchResults, layersPanel, legend, depthPopup, spinner, errorBox, ratingBadge, scoreRing, pinPopup, pinEditor, pinMenu, speciesIcon, gearShort, lakeRow, pinRow, windowText };
})();
