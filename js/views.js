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
    if (k.code != null) parts.push(`${FN.weather.describe(k.code)[1]} ${k.temp != null ? Math.round(k.temp) + '°F' : ''}${k.dayHi != null ? ` (day ${Math.round(k.dayHi)}/${Math.round(k.dayLo)})` : ''}`.trim());
    if (k.waterTemp != null) parts.push(`water ~${Math.round(k.waterTemp)}°F`);
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
    const welcome = !!S.welcome;
    return (welcome
      ? `<div class="hero"><div class="logo">${ICON.fish}</div><div><h1>Welcome to Fish Nasty</h1><p>Create a free account to back up your pins, log catches with photos, and share spots with buddies.</p></div></div>`
      : head('Sign in', 'Sync pins and favorites, log catches, share with buddies')) + `
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
      <p class="muted small">${mode === 'magic' ? 'The link signs you in without a password. Open it on the same phone or computer you are using now.' : mode === 'signup' ? 'You may get a confirmation email first; tap its link, then sign in here.' : 'Your pins and favorites stay on this device either way; signing in backs them up and syncs them.'}</p>
      ${welcome ? `<div class="actions"><button class="btn ghost" data-action="welcome-skip">Continue without an account</button></div>` : ''}`;
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
        <div class="field"><label>Photo</label>${f.photoPreview || f.photoPath ? `<div class="preview"><img ${f.photoPreview ? `src="${f.photoPreview}"` : `data-photo="${esc(f.photoPath)}"`} alt=""><button type="button" class="btn small ghost" data-action="catch-photo-clear">Remove</button></div>` : ''}<div class="photo-pick" id="catch-photo"><label class="btn small ghost"><input type="file" accept="image/*" data-file="catch-photo">🖼️ Choose from photos</label><label class="btn small ghost"><input type="file" accept="image/*" capture="environment" data-file="catch-photo">📷 Take a photo</label></div></div>
        <label class="switch"><input type="checkbox" id="catch-released" ${f.released ? 'checked' : ''}><span>Released</span></label>
        <label class="switch"><input type="checkbox" id="catch-shared" ${f.shared ? 'checked' : ''}><span>Share with buddies${S.user ? '' : ' <em class="muted">(sign in to share)</em>'}</span></label>
        ${f.conditions && f.conditions.biteScore != null ? `<p class="muted small">Conditions saved with this catch: ${esc(condLine(f))}</p>` : `<p class="muted small">The weather, barometer, moon and bite score at that time are saved with the catch automatically.</p>`}
        <div class="actions"><button class="btn" type="submit" ${S.catchBusy ? 'disabled' : ''}>${S.catchBusy ? 'Saving…' : 'Save catch'}</button><button class="btn ghost" type="button" data-action="catch-cancel">Cancel</button>${f.id ? `<button class="btn ghost danger" type="button" data-action="catch-delete" data-id="${esc(f.id)}">Delete</button>` : ''}</div>
      </form>`;
  }

  /* ---------------- CATCH LOG ---------------- */
  const catchRow = (c, open = false) => {
    const p = FN.profileFor(c.species);
    return `<button class="crow ${open ? 'open' : ''}" data-action="catch-open" data-id="${esc(c.id)}">${speciesIcon(c.species, 'md')}<div class="grow"><div class="t">${esc(p ? p.name : (c.speciesName || c.species))}${c.length ? ` · <b>${c.length}″</b>` : ''}${c.weight ? ` · ${c.weight} lb` : ''}${c.released ? ' · released' : ''}${FN.app && pbIds(FN.app.state.catches).has(c.id) ? '<span class="pbtag" title="Personal best">🏆</span>' : ''}</div><div class="s">${c.pinName ? '📍 ' + esc(c.pinName) + ' · ' : c.lakeName ? esc(c.lakeName) + ' · ' : ''}${fmtWhen(c.caughtAt)}${c.shared ? ' · shared' : ''}${c.synced === false ? ' · <em>not backed up yet</em>' : ''}</div></div>${c.photoPath || c.photoLocal ? '<span class="has-photo">📷</span>' : ''}<div class="chev">${open ? '⌄' : '›'}</div></button>`;
  };
  const condGrid = c => {
    const k = c.conditions || {};
    const fmtT = iso => U.fmtTime(new Date(iso));
    const rows = [
      k.code != null ? ['Sky', `${FN.weather.describe(k.code)[0]} ${FN.weather.describe(k.code)[1]}${k.cloud != null ? ` · ${Math.round(k.cloud)}% cloud` : ''}`] : null,
      k.temp != null ? ['Air', `${Math.round(k.temp)}°F${k.dayHi != null ? ` · day ${Math.round(k.dayHi)}/${Math.round(k.dayLo)}°` : ''}`] : null,
      k.waterTemp != null ? ['Water (modeled)', `~${Math.round(k.waterTemp)}°F`] : null,
      k.wind != null ? ['Wind', `${Math.round(k.wind)} mph ${U.windDir(k.windDir)}${k.gust ? ` · gusts ${Math.round(k.gust)}` : ''}`.trim()] : null,
      k.pressure != null ? ['Barometer', `${FN.weather.hPaToInHg(k.pressure)} inHg${k.pressureTrend ? ` · ${k.pressureTrend}` : ''}`] : null,
      k.precip ? ['Precip', `${k.precip}" that hour`] : null,
      k.moonName ? ['Moon', `${k.moonName}${k.solunar != null ? ` · solunar ${k.solunar >= 0.6 ? 'major' : k.solunar >= 0.3 ? 'minor' : 'quiet'}` : ''}`] : null,
      k.sunrise ? ['Sun', `${fmtT(k.sunrise)} – ${fmtT(k.sunset)}`] : null,
      k.biteScore != null ? ['Bite score', `${k.biteScore} at that hour${k.dayScore != null ? ` · ${k.dayScore} for the day` : ''}`] : null
    ].filter(Boolean);
    if (!rows.length) return '';
    return `<div class="cond"><div class="eyebrow">Conditions when caught</div>${rows.map(([a, b]) => `<div class="irow"><span>${a}</span><b>${esc(b)}</b></div>`).join('')}</div>`;
  };
  const catchDetail = (c, S) => `<div class="cdetail">
      ${c.photoLocal || c.photoPath ? `<img class="cphoto" ${c.photoLocal ? `src="${c.photoLocal}"` : `data-photo="${esc(c.photoPath)}"`} alt="">` : ''}
      ${c.pinName ? `<div><b>Spot:</b> 📍 ${esc(c.pinName)}${c.pinId && !(S.catchFilter && S.catchFilter.pinId === c.pinId) ? ` <button class="btn small ghost inline" data-action="catches-at-pin" data-id="${esc(c.pinId)}">All catches here</button>` : ''}</div>` : ''}
      ${c.bait ? `<div><b>Bait:</b> ${esc(c.bait)}</div>` : ''}
      ${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}
      ${condGrid(c)}
      <div class="actions">
        ${c.userId && S.user && c.userId !== S.user.id ? '' : `<button class="btn small" data-action="catch-edit" data-id="${esc(c.id)}">${ICON.edit} Edit</button>`}
        ${c.lakeId ? `<button class="btn small ghost" data-action="open-lake" data-id="${esc(c.lakeId)}">Lake</button>` : ''}
        ${c.lat ? `<button class="btn small ghost" data-action="fly" data-lat="${c.lat}" data-lon="${c.lon}">Show on map</button>` : ''}
        ${c.userId && S.user && c.userId !== S.user.id ? '' : `<button class="btn small ghost danger" data-action="catch-delete" data-id="${esc(c.id)}">Delete</button>`}
      </div></div>`;

  function catches(S) {
    const F = S.catchFilter;
    const all = [...S.catches].sort((a, b) => (a.caughtAt < b.caughtAt ? 1 : -1));
    const sameSp = (a, b) => a === b || ((FN.profileFor(a) || {}).name && (FN.profileFor(a) || {}).name === (FN.profileFor(b) || {}).name);
    const list = F && F.pinId ? all.filter(c => c.pinId === F.pinId) : F && F.species ? all.filter(c => sameSp(c.species, F.species)) : F && F.lakeId ? all.filter(c => c.lakeId === F.lakeId) : all;
    const ins = FN.forecast.insights(list, 'ALL');
    const title = F && F.pinId ? 'Catches at this spot' : F && F.species ? `${esc(F.name)} catches` : F && F.lakeId ? `Catches on ${esc(F.name)}` : 'Catch log';
    const parts = [head(title, `${F && F.pinId ? esc(F.name) + ' · ' : ''}${list.length} catch${list.length === 1 ? '' : 'es'}${S.user ? '' : ' · on this device only'}`, S.prevView === 'profile' ? 'profile' : 'home', `<button class="icon-btn" data-action="catch-new" ${F && F.pinId ? `data-pin-id="${esc(F.pinId)}"` : ''} title="Log a catch">${ICON.plus}</button>`)];
    if (F && (F.pinId || F.species || F.lakeId)) parts.push(`<div class="actions"><button class="btn small ghost" data-action="catch-filter-clear">Show all catches</button>${F.pinId ? `<button class="btn small ghost" data-action="pin-open" data-id="${esc(F.pinId)}">Show pin on map</button>` : ''}${F.lakeId ? `<button class="btn small ghost" data-action="open-lake" data-id="${esc(F.lakeId)}">Open lake</button>` : ''}</div>`);
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
  const MIN_N = { WAE: 40, NOP: 25, BLC: 40, LMB: 25 }, BIG = { WAE: 20, NOP: 30, BLC: 11, LMB: 15 }, TROPHY = { WAE: 25, NOP: 36, BLC: 13, LMB: 18 };
  const MINLEN = { WAE: [0, 24, 26, 28, 30], NOP: [0, 36, 40, 44], BLC: [0, 12, 13, 14, 15], LMB: [0, 16, 17, 18, 20] };
  const miles = m => m / 1609.344;
  const dist = (a, b) => { const R = 6371000, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

  function finderResults(S) {
    const F = S.finder, sp = F.species, mode = F.mode;
    const M = S.lakeMetrics;
    let rows, source;
    if (M && M.rows && M.rows.some(r => r.species === sp)) { rows = M.rows.filter(r => r.species === sp && (r.acres || 0) >= 50); source = 'live'; }
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
    parts.push(`<div class="chips scroll">${['WAE', 'NOP', 'BLC', 'LMB'].map(c => `<button class="chip sel pic ${sp === c ? 'on' : ''}" data-action="finder-species" data-code="${c}">${speciesIcon(c, 'sm')} ${esc(FN.profileFor(c).name)}</button>`).join('')}</div>`);
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
    const ef = l => /electrofishing/i.test(l.gear || '');
    parts.push(`<div class="list">${shown.map((l, i) => { const metric = mode === 'big' ? `<b>${l.pctBig}%</b> of ${U.num(l.n)} ${sp === 'LMB' ? 'sampled' : 'netted'} were ${BIG[sp]}″+ · longest ${l.max}″${l.nTrophy ? ` · ${l.nTrophy} over ${TROPHY[sp]}″` : ''} · ${(l.years || []).join(', ')}` : ef(l) ? `<b>${U.num(l.cpue, 1)}</b> per hour of electrofishing · ${U.num(l.catch)} caught in ${U.num(l.nets, 1)} h · ${l.year}` : `<b>${U.num(l.cpue, 1)}</b> per ${esc(gearShort(l.gear))} · ${U.num(l.catch)} caught in ${l.nets} nets · ${l.year}${l.normal && l.normal !== 'N/A' ? ` · normal ${esc(l.normal)}` : ''}`; return `<button class="toprow" data-action="open-lake" data-id="${esc(l.id)}"><div class="rank">${i + 1}</div><div class="grow"><div class="t">${esc(l.name)} <span class="muted small">${esc(l.county || '')} Co. · ${U.num(l.acres)} ac${l.dist != null ? ` · ${Math.round(miles(l.dist))} mi` : ''}</span></div><div class="s">${metric}</div></div><div class="chev">›</div></button>`; }).join('')}</div>`);
    if (rows.length > shown.length) parts.push(`<div class="actions"><button class="btn ghost" data-action="finder-more">Show ${Math.min(20, rows.length - shown.length)} more of ${U.num(rows.length)}</button></div>`);
    parts.push(mode === 'big'
      ? `<p class="muted small">Ranked by the share of netted ${esc(p.name.toLowerCase())} measuring ${BIG[sp]}″ or longer in each lake's two most recent surveys with length data (at least ${MIN_N[sp]} fish measured, lakes over 50 acres).</p>`
      : `<p class="muted small">Ranked by catch per net in the most recent survey (standard gill nets for walleye and pike, trap nets for crappie; at least 2 nets, lakes over 50 acres). “Normal” is the statewide 25th–75th percentile for similar lakes.</p>`);
    parts.push(`<p class="muted small">Data: Minnesota DNR LakeFinder surveys, refreshed monthly. Nets sample one day; treat these as leads.</p>`);
    return parts.join('');
  }

  /* ---------------- PROFILE ---------------- */
  const initials = S => {
    if (!S.user) return null;
    const name = ((S.profile && S.profile.display_name) || S.user.email.split('@')[0] || '').trim();
    const words = name.split(/[\s._-]+/).filter(Boolean);
    const ini = words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
    return ini.toUpperCase() || '?';
  };
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const SHARE_IC = '<svg class="share-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/></svg>';
  // Add-to-home-screen nudge: shown once on the home page, the first time someone is signed in on this phone
  function a2hsCard(S) {
    if (!S.user || S.a2hsDismissed || standalone()) return '';
    const mobile = window.matchMedia('(max-width: 899px)').matches || navigator.maxTouchPoints > 1;
    if (!mobile) return '';
    const android = /Android/i.test(navigator.userAgent);
    const dismiss = `<button class="btn ghost small" data-action="a2hs-dismiss">Got it</button>`;
    const how = S.installPrompt
      ? `<p class="small">One tap and it installs like a regular app.</p><div class="actions"><button class="btn" data-action="a2hs-install">Install Fish Nasty</button><button class="btn ghost" data-action="a2hs-dismiss">Not now</button></div>`
      : isIOS()
        ? `<ol><li>Tap <b>Share</b> ${SHARE_IC} at the bottom of Safari (top right on iPad).</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. The walleye icon lands on your home screen.</li></ol><div class="actions">${dismiss}</div>`
        : android
          ? `<p class="small"><b>Chrome:</b></p><ol><li>Tap the <b>⋮</b> menu in the top right.</li><li>Tap <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b>.</li></ol><p class="small"><b>Samsung Internet:</b></p><ol><li>Tap the <b>≡</b> menu at the bottom.</li><li>Tap <b>Add page to</b>, then <b>Home screen</b>.</li></ol><div class="actions">${dismiss}</div>`
          : `<ol><li>Open the browser menu.</li><li>Tap <b>Add to Home screen</b> or <b>Install app</b>.</li></ol><div class="actions">${dismiss}</div>`;
    return `<div class="card a2hs"><div class="row"><div class="trophy">📲</div><div class="grow"><div class="big">Add Fish Nasty to your home screen</div><div class="muted small">Opens full screen like an app, loads faster, and keeps working on the water where service is spotty.</div></div></div>${how}</div>`;
  }

  // Lifetime / this-year totals from the catch log
  function catchStats(catches) {
    const list = catches || [];
    const species = new Map(), lakes = new Map(), days = new Set();
    let released = 0, inches = 0;
    for (const c of list) {
      const p = FN.profileFor(c.species); const name = p ? p.name : (c.speciesName || c.species);
      const s = species.get(name) || { code: p ? p.code || c.species : c.species, name, n: 0, biggest: null, heaviest: null, lakes: new Map() };
      s.n++; if (c.length && (!s.biggest || c.length > s.biggest.length)) s.biggest = c; if (c.weight && (!s.heaviest || c.weight > s.heaviest.weight)) s.heaviest = c;
      if (c.lakeName) s.lakes.set(c.lakeName, (s.lakes.get(c.lakeName) || 0) + 1);
      species.set(name, s);
      if (c.lakeName) { const l = lakes.get(c.lakeName) || { id: c.lakeId, name: c.lakeName, n: 0, species: new Map(), biggest: null }; l.n++; l.species.set(name, (l.species.get(name) || 0) + 1); if (c.length && (!l.biggest || c.length > l.biggest.length)) l.biggest = c; lakes.set(c.lakeName, l); }
      days.add(new Date(c.caughtAt).toDateString());
      if (c.released) released++; if (c.length) inches += c.length;
    }
    const withLen = list.filter(c => c.length), withWt = list.filter(c => c.weight);
    return {
      n: list.length, released, inches: Math.round(inches), days: days.size,
      species: [...species.values()].sort((a, b) => b.n - a.n).map(s => Object.assign(s, { topLake: [...s.lakes.entries()].sort((a, b) => b[1] - a[1])[0] })),
      lakes: [...lakes.values()].sort((a, b) => b.n - a.n),
      biggest: withLen.length ? withLen.reduce((a, b) => (b.length > a.length ? b : a)) : null,
      heaviest: withWt.length ? withWt.reduce((a, b) => (b.weight > a.weight ? b : a)) : null
    };
  }
  function monthChart(list, range) {
    const now = new Date();
    let cols;
    if (range === 'year') cols = Array.from({ length: 12 }, (_, m) => ({ label: new Date(now.getFullYear(), m, 1).toLocaleDateString('en-US', { month: 'short' }).slice(0, 1), full: new Date(now.getFullYear(), m, 1).toLocaleDateString('en-US', { month: 'long' }), v: 0, key: m }));
    else { const yrs = [...new Set(list.map(c => new Date(c.caughtAt).getFullYear()))].sort(); if (yrs.length < 2) return ''; cols = yrs.map(y => ({ label: String(y).slice(2), full: String(y), v: 0, key: y })); }
    for (const c of list) { const d = new Date(c.caughtAt); const k = range === 'year' ? d.getMonth() : d.getFullYear(); const col = cols.find(x => x.key === k); if (col) col.v++; }
    if (!cols.some(c => c.v)) return '';
    const W = 300, H = 100, padB = 18, padT = 16, bw = W / cols.length, maxV = Math.max(...cols.map(c => c.v));
    const bars = cols.map((c, i) => { const h = (H - padB - padT) * c.v / maxV, x = i * bw, y = H - padB - h; return `<g><rect x="${(x + 2).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${Math.max(c.v ? 2 : 0, h).toFixed(1)}" rx="2" fill="${c.v === maxV ? '#ffb454' : '#5aa9f0'}"/>${c.v ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" class="val">${c.v}</text>` : ''}<text x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${c.label}</text><title>${c.full}: ${c.v}</title></g>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="month-chart" role="img" aria-label="Catches by ${range === 'year' ? 'month' : 'year'}">${bars}</svg>`;
  }
  const fmtDay = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /* ---------------- PERSONAL BESTS ---------------- */
  const PB_SPECIES = ['WAE', 'NOP', 'BLC', 'LMB'];
  const spName = c => (FN.profileFor(c.species) || {}).name || c.speciesName || c.species;
  let pbMemo = { key: '', map: null };
  // species name -> { code, name, longest, heaviest, n }; recomputed only when lengths/weights change
  function personalBests(catches) {
    const list = catches || [];
    const key = list.map(c => c.id + ':' + (c.length || 0) + ':' + (c.weight || 0) + ':' + (c.photoLocal || c.photoPath ? 1 : 0)).join('|');
    if (pbMemo.key === key && pbMemo.map) return pbMemo.map;
    const map = new Map();
    for (const c of list) {
      const name = spName(c);
      const e = map.get(name) || { code: c.species, name, longest: null, heaviest: null, n: 0 };
      e.n++;
      if (c.length && (!e.longest || c.length > e.longest.length || (c.length === e.longest.length && c.caughtAt < e.longest.caughtAt))) e.longest = c;
      if (c.weight && (!e.heaviest || c.weight > e.heaviest.weight || (c.weight === e.heaviest.weight && c.caughtAt < e.heaviest.caughtAt))) e.heaviest = c;
      map.set(name, e);
    }
    pbMemo = { key, map };
    return map;
  }
  const pbFor = (catches, code) => personalBests(catches).get((FN.profileFor(code) || {}).name) || null;
  const pbIds = catches => { const s = new Set(); for (const e of personalBests(catches).values()) { if (e.longest) s.add(e.longest.id); if (e.heaviest) s.add(e.heaviest.id); } return s; };
  const pbPhoto = c => (c.photoLocal ? `<img class="pb-img" src="${c.photoLocal}" alt="">` : `<img class="pb-img" data-photo="${esc(c.photoPath)}" alt="">`);
  function pbCard(code, e) {
    const p = FN.profileFor(code);
    if (!e || (!e.longest && !e.heaviest)) return `<div class="pb-card empty"><div class="pb-photo">${speciesIcon(code, 'lg')}</div><div class="pb-body"><div class="t">${esc(p.name)}</div><div class="s">No ${esc(p.name.toLowerCase())} with a length or weight yet</div></div></div>`;
    const best = e.longest || e.heaviest;
    const photoCatch = [e.longest, e.heaviest].find(c => c && (c.photoLocal || c.photoPath));
    const where = c => esc(c.lakeName || c.pinName || '');
    return `<button class="pb-card" data-action="catch-open" data-id="${esc(best.id)}">
      <div class="pb-photo">${photoCatch ? pbPhoto(photoCatch) : speciesIcon(code, 'lg')}<span class="pb-trophy">🏆</span></div>
      <div class="pb-body"><div class="t">${esc(p.name)}</div>
        ${e.longest ? `<div class="v"><b>${e.longest.length}″</b>${e.longest.weight ? ` <span class="s">${e.longest.weight} lb</span>` : ''}</div><div class="s">${where(e.longest)}${where(e.longest) ? ' · ' : ''}${fmtDay(e.longest.caughtAt)}</div>` : ''}
        ${e.heaviest && e.heaviest !== e.longest ? `<div class="v"><b>${e.heaviest.weight} lb</b> <span class="s">heaviest${e.heaviest.length ? ` · ${e.heaviest.length}″` : ''}</span></div><div class="s">${where(e.heaviest)}${where(e.heaviest) ? ' · ' : ''}${fmtDay(e.heaviest.caughtAt)}</div>` : ''}
      </div></button>`;
  }
  function personalBestsSection(S) {
    const PB = personalBests(S.catches);
    const mainNames = PB_SPECIES.map(c => FN.profileFor(c).name);
    const cards = PB_SPECIES.map(code => pbCard(code, pbFor(S.catches, code))).join('');
    const others = [...PB.values()].filter(e => !mainNames.includes(e.name) && (e.longest || e.heaviest)).sort((a, b) => (b.longest ? b.longest.length : 0) - (a.longest ? a.longest.length : 0));
    const rows = others.map(e => { const b = e.longest || e.heaviest; return `<button class="sp-row" data-action="catch-open" data-id="${esc(b.id)}">${speciesIcon(e.code, 'sm')}<div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${e.longest ? `${e.longest.length}″` : ''}${e.longest && e.heaviest ? ' · ' : ''}${e.heaviest ? `${e.heaviest.weight} lb` : ''}${b.lakeName ? ' · ' + esc(b.lakeName) : ''} · ${fmtDay(b.caughtAt)}</div></div><div class="chev">›</div></button>`; }).join('');
    return `<h2>Personal bests</h2><div class="pb-grid">${cards}</div>${rows ? `<div class="card"><div class="eyebrow">Other species</div>${rows}</div>` : ''}<p class="muted small">Checked every time you log a catch: a longer or heavier fish than your best for that species takes its place here, photo and all.</p>`;
  }

  function profile(S) {
    const signed = !!S.user;
    const name = signed ? ((S.profile && S.profile.display_name) || S.user.email.split('@')[0]) : 'Your profile';
    const since = signed && S.user.created_at ? new Date(S.user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
    const ini = initials(S);
    const parts = [];
    parts.push(`<div class="lake-head phead"><button class="icon-btn" data-action="home" title="Home">${ICON.back}</button><div class="avatar xl">${ini ? esc(ini) : '👤'}</div><div class="grow"><h1>${esc(name)}</h1><div class="s">${signed ? `${esc(S.user.email)}${since ? ' · since ' + since : ''}` : 'Not signed in · everything here is kept on this device'}</div></div>${signed ? `<button class="icon-btn" data-action="account" title="Account settings">${ICON.edit}</button>` : ''}</div>`);
    if (!signed) parts.push(`<button class="card link signin-card" data-action="account"><div class="row"><div class="avatar">☁️</div><div class="grow"><div class="big">Sign in or create an account</div><div class="muted small">Back up your catches, pins and favorites, sync them to every device, and share with buddies.</div></div><div class="chev">›</div></div></button>`);
    parts.push(personalBestsSection(S));

    // ---- fish tracker ----
    const all = [...S.catches].sort((a, b) => (a.caughtAt < b.caughtAt ? 1 : -1));
    const yr = new Date().getFullYear();
    const thisYear = all.filter(c => new Date(c.caughtAt).getFullYear() === yr);
    const range = S.profileRange || (thisYear.length ? 'year' : 'all');
    const list = range === 'year' ? thisYear : all;
    const st = catchStats(list);
    const lifetime = catchStats(all);
    parts.push(`<h2>Fish tracker</h2>
      <div class="seg"><button class="${range === 'year' ? 'on' : ''}" data-action="profile-range" data-range="year">${yr} (${thisYear.length})</button><button class="${range === 'all' ? 'on' : ''}" data-action="profile-range" data-range="all">All time (${all.length})</button></div>
      <div class="stats six"><div class="stat"><div class="v">${st.n}</div><div class="l">Fish caught</div></div><div class="stat"><div class="v">${st.species.length}</div><div class="l">Species</div></div><div class="stat"><div class="v">${st.lakes.length}</div><div class="l">Lakes</div></div><div class="stat"><div class="v">${st.biggest ? st.biggest.length + '<small>in</small>' : '—'}</div><div class="l">Biggest</div></div><div class="stat"><div class="v">${st.heaviest ? st.heaviest.weight + '<small>lb</small>' : '—'}</div><div class="l">Heaviest</div></div><div class="stat"><div class="v">${st.days}</div><div class="l">Days on water</div></div></div>`);
    if (!st.n) parts.push(`<div class="card"><p>${all.length ? `No catches logged in ${yr} yet.` : 'No catches logged yet.'} Tap a pin on the map and hit <b>Log a catch here</b>, or log one from any lake page. Every catch saves the weather, water temperature, moon and bite score for that moment.</p><div class="actions"><button class="btn" data-action="catch-new">+ Log a catch</button></div></div>`);
    else {
      parts.push(`<div class="card"><div class="eyebrow">By species</div>${st.species.map(s => `<button class="sp-row" data-action="catch-species-filter" data-code="${esc(s.code)}" data-name="${esc(s.name)}">${speciesIcon(s.code, 'md')}<div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${s.biggest ? `biggest ${s.biggest.length}″${s.biggest.lakeName ? ' · ' + esc(s.biggest.lakeName) : ''}` : 'no lengths yet'}${s.heaviest ? ` · heaviest ${s.heaviest.weight} lb` : ''}${s.topLake && !(s.biggest && s.biggest.lakeName === s.topLake[0]) ? ` · most on ${esc(s.topLake[0])}` : ''}</div></div><div class="n">${s.n}</div><div class="chev">›</div></button>`).join('')}</div>`);
      const mc = monthChart(list, range);
      if (mc) parts.push(`<div class="card"><div class="eyebrow">Catches by ${range === 'year' ? 'month' : 'year'}</div>${mc}</div>`);
      if (st.lakes.length) parts.push(`<div class="card"><div class="eyebrow">By lake</div>${st.lakes.slice(0, 8).map(l => `<button class="sp-row" data-action="catch-lake-filter" data-id="${esc(l.id || '')}" data-name="${esc(l.name)}"><div class="grow"><div class="t">${esc(l.name)}</div><div class="s">${[...l.species.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ')}${l.biggest ? ` · biggest ${l.biggest.length}″` : ''}</div></div><div class="n">${l.n}</div><div class="chev">›</div></button>`).join('')}</div>`);
      if (lifetime.released) parts.push(`<p class="muted small">${lifetime.released} of ${lifetime.n} released all time${lifetime.inches ? ` · ${U.num(lifetime.inches)} inches of fish measured` : ''}</p>`);
      parts.push(`<h2>Recent catches</h2><div class="list">${all.slice(0, 3).map(c => catchRow(c)).join('')}</div><div class="actions"><button class="btn small ghost" data-action="catches">Open the full catch log (${all.length})</button><button class="btn small ghost" data-action="catch-export">Download CSV</button></div>`);
    }

    // ---- lakes, pins, buddies ----
    const favs = S.favorites || [];
    parts.push(`<h2>Favorite lakes <span class="muted small">(${favs.length})</span></h2>`);
    if (favs.length) parts.push(`<div class="list">${favs.map(FN.ui.lakeRow).join('')}</div>`);
    else parts.push(`<p class="muted small">Search for a lake, then tap the <strong>★</strong> on its page to keep it here. Favorites also drive “Best bet this weekend”.</p>`);
    const pins = S.pins || [];
    parts.push(`<h2>My pins <span class="muted small">(${pins.length})</span></h2>`);
    if (pins.length) parts.push(`<div class="list">${pins.slice(0, 6).map(FN.ui.pinRow).join('')}</div>${pins.length > 6 ? `<div class="actions"><button class="btn small ghost" data-action="home">All ${pins.length} pins on the home page</button></div>` : ''}`);
    else parts.push(`<p class="muted small">No pins yet. Tap the <strong>pin</strong> button on the map to mark a spot.</p>`);
    if (signed && FN.cloud.available()) {
      const fr = (S.buddies && S.buddies.friendships) || [];
      const friends = fr.filter(f => f.status === 'accepted').length, pending = fr.filter(f => f.status === 'pending' && f.addressee_id === S.user.id).length;
      parts.push(`<button class="card link" data-action="buddies"><div class="row"><div class="trophy">👥</div><div class="grow"><div class="big">Buddies${S.buddies ? ` <span class="muted">· ${friends}</span>` : ''}${pending ? ` <span class="badge">${pending} request${pending === 1 ? '' : 's'}</span>` : ''}</div><div class="muted small">Shared pins, catches and lake reports from your crew</div></div><div class="chev">›</div></div></button>`);
    }
    parts.push(`<h2>Backup & settings</h2><div class="card"><p class="small">${signed ? `${S.syncing ? 'Syncing…' : S.lastSync ? `Last synced ${U.fmtTime(S.lastSync)}.` : 'Not synced yet.'} Pins, favorites, catches and photos are backed up to your account.` : 'Signed out: pins, favorites and catches live only in this browser. Sign in to back them up.'}</p><div class="actions">${signed ? `<button class="btn ghost small" data-action="sync-now">Sync now</button><button class="btn ghost small" data-action="account">Account settings</button>` : `<button class="btn small" data-action="account">Sign in</button>`}${all.length ? `<button class="btn ghost small" data-action="catch-export">Download catches (CSV)</button>` : ''}${signed ? `<button class="btn ghost small danger" data-action="signout">Sign out</button>` : ''}</div></div>`);
    parts.push(`<div class="foot">Fish Nasty v${esc(C.version)}</div>`);
    return parts.join('');
  }

  // Catch log as a spreadsheet-friendly CSV (one row per fish, conditions included)
  function catchesCSV(catches) {
    const cols = ['date', 'time', 'species', 'length_in', 'weight_lb', 'released', 'bait', 'lake', 'lake_id', 'spot', 'lat', 'lon', 'notes', 'sky', 'air_f', 'day_high_f', 'day_low_f', 'water_f', 'wind_mph', 'wind_dir', 'gust_mph', 'pressure_inhg', 'pressure_trend', 'cloud_pct', 'precip_in', 'moon', 'solunar', 'sunrise', 'sunset', 'bite_score_hour', 'bite_score_day'];
    const q = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const t = iso => (iso ? U.fmtTime(new Date(iso)) : '');
    const rows = [...catches].sort((a, b) => (a.caughtAt < b.caughtAt ? -1 : 1)).map(c => {
      const k = c.conditions || {}, d = new Date(c.caughtAt), p = FN.profileFor(c.species);
      return [d.toLocaleDateString('en-CA'), U.fmtTime(d), p ? p.name : (c.speciesName || c.species), c.length, c.weight, c.released ? 'yes' : 'no', c.bait, c.lakeName, c.lakeId, c.pinName, c.lat, c.lon, c.notes,
        k.code != null ? FN.weather.describe(k.code)[0] : '', k.temp != null ? Math.round(k.temp) : '', k.dayHi != null ? Math.round(k.dayHi) : '', k.dayLo != null ? Math.round(k.dayLo) : '', k.waterTemp, k.wind != null ? Math.round(k.wind) : '', k.windDir != null ? U.windDir(k.windDir) : '', k.gust != null ? Math.round(k.gust) : '', k.pressure != null ? FN.weather.hPaToInHg(k.pressure) : '', k.pressureTrend, k.cloud, k.precip, k.moonName, k.solunar, t(k.sunrise), t(k.sunset), k.biteScore, k.dayScore].map(q).join(',');
    });
    return cols.join(',') + '\n' + rows.join('\n') + '\n';
  }

  /* ---------------- WEATHER ---------------- */
  const arrow = dir => `<svg class="warrow" viewBox="0 0 24 24" style="transform:rotate(${((dir || 0) + 180) % 360}deg)" aria-hidden="true"><path d="M12 3l5 9h-3.4v9h-3.2v-9H7z" fill="currentColor"/></svg>`;
  const sevName = s => (s || 'unknown').toLowerCase();
  function alertCard(a, open) {
    const when = a.ends ? `until ${new Date(a.ends).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : '';
    return `<div class="alert sev-${esc(sevName(a.severity))}"><button class="alert-head" data-action="alert-toggle" data-id="${esc(a.id)}"><span class="ai">⚠️</span><span class="grow"><b>${esc(a.event)}</b><span class="small">${esc(a.headline || when)}</span></span><span class="chev">${open ? '⌄' : '›'}</span></button>
      ${open ? `<div class="adesc">${a.area ? `<div class="muted small">${esc(a.area)}</div>` : ''}${esc(a.description).replace(/\n\n/g, '<br><br>').replace(/\n/g, ' ')}${a.instruction ? `<div class="ainst">${esc(a.instruction).replace(/\n/g, ' ')}</div>` : ''}<div class="muted small">${esc(a.sender)} · ${when}</div></div>` : ''}</div>`;
  }
  function weather(S) {
    const W = S.wx || {};
    const where = W.source === 'gps' ? 'Your location' : W.label ? esc(W.label) : 'Where the map is centered';
    const sub = W.lat != null ? `${where} · ${W.lat.toFixed(3)}, ${W.lon.toFixed(3)}` : '';
    const parts = [`<div class="lake-head"><button class="icon-btn" data-action="weather-back" title="Back">${ICON.back}</button><div class="grow"><h1>Weather</h1><div class="s">${sub}</div></div></div>`];
    parts.push(`<div class="actions quick-src"><button class="btn small ${W.source === 'center' ? '' : 'ghost'}" data-action="weather-center">Map center</button><button class="btn small ${W.source === 'gps' ? '' : 'ghost'}" data-action="weather-gps">${ICON.locate} My location</button>${S.lake ? `<button class="btn small ${W.source === 'lake' ? '' : 'ghost'}" data-action="weather-lake">${esc(S.lake.name)}</button>` : ''}</div>`);
    if (W.error) parts.push(errorBox(W.error));
    if (W.loading && !W.data) { parts.push(spinner('Loading the forecast…')); return parts.join(''); }
    const d = W.data; if (!d) return parts.join('');
    const radarOn = !!FN.map.getSettings().radar;
    // alerts
    if (W.alerts && W.alerts.length) parts.push(`<h2>Alerts <span class="muted small">(${W.alerts.length})</span></h2>` + W.alerts.map(a => alertCard(a, W.openAlert === a.id)).join(''));
    // right now
    const now = new Date(), cur = d.current || {};
    const hours = d.hours || [];
    let hi = hours.findIndex(h => h.t > now); if (hi < 0) hi = hours.length; const curIdx = Math.max(0, hi - 1);
    const p3 = hours[curIdx] && hours[curIdx - 3] ? hours[curIdx].pressure - hours[curIdx - 3].pressure : 0;
    const trend = p3 <= -1 ? '↓ falling' : p3 >= 1 ? '↑ rising' : '→ steady';
    const wxd = FN.weather.describe(cur.code);
    const info = W.lat != null ? FN.solunar.dayInfo(now, W.lat, W.lon) : null;
    const hum = cur.humidity != null ? cur.humidity : (hours[curIdx] && hours[curIdx].humidity);
    parts.push(`<div class="card wx-now">
      <div class="row"><div class="big-temp">${Math.round(cur.temp)}°<small>F</small></div><div class="grow"><div class="wx-desc">${wxd[1]} ${esc(wxd[0])}</div><div class="muted small">Feels like ${Math.round(cur.feels)}° · ${cur.isDay ? 'day' : 'night'}${d.days && d.days[0] ? ` · high ${Math.round(d.days[0].hi)}° / low ${Math.round(d.days[0].lo)}°` : ''}</div></div></div>
      <div class="wx-grid">
        <div class="wx-cell"><span class="l">Wind</span><b>${arrow(cur.windDir)} ${Math.round(cur.wind)} mph ${U.windDir(cur.windDir)}</b><span class="s">${cur.gust ? `gusts ${Math.round(cur.gust)} mph` : 'calm'}</span></div>
        <div class="wx-cell"><span class="l">Barometer</span><b>${FN.weather.hPaToInHg(cur.pressure)} inHg</b><span class="s">${trend} (3 h)</span></div>
        <div class="wx-cell"><span class="l">Humidity</span><b>${hum != null ? Math.round(hum) + '%' : '—'}</b><span class="s">clouds ${cur.cloud != null ? Math.round(cur.cloud) + '%' : '—'}</span></div>
        <div class="wx-cell"><span class="l">Precip</span><b>${cur.precip ? cur.precip.toFixed(2) + '"' : '0"'}</b><span class="s">${hours[curIdx] && hours[curIdx].pop != null ? `${hours[curIdx].pop}% chance this hour` : 'last hour'}</span></div>
        ${info ? `<div class="wx-cell"><span class="l">Sun</span><b>${U.fmtTime(info.sunrise)} – ${U.fmtTime(info.sunset)}</b><span class="s">${Math.round((info.sunset - info.sunrise) / 60000 / 60 * 10) / 10} h of daylight</span></div>
        <div class="wx-cell"><span class="l">Moon</span><b>${info.phaseIcon} ${esc(info.phaseName)}</b><span class="s">${Math.round(info.illumination * 100)}% lit</span></div>` : ''}
      </div></div>`);
    // radar
    parts.push(`<div class="card"><div class="row"><div class="trophy">📡</div><div class="grow"><div class="big">Radar</div><div class="muted small">${radarOn ? 'Showing on the map · animating the last 30 minutes' : 'Live NWS radar over the depth map, animated'}</div></div></div>
      <div class="actions"><button class="btn ${radarOn ? 'ghost' : ''}" data-action="radar-toggle">${radarOn ? 'Hide radar' : 'Show radar on the map'}</button><button class="btn ghost" data-action="bite-from-weather">🎣 Bite forecast here</button></div></div>`);
    // hourly (next 24 h)
    const next = hours.slice(curIdx, curIdx + 25);
    parts.push(`<h2>Next 24 hours</h2><div class="wx-hours">${next.map((h, i) => { const dd = FN.weather.describe(h.code); return `<div class="wx-hour ${i === 0 ? 'now' : ''}"><div class="t">${i === 0 ? 'Now' : h.t.toLocaleTimeString('en-US', { hour: 'numeric' }).replace(' ', '')}</div><div class="ic">${dd[1]}</div><div class="tp">${Math.round(h.temp)}°</div><div class="wd">${arrow(h.windDir)}${Math.round(h.wind)}</div><div class="pp ${h.pop >= 40 ? 'wet' : ''}">${h.pop != null && h.pop >= 15 ? h.pop + '%' : ''}</div></div>`; }).join('')}</div>`);
    // 7 days
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = (d.days || []).filter(x => x.date >= today).slice(0, 7);
    parts.push(`<h2>Next 7 days</h2><div class="card wx-days">${days.map((x, i) => { const dd = FN.weather.describe(x.code); return `<div class="wx-day"><div class="dn">${i === 0 ? 'Today' : x.date.toLocaleDateString('en-US', { weekday: 'short' })}<span class="s">${x.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><div class="ic">${dd[1]}</div><div class="grow"><div>${esc(dd[0])}</div><div class="s">wind to ${Math.round(x.windMax)} mph${x.gustMax ? `, gusts ${Math.round(x.gustMax)}` : ''}${x.precip ? ` · ${x.precip.toFixed(2)}" precip` : x.pop >= 30 ? ` · ${x.pop}% chance` : ''}</div><div class="s">☀️ ${U.fmtTime(x.sunrise)} – ${U.fmtTime(x.sunset)}</div></div><div class="hl"><b>${Math.round(x.hi)}°</b><span>${Math.round(x.lo)}°</span></div></div>`; }).join('')}</div>`);
    parts.push(`<div class="foot">Forecast: Open-Meteo (NOAA/ECMWF models) · Radar: NWS NEXRAD via Iowa State Mesonet · Alerts: National Weather Service. Updated ${U.fmtTime(d.fetched || now)}.</div>`);
    return parts.join('');
  }

  return { account, catchForm, catches, catchRow, buddies, reportForm, finder, finderResults, condLine, profile, a2hsCard, initials, catchesCSV, catchStats, weather, alertCard, personalBests };
})());
