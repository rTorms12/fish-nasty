/* Fish Nasty — account, catch log, buddies and lake-finder views (extends FN.ui) */
window.FN = window.FN || {};

Object.assign(FN.ui, (() => {
  const U = FN.util, C = FN.config, esc = U.esc;
  const { ICON, spinner, errorBox, speciesIcon, gearShort } = FN.ui;
  const head = (title, sub, back = 'home', extra = '') => `<div class="lake-head"><button class="icon-btn" data-action="${back}" title="Back">${ICON.back}</button><div class="grow"><h1>${title}</h1>${sub ? `<div class="s">${sub}</div>` : ''}</div>${extra}</div>`;
  const msg = m => (m ? `<div class="${m.kind === 'err' ? 'error' : 'okbox'}">${esc(m.text)}</div>` : '');
  const fmtWhen = iso => { const d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + ' · ' + U.fmtTime(d); };
  const condLine = c => {
    const k = c.conditions || {};
    const parts = [];
    if (k.code != null) parts.push(`${FN.weather.describe(k.code)[1]} ${k.temp != null ? Math.round(k.temp) + '°F' : ''}`.trim());
    if (k.pressure != null) parts.push(`${FN.weather.hPaToInHg(k.pressure)} inHg${k.pressureTrend ? ' ' + k.pressureTrend : ''}`);
    if (k.wind != null) parts.push(`wind ${Math.round(k.wind)} mph ${U.windDir(k.windDir)}`.trim());
    if (k.moonName) parts.push(k.moonName.toLowerCase());
    if (k.biteScore != null) parts.push(`bite ${k.biteScore}`);
    return parts.join(' · ');
  };

  /* ---------------- ACCOUNT ---------------- */
  function account(S) {
    if (!FN.cloud.available()) return head('Account') + errorBox('Cloud features are not configured for this build.');
    if (S.user) {
      const name = (S.profile && S.profile.display_name) || S.user.email.split('@')[0];
      return head('Account', esc(S.user.email)) + `
        ${msg(S.authMsg)}
        <form data-form="profile" class="card"><div class="field"><label>Display name (what buddies see)</label><input type="text" id="profile-name" value="${esc(name)}" maxlength="40"></div><div class="actions"><button class="btn" type="submit">Save name</button></div></form>
        <div class="card"><div class="eyebrow">Sync</div><p class="small">${S.syncing ? 'Syncing…' : S.lastSync ? `Last synced ${U.fmtTime(S.lastSync)}.` : 'Not synced yet.'} ${S.pins.length} pin${S.pins.length === 1 ? '' : 's'}, ${S.favorites.length} favorite${S.favorites.length === 1 ? '' : 's'}, ${S.catches.length} catch${S.catches.length === 1 ? '' : 'es'} on this device.</p><div class="actions"><button class="btn ghost" data-action="sync-now">Sync now</button></div></div>
        <form data-form="newpass" class="card"><div class="eyebrow">Change password</div><div class="field"><label>New password</label><input type="password" id="newpass" minlength="8" autocomplete="new-password" placeholder="at least 8 characters"></div><div class="actions"><button class="btn ghost" type="submit">Update password</button></div></form>
        <div class="actions"><button class="btn ghost danger" data-action="signout">Sign out</button></div>
        <p class="muted small">Signing out keeps a copy of everything on this device.</p>`;
    }
    const mode = S.authMode || 'signin';
    const tabs = [['signin', 'Sign in'], ['signup', 'Create account'], ['magic', 'Email me a link']];
    return head('Sign in', 'Sync pins and favorites, log catches, share with buddies') + `
      <div class="seg">${tabs.map(([k, n]) => `<button class="${mode === k ? 'on' : ''}" data-action="auth-mode" data-mode="${k}">${n}</button>`).join('')}</div>
      ${msg(S.authMsg)}
      <form data-form="auth" class="card" autocomplete="on">
        ${mode === 'signup' ? `<div class="field"><label>Display name</label><input type="text" id="auth-name" maxlength="40" autocomplete="nickname" placeholder="What your buddies will see"></div>` : ''}
        <div class="field"><label>Email</label><input type="email" id="auth-email" autocomplete="email" inputmode="email" required value="${esc(S.authEmail || '')}"></div>
        ${mode === 'signin' || mode === 'signup' ? `<div class="field"><label>Password</label><input type="password" id="auth-password" minlength="8" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required placeholder="${mode === 'signup' ? 'at least 8 characters' : ''}"></div>` : ''}
        ${mode === 'reset' ? `<p class="small muted">We'll email you a link to set a new password.</p>` : ''}
        <div class="actions"><button class="btn" type="submit" ${S.authBusy ? 'disabled' : ''}>${S.authBusy ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Send sign-in link' : 'Send reset link'}</button>
        ${mode === 'signin' ? `<button class="btn ghost" type="button" data-action="auth-mode" data-mode="reset">Forgot password?</button>` : ''}</div>
      </form>
      <p class="muted small">${mode === 'magic' ? 'The link signs you in without a password. Open it on the same phone or computer you are using now.' : mode === 'signup' ? 'You may get a confirmation email first; tap its link, then sign in here.' : 'Your pins and favorites stay on this device either way; signing in backs them up and syncs them.'}</p>`;
  }

  /* ---------------- CATCH FORM ---------------- */
  function catchForm(S) {
    const f = S.catchForm;
    if (!f) return head('Log a catch') + errorBox('Nothing to log.');
    const codes = [];
    const push = c => { if (c && !codes.includes(c) && FN.profileFor(c)) codes.push(c); };
    ['WAE', 'NOP', 'BLC', 'LMB', 'SMB', 'MUE', 'BLG', 'YEP', 'LAT'].forEach(push);
    (S.lake ? S.lake.speciesCodes : []).forEach(push);
    push(f.species);
    const seen = new Set();
    const chips = codes.map(c => { const p = FN.profileFor(c); if (!p || seen.has(p.name)) return ''; seen.add(p.name); return `<button type="button" class="chip sel pic ${f.species === c ? 'on' : ''}" data-action="catch-species" data-code="${c}">${speciesIcon(c, 'sm')} ${esc(p.name)}</button>`; }).join('');
    const when = f.caughtAt ? new Date(f.caughtAt) : new Date();
    const local = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const where = f.pinName ? `📍 ${esc(f.pinName)}` : f.lakeName ? `🌊 ${esc(f.lakeName)}` : f.lat ? `${f.lat.toFixed(4)}, ${f.lon.toFixed(4)}` : 'No location';
    return head(f.id ? 'Edit catch' : 'Log a catch', where, 'catch-cancel') + `
      <form data-form="catch">
        <div class="field"><label>Species</label><div class="chips scroll">${chips}</div></div>
        <div class="grid2">
          <div class="field"><label>Length (inches)</label><input type="number" id="catch-length" step="0.25" min="0" max="80" inputmode="decimal" value="${f.length != null ? f.length : ''}" placeholder="e.g. 24.5"></div>
          <div class="field"><label>Weight (lb)</label><input type="number" id="catch-weight" step="0.1" min="0" max="100" inputmode="decimal" value="${f.weight != null ? f.weight : ''}" placeholder="optional"></div>
        </div>
        <div class="field"><label>Bait / lure</label><input type="text" id="catch-bait" maxlength="80" value="${esc(f.bait || '')}" placeholder="jig + minnow, #5 Rapala…"></div>
        <div class="field"><label>When</label><input type="datetime-local" id="catch-when" value="${local}"></div>
        <div class="field"><label>Notes</label><textarea id="catch-notes" rows="3" placeholder="Depth, structure, how it hit…">${esc(f.notes || '')}</textarea></div>
        <div class="field"><label>Photo</label>${f.photoPreview || f.photoPath ? `<div class="preview"><img ${f.photoPreview ? `src="${f.photoPreview}"` : `data-photo="${esc(f.photoPath)}"`} alt=""><button type="button" class="btn small ghost" data-action="catch-photo-clear">Remove</button></div>` : ''}<input type="file" id="catch-photo" accept="image/*" capture="environment" data-file="catch-photo"></div>
        <label class="switch"><input type="checkbox" id="catch-released" ${f.released ? 'checked' : ''}><span>Released</span></label>
        <label class="switch"><input type="checkbox" id="catch-shared" ${f.shared ? 'checked' : ''}><span>Share with buddies${S.user ? '' : ' <em class="muted">(sign in to share)</em>'}</span></label>
        ${f.conditions && f.conditions.biteScore != null ? `<p class="muted small">Conditions saved with this catch: ${esc(condLine(f))}</p>` : `<p class="muted small">The weather, barometer, moon and bite score at that time are saved with the catch automatically.</p>`}
        <div class="actions"><button class="btn" type="submit" ${S.catchBusy ? 'disabled' : ''}>${S.catchBusy ? 'Saving…' : 'Save catch'}</button><button class="btn ghost" type="button" data-action="catch-cancel">Cancel</button>${f.id ? `<button class="btn ghost danger" type="button" data-action="catch-delete" data-id="${esc(f.id)}">Delete</button>` : ''}</div>
      </form>`;
  }

  /* ---------------- CATCH LOG ---------------- */
  const catchRow = (c, open = false) => {
    const p = FN.profileFor(c.species);
    return `<button class="crow ${open ? 'open' : ''}" data-action="catch-open" data-id="${esc(c.id)}">${speciesIcon(c.species, 'md')}<div class="grow"><div class="t">${esc(p ? p.name : (c.speciesName || c.species))}${c.length ? ` · <b>${c.length}″</b>` : ''}${c.weight ? ` · ${c.weight} lb` : ''}${c.released ? ' · released' : ''}</div><div class="s">${c.lakeName ? esc(c.lakeName) + ' · ' : ''}${fmtWhen(c.caughtAt)}${c.shared ? ' · shared' : ''}${c.synced === false ? ' · <em>not backed up yet</em>' : ''}</div></div>${c.photoPath || c.photoLocal ? '<span class="has-photo">📷</span>' : ''}<div class="chev">${open ? '⌄' : '›'}</div></button>`;
  };
  const catchDetail = (c, S) => `<div class="cdetail">
      ${c.photoLocal || c.photoPath ? `<img class="cphoto" ${c.photoLocal ? `src="${c.photoLocal}"` : `data-photo="${esc(c.photoPath)}"`} alt="">` : ''}
      ${c.bait ? `<div><b>Bait:</b> ${esc(c.bait)}</div>` : ''}
      ${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}
      ${condLine(c) ? `<div class="muted small">${esc(condLine(c))}</div>` : ''}
      <div class="actions">
        ${c.userId && S.user && c.userId !== S.user.id ? '' : `<button class="btn small" data-action="catch-edit" data-id="${esc(c.id)}">${ICON.edit} Edit</button>`}
        ${c.lakeId ? `<button class="btn small ghost" data-action="open-lake" data-id="${esc(c.lakeId)}">Lake</button>` : ''}
        ${c.lat ? `<button class="btn small ghost" data-action="fly" data-lat="${c.lat}" data-lon="${c.lon}">Show on map</button>` : ''}
        ${c.userId && S.user && c.userId !== S.user.id ? '' : `<button class="btn small ghost danger" data-action="catch-delete" data-id="${esc(c.id)}">Delete</button>`}
      </div></div>`;

  function catches(S) {
    const list = [...S.catches].sort((a, b) => (a.caughtAt < b.caughtAt ? 1 : -1));
    const ins = FN.forecast.insights(list, 'ALL');
    const parts = [head('Catch log', `${list.length} catch${list.length === 1 ? '' : 'es'}${S.user ? '' : ' · on this device only'}`, 'home', `<button class="icon-btn" data-action="catch-new" title="Log a catch">${ICON.plus}</button>`)];
    if (!list.length) parts.push(`<div class="card"><p>No catches yet. Tap <b>+</b> to log one, or use “Log catch” on any pin.</p><div class="actions"><button class="btn" data-action="catch-new">+ Log a catch</button></div></div>`);
    if (ins) {
      const bySpecies = new Map();
      for (const c of list) { const p = FN.profileFor(c.species); const k = p ? p.name : c.species; bySpecies.set(k, (bySpecies.get(k) || 0) + 1); }
      parts.push(`<div class="card insights"><div class="eyebrow">Your patterns</div>
        <div class="chips">${[...bySpecies.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip">${esc(k)} <em>${v}</em></span>`).join('')}</div>
        ${ins.biggest ? `<div class="irow"><span>Biggest</span><b>${ins.biggest.length}″ ${esc((FN.profileFor(ins.biggest.species) || {}).name || '')}${ins.biggest.lakeName ? ' · ' + esc(ins.biggest.lakeName) : ''}</b></div>` : ''}
        <div class="irow"><span>Best time</span><b>${ins.byPeriod.length ? `${ins.byPeriod[0][0]} (${ins.byPeriod[0][1]})` : '—'}</b></div>
        <div class="irow"><span>Best barometer</span><b>${ins.byPressure.length ? `${ins.byPressure[0][0]} (${ins.byPressure[0][1]})` : '—'}</b></div>
        <div class="irow"><span>Best moon</span><b>${ins.byMoon.length ? `${ins.moonLabel(ins.byMoon[0][0])} (${ins.byMoon[0][1]})` : '—'}</b></div>
        <div class="irow"><span>Top lakes</span><b>${ins.byLake.slice(0, 3).map(([k, v]) => `${esc(k)} (${v})`).join(', ') || '—'}</b></div>
        ${ins.avgBite != null ? `<div class="irow"><span>Avg bite score when you caught</span><b>${ins.avgBite}</b></div>` : ''}
        <div class="muted small">Per-species patterns feed back into the Forecast tab once you have 5+ catches of that species.</div></div>`);
    }
    let lastDay = '';
    for (const c of list) {
      const day = new Date(c.caughtAt).toDateString();
      if (day !== lastDay) { parts.push(`<h2>${U.fmtDate(new Date(c.caughtAt), { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</h2>`); lastDay = day; }
      const open = S.openCatch === c.id;
      parts.push(catchRow(c, open));
      if (open) parts.push(catchDetail(c, S));
    }
    return parts.join('');
  }

  /* ---------------- BUDDIES ---------------- */
  function buddies(S) {
    const B = S.buddies || {};
    const me = S.user && S.user.id;
    const parts = [head('Buddies', 'Share spots, catches and lake reports')];
    if (!S.user) return parts.join('') + `<div class="card"><p>Sign in to add buddies and see what they're sharing.</p><div class="actions"><button class="btn" data-action="account">Sign in</button></div></div>`;
    parts.push(`<form data-form="invite" class="card"><div class="eyebrow">Add a buddy</div><div class="row"><input type="email" id="invite-email" placeholder="their email" inputmode="email" required class="grow"><button class="btn" type="submit">Invite</button></div>${msg(B.msg)}<p class="muted small">If they already use Fish Nasty they get a request; otherwise it connects the moment they sign up with that email.</p></form>`);
    if (B.loading) parts.push(spinner('Loading buddies…'));
    if (B.error) parts.push(errorBox(B.error));
    const fr = B.friendships || [];
    const name = p => (p ? (p.display_name || p.email) : null);
    const incoming = fr.filter(f => f.status === 'pending' && f.addressee_id === me);
    const outgoing = fr.filter(f => f.status === 'pending' && f.requester_id === me);
    const friends = fr.filter(f => f.status === 'accepted');
    if (incoming.length) parts.push(`<h2>Requests</h2><div class="list">${incoming.map(f => `<div class="lrow"><div><div class="t">${esc(name(f.requester) || 'Someone')}</div><div class="s">${esc((f.requester && f.requester.email) || '')}</div></div><div class="actions"><button class="btn small" data-action="buddy-accept" data-id="${esc(f.id)}">Accept</button><button class="btn small ghost" data-action="buddy-decline" data-id="${esc(f.id)}">Decline</button></div></div>`).join('')}</div>`);
    parts.push(`<h2>Your buddies <span class="muted small">(${friends.length})</span></h2>`);
    if (friends.length) parts.push(`<div class="list">${friends.map(f => { const other = f.requester_id === me ? f.addressee : f.requester; return `<div class="lrow"><div><div class="t">${esc(name(other) || f.addressee_email)}</div><div class="s">${esc((other && other.email) || f.addressee_email)}</div></div><button class="icon-btn mini" data-action="buddy-remove" data-id="${esc(f.id)}" title="Remove">${ICON.close}</button></div>`; }).join('')}</div>`);
    else parts.push(`<p class="muted small">No buddies yet.</p>`);
    if (outgoing.length) parts.push(`<h2>Waiting on them</h2><div class="list">${outgoing.map(f => `<div class="lrow"><div><div class="t">${esc(f.addressee_email)}</div><div class="s">${f.addressee_id ? 'request sent' : 'not signed up yet — they connect when they do'}</div></div><button class="icon-btn mini" data-action="buddy-remove" data-id="${esc(f.id)}" title="Cancel">${ICON.close}</button></div>`).join('')}</div>`);
    const feed = B.feed || [];
    parts.push(`<h2>Shared with you</h2>`);
    if (!feed.length) parts.push(`<p class="muted small">Nothing shared yet. Pins and catches your buddies mark “share” show up here, along with their lake reports.</p>`);
    for (const it of feed) {
      if (it.kind === 'pin') parts.push(`<div class="feed"><div class="who">📍 <b>${esc(it.who)}</b> shared a pin · ${fmtWhen(it.t)}</div><div class="t">${esc(it.pin.name)}</div><div class="s">${it.pin.lakeName ? esc(it.pin.lakeName) + ' · ' : ''}${it.pin.depth != null ? it.pin.depth + ' ft · ' : ''}${it.pin.lat.toFixed(4)}, ${it.pin.lon.toFixed(4)}</div>${it.pin.notes ? `<div class="notes">${esc(it.pin.notes)}</div>` : ''}<div class="actions"><button class="btn small" data-action="feed-pin" data-lat="${it.pin.lat}" data-lon="${it.pin.lon}" data-name="${esc(it.pin.name)}">Show on map</button><button class="btn small ghost" data-action="pin-save-copy" data-i="${feed.indexOf(it)}">Save to my pins</button>${it.lakeId ? `<button class="btn small ghost" data-action="open-lake" data-id="${esc(it.lakeId)}">Lake</button>` : ''}</div></div>`);
      else if (it.kind === 'catch') { const c = it.catch; const p = FN.profileFor(c.species); parts.push(`<div class="feed"><div class="who">🎣 <b>${esc(it.who)}</b> caught a ${esc(p ? p.name.toLowerCase() : c.species)} · ${fmtWhen(it.t)}</div><div class="t">${c.length ? c.length + '″ ' : ''}${esc(p ? p.name : c.species)}${c.weight ? ' · ' + c.weight + ' lb' : ''}${c.lakeName ? ' · ' + esc(c.lakeName) : ''}</div>${c.photoPath ? `<img class="cphoto" data-photo="${esc(c.photoPath)}" alt="">` : ''}${c.bait ? `<div class="s">Bait: ${esc(c.bait)}</div>` : ''}${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}${condLine(c) ? `<div class="muted small">${esc(condLine(c))}</div>` : ''}<div class="actions">${c.lat ? `<button class="btn small" data-action="fly" data-lat="${c.lat}" data-lon="${c.lon}">Show on map</button>` : ''}${it.lakeId ? `<button class="btn small ghost" data-action="open-lake" data-id="${esc(it.lakeId)}">Lake</button>` : ''}</div></div>`); }
      else parts.push(`<div class="feed"><div class="who">📝 <b>${esc(it.who)}</b> · lake report${it.lakeName ? ' · ' + esc(it.lakeName) : ''} · ${fmtWhen(it.t)}</div><div class="notes">${esc(it.report.body)}</div><div class="actions">${it.lakeId ? `<button class="btn small ghost" data-action="open-lake" data-id="${esc(it.lakeId)}">Lake</button>` : ''}</div></div>`);
    }
    if (B.myReports && B.myReports.length) parts.push(`<h2>Your reports</h2><div class="list">${B.myReports.map(r => `<div class="feed mine"><div class="who">${r.lake_name ? esc(r.lake_name) + ' · ' : ''}${fmtWhen(r.created_at)}</div><div class="notes">${esc(r.body)}</div><div class="actions"><button class="btn small ghost danger" data-action="report-delete" data-id="${esc(r.id)}">Delete</button></div></div>`).join('')}</div>`);
    return parts.join('');
  }

  function reportForm(S) {
    const L = S.lake;
    return head('Lake report', L ? esc(L.name) : '', 'report-cancel') + `<form data-form="report" class="card"><div class="field"><label>What's happening${L ? ' on ' + esc(L.name) : ''}?</label><textarea id="report-body" rows="5" maxlength="2000" placeholder="Water temp, where the fish are, what's working…" required></textarea></div><div class="actions"><button class="btn" type="submit">Share with buddies</button><button class="btn ghost" type="button" data-action="report-cancel">Cancel</button></div></form>`;
  }

  /* ---------------- LAKE FINDER ---------------- */
  const MIN_N = { WAE: 40, NOP: 25, BLC: 40 }, BIG = { WAE: 20, NOP: 30, BLC: 11 }, TROPHY = { WAE: 25, NOP: 36, BLC: 13 };
  const MINLEN = { WAE: [0, 24, 26, 28, 30], NOP: [0, 36, 40, 44], BLC: [0, 12, 13, 14, 15] };
  const miles = m => m / 1609.344;
  const dist = (a, b) => { const R = 6371000, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

  function finderResults(S) {
    const F = S.finder, sp = F.species, mode = F.mode;
    const M = S.lakeMetrics;
    let rows, source;
    if (M && M.rows) { rows = M.rows.filter(r => r.species === sp && (r.acres || 0) >= 50); source = 'live'; }
    else if (S.rankings && S.rankings.species[sp]) { rows = (mode === 'big' ? S.rankings.species[sp].bigLakes : S.rankings.species[sp].manyLakes).map(r => ({ ...r })); source = 'static'; }
    else return { rows: [], source: 'none' };
    rows = rows.filter(r => mode === 'big' ? (r.n || 0) >= MIN_N[sp] && (!F.minLen || (r.max || 0) >= F.minLen) : (r.nets || 0) >= 2 && (r.cpue || 0) > 0);
    if (F.scope === 'near' && S.location) { const here = S.location, rm = F.radius * 1609.344; rows = rows.filter(r => r.lat != null).map(r => ({ ...r, dist: dist(here, r) })).filter(r => r.dist <= rm); }
    else if (F.scope === 'county' && F.county) rows = rows.filter(r => (r.county || '').toLowerCase() === F.county.toLowerCase());
    rows.sort(mode === 'big' ? (a, b) => (b.pctBig - a.pctBig) || (b.max - a.max) || (b.n - a.n) : (a, b) => (b.cpue - a.cpue) || (b.catch - a.catch));
    return { rows, source };
  }

  function finder(S) {
    const F = S.finder, sp = F.species, mode = F.mode;
    const p = FN.profileFor(sp);
    const { rows, source } = finderResults(S);
    const M = S.lakeMetrics;
    const sub = M ? `${U.num(M.lakes)} surveyed lakes · DNR data refreshed ${new Date(M.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : (S.rankings ? `Top 20 only (offline copy built ${esc(S.rankings.built)})` : 'From DNR fisheries surveys');
    const parts = [head('Lake finder', sub)];
    if (S.loading.metrics) parts.push(spinner('Loading statewide survey data…'));
    parts.push(`<div class="chips scroll">${['WAE', 'NOP', 'BLC'].map(c => `<button class="chip sel pic ${sp === c ? 'on' : ''}" data-action="finder-species" data-code="${c}">${speciesIcon(c, 'sm')} ${esc(FN.profileFor(c).name)}</button>`).join('')}</div>`);
    parts.push(`<div class="seg"><button class="${mode === 'big' ? 'on' : ''}" data-action="finder-mode" data-mode="big">🏆 Biggest fish</button><button class="${mode === 'many' ? 'on' : ''}" data-action="finder-mode" data-mode="many">🎣 Most fish</button></div>`);
    parts.push(`<div class="seg">${[['state', 'Statewide'], ['near', 'Near me'], ['county', 'County']].map(([k, n]) => `<button class="${F.scope === k ? 'on' : ''}" data-action="finder-scope" data-scope="${k}" ${k !== 'state' && source === 'static' ? 'disabled title="needs the live data"' : ''}>${n}</button>`).join('')}</div>`);
    const filters = [];
    if (F.scope === 'near') filters.push(`<label>Within <select data-finder="radius">${[25, 50, 75, 100, 150].map(r => `<option value="${r}" ${F.radius === r ? 'selected' : ''}>${r} mi</option>`).join('')}</select>${S.location ? '' : ` <button class="btn small" data-action="locate-nearby">Use my location</button>`}</label>`);
    if (F.scope === 'county') filters.push(`<label>County <select data-finder="county"><option value="">choose…</option>${C.counties.filter(Boolean).map(c => `<option value="${esc(c)}" ${F.county === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`);
    if (mode === 'big') filters.push(`<label>Longest netted <select data-finder="minLen">${MINLEN[sp].map(v => `<option value="${v}" ${F.minLen === v ? 'selected' : ''}>${v ? v + '″ or more' : 'any'}</option>`).join('')}</select></label>`);
    parts.push(`<div class="filters">${filters.join('')}</div>`);
    const shown = rows.slice(0, F.limit);
    if (F.scope === 'near' && !S.location) parts.push(`<p class="muted small">Tap “Use my location” to rank lakes around you.</p>`);
    else if (!rows.length) parts.push(`<p class="muted">No lakes match. Try a wider radius, a different county, or a smaller minimum size.</p>`);
    parts.push(`<div class="list">${shown.map((l, i) => { const metric = mode === 'big' ? `<b>${l.pctBig}%</b> of ${U.num(l.n)} netted were ${BIG[sp]}″+ · longest ${l.max}″${l.nTrophy ? ` · ${l.nTrophy} over ${TROPHY[sp]}″` : ''} · ${(l.years || []).join(', ')}` : `<b>${U.num(l.cpue, 1)}</b> per ${esc(gearShort(l.gear))} · ${U.num(l.catch)} caught in ${l.nets} nets · ${l.year}${l.normal && l.normal !== 'N/A' ? ` · normal ${esc(l.normal)}` : ''}`; return `<button class="toprow" data-action="open-lake" data-id="${esc(l.id)}"><div class="rank">${i + 1}</div><div class="grow"><div class="t">${esc(l.name)} <span class="muted small">${esc(l.county || '')} Co. · ${U.num(l.acres)} ac${l.dist != null ? ` · ${Math.round(miles(l.dist))} mi` : ''}</span></div><div class="s">${metric}</div></div><div class="chev">›</div></button>`; }).join('')}</div>`);
    if (rows.length > shown.length) parts.push(`<div class="actions"><button class="btn ghost" data-action="finder-more">Show ${Math.min(20, rows.length - shown.length)} more of ${U.num(rows.length)}</button></div>`);
    parts.push(mode === 'big'
      ? `<p class="muted small">Ranked by the share of netted ${esc(p.name.toLowerCase())} measuring ${BIG[sp]}″ or longer in each lake's two most recent surveys with length data (at least ${MIN_N[sp]} fish measured, lakes over 50 acres).</p>`
      : `<p class="muted small">Ranked by catch per net in the most recent survey (standard gill nets for walleye and pike, trap nets for crappie; at least 2 nets, lakes over 50 acres). “Normal” is the statewide 25th–75th percentile for similar lakes.</p>`);
    parts.push(`<p class="muted small">Data: Minnesota DNR LakeFinder surveys, refreshed monthly. Nets sample one day; treat these as leads.</p>`);
    return parts.join('');
  }

  return { account, catchForm, catches, catchRow, buddies, reportForm, finder, finderResults, condLine };
})());
