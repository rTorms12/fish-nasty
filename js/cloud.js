/* Fish Nasty — Supabase: sign-in, sync, catch log, buddies, statewide lake metrics */
window.FN = window.FN || {};

FN.cloud = (() => {
  const C = FN.config, U = FN.util;
  let sb = null, session = null, user = null, profile = null;
  const listeners = [];
  const emit = ev => { for (const fn of listeners) { try { fn(ev, user); } catch (e) { console.error(e); } } };
  const redirectTo = () => location.origin + location.pathname;
  const available = () => !!sb;
  const uid = () => (user ? user.id : null);
  const need = () => { if (!user) throw new Error('Sign in first'); };
  const fail = (r) => { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; };

  function init() {
    if (!window.supabase || !C.supabase || !C.supabase.url) return false;
    sb = window.supabase.createClient(C.supabase.url, C.supabase.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
    });
    sb.auth.onAuthStateChange((event, s) => {
      session = s; user = s ? s.user : null;
      if (!user) profile = null;
      emit(event);
    });
    return true;
  }

  /* ---------- auth ---------- */
  const signUp = (email, password, displayName) => fail_(sb.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName || email.split('@')[0] }, emailRedirectTo: redirectTo() } }));
  const signIn = (email, password) => fail_(sb.auth.signInWithPassword({ email: email.trim(), password }));
  const magicLink = email => fail_(sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } }));
  const resetPassword = email => fail_(sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() }));
  const updatePassword = password => fail_(sb.auth.updateUser({ password }));
  const signOut = () => sb.auth.signOut();
  async function fail_(p) { const r = await p; return fail(r); }

  async function getProfile(force) {
    need();
    if (profile && !force) return profile;
    profile = await fail_(sb.from('profiles').select('*').eq('id', uid()).single());
    return profile;
  }
  const updateProfile = patch => fail_(sb.from('profiles').update(patch).eq('id', uid()).select().single()).then(p => (profile = p));

  /* ---------- pins & favorites sync ---------- */
  const pinToRow = p => ({
    user_id: uid(), client_id: p.id, name: p.name, lat: p.lat, lon: p.lon, depth: p.depth, lake_id: p.lakeId || null, lake_name: p.lakeName || null,
    notes: p.notes || '', color: p.color || '#ffb454', source: p.source || null, accuracy: p.accuracy || null, shared: !!p.shared,
    created_at: p.created || new Date().toISOString(), updated_at: p.updated || p.created || new Date().toISOString(), deleted_at: null
  });
  const rowToPin = r => ({
    id: r.client_id, serverId: r.id, name: r.name, lat: r.lat, lon: r.lon, depth: r.depth, lakeId: r.lake_id, lakeName: r.lake_name,
    notes: r.notes || '', color: r.color || '#ffb454', source: r.source, accuracy: r.accuracy, shared: !!r.shared, created: r.created_at, updated: r.updated_at
  });
  const pullPins = () => fail_(sb.from('pins').select('*').eq('user_id', uid()).is('deleted_at', null)).then(rows => rows.map(rowToPin));
  const pushPins = pins => pins.length ? fail_(sb.from('pins').upsert(pins.map(pinToRow), { onConflict: 'user_id,client_id' })) : Promise.resolve();
  const deletePins = clientIds => clientIds.length ? fail_(sb.from('pins').update({ deleted_at: new Date().toISOString() }).eq('user_id', uid()).in('client_id', clientIds)) : Promise.resolve();

  const pullFavorites = () => fail_(sb.from('favorites').select('*').eq('user_id', uid())).then(rows => rows.map(r => ({ id: r.lake_id, name: r.lake_name, county: r.county, town: r.town, acres: r.acres, maxDepth: r.max_depth, created: r.created_at })));
  const pushFavorites = favs => favs.length ? fail_(sb.from('favorites').upsert(favs.map(f => ({ user_id: uid(), lake_id: f.id, lake_name: f.name, county: f.county, town: f.town, acres: f.acres || null, max_depth: f.maxDepth || null })), { onConflict: 'user_id,lake_id' })) : Promise.resolve();
  const deleteFavorites = lakeIds => lakeIds.length ? fail_(sb.from('favorites').delete().eq('user_id', uid()).in('lake_id', lakeIds)) : Promise.resolve();

  /* ---------- catch log ---------- */
  const catchToRow = c => ({
    user_id: uid(), client_id: c.id, lake_id: c.lakeId || null, lake_name: c.lakeName || null, pin_id: c.pinServerId || null, pin_client_id: c.pinId || null, pin_name: c.pinName || null,
    species_code: c.species, species_name: c.speciesName || FN.speciesName(c.species), length_in: c.length || null, weight_lb: c.weight || null,
    bait: c.bait || null, notes: c.notes || '', photo_path: c.photoPath || null, caught_at: c.caughtAt, lat: c.lat || null, lon: c.lon || null,
    conditions: c.conditions || {}, shared: !!c.shared, released: c.released == null ? null : !!c.released, created_at: c.created || c.caughtAt, updated_at: new Date().toISOString(), deleted_at: null
  });
  const rowToCatch = r => ({
    id: r.client_id, serverId: r.id, userId: r.user_id, lakeId: r.lake_id, lakeName: r.lake_name, species: r.species_code, speciesName: r.species_name,
    pinId: r.pin_client_id || null, pinName: r.pin_name || null, pinServerId: r.pin_id || null,
    length: r.length_in, weight: r.weight_lb, bait: r.bait, notes: r.notes || '', photoPath: r.photo_path, caughtAt: r.caught_at, lat: r.lat, lon: r.lon,
    conditions: r.conditions || {}, shared: !!r.shared, released: r.released, created: r.created_at, updated: r.updated_at, synced: true,
    owner: r.profiles ? (r.profiles.display_name || r.profiles.email) : null
  });
  const pullCatches = () => fail_(sb.from('catches').select('*').eq('user_id', uid()).is('deleted_at', null).order('caught_at', { ascending: false })).then(rows => rows.map(rowToCatch));
  const pushCatches = cs => cs.length ? fail_(sb.from('catches').upsert(cs.map(catchToRow), { onConflict: 'user_id,client_id' }).select('id,client_id')) : Promise.resolve([]);
  const deleteCatches = ids => ids.length ? fail_(sb.from('catches').update({ deleted_at: new Date().toISOString() }).eq('user_id', uid()).in('client_id', ids)) : Promise.resolve();

  // Shrink a photo on the phone before upload (max 1280 px, JPEG)
  function shrinkImage(file, max = 1280) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process the photo'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the photo')); };
      img.src = url;
    });
  }
  async function uploadPhoto(file, catchId) {
    need();
    const blob = await shrinkImage(file);
    const path = `${uid()}/${catchId}.jpg`;
    await fail_(sb.storage.from('catch-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true }));
    return path;
  }
  const photoUrls = new Map();
  async function photoUrl(path) {
    if (!path || !user) return null;
    const hit = photoUrls.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    try {
      const d = await fail_(sb.storage.from('catch-photos').createSignedUrl(path, 3600));
      photoUrls.set(path, { url: d.signedUrl, exp: Date.now() + 50 * 60000 });
      return d.signedUrl;
    } catch (e) { return null; }
  }

  /* ---------- buddies ---------- */
  const listFriendships = () => fail_(sb.from('friendships').select('*, requester:profiles!friendships_requester_id_fkey(id,display_name,email), addressee:profiles!friendships_addressee_id_fkey(id,display_name,email)').order('created_at', { ascending: false }));
  const invite = email => fail_(sb.rpc('invite_buddy', { p_email: email }));
  const respond = (id, status) => fail_(sb.from('friendships').update({ status, responded_at: new Date().toISOString() }).eq('id', id));
  const removeFriendship = id => fail_(sb.from('friendships').delete().eq('id', id));
  async function feed() {
    need();
    const [pins, catches, reports] = await Promise.all([
      fail_(sb.from('pins').select('*, profiles(display_name,email)').eq('shared', true).neq('user_id', uid()).is('deleted_at', null).order('updated_at', { ascending: false }).limit(100)),
      fail_(sb.from('catches').select('*, profiles(display_name,email)').eq('shared', true).neq('user_id', uid()).is('deleted_at', null).order('caught_at', { ascending: false }).limit(100)),
      fail_(sb.from('reports').select('*, profiles(display_name,email)').neq('user_id', uid()).is('deleted_at', null).order('created_at', { ascending: false }).limit(100))
    ]);
    const who = r => (r.profiles && (r.profiles.display_name || r.profiles.email)) || 'Buddy';
    const items = [];
    for (const p of pins) items.push({ kind: 'pin', t: p.updated_at, who: who(p), pin: rowToPin(p), lakeId: p.lake_id, lakeName: p.lake_name });
    for (const c of catches) items.push({ kind: 'catch', t: c.caught_at, who: who(c), catch: rowToCatch(c), lakeId: c.lake_id, lakeName: c.lake_name });
    for (const r of reports) items.push({ kind: 'report', t: r.created_at, who: who(r), report: r, lakeId: r.lake_id, lakeName: r.lake_name });
    return items.sort((a, b) => (a.t < b.t ? 1 : -1));
  }
  const postReport = (lake, body, catchServerId) => fail_(sb.from('reports').insert({ user_id: uid(), lake_id: lake ? lake.id : null, lake_name: lake ? lake.name : null, body, catch_id: catchServerId || null }).select().single());
  const myReports = () => fail_(sb.from('reports').select('*').eq('user_id', uid()).is('deleted_at', null).order('created_at', { ascending: false }));
  const deleteReport = id => fail_(sb.from('reports').update({ deleted_at: new Date().toISOString() }).eq('id', id));

  /* ---------- statewide lake metrics (public; cached for a day) ---------- */
  const METRICS_KEY = 'fn.lakeMetrics';
  async function lakeMetrics(force) {
    const cached = U.store.get(METRICS_KEY, null);
    if (cached && !force && Date.now() - cached.t < 24 * 3600 * 1000) return cached.data;
    if (!sb) return cached ? cached.data : null;
    const lakes = [], metrics = [];
    for (let from = 0; ; from += 1000) {
      const page = await fail_(sb.from('lakes').select('id,name,county,town,lat,lon,acres,max_depth,newest_survey').range(from, from + 999));
      lakes.push(...page); if (page.length < 1000) break;
    }
    for (let from = 0; ; from += 1000) {
      const page = await fail_(sb.from('lake_species_metrics').select('*').range(from, from + 999));
      metrics.push(...page); if (page.length < 1000) break;
    }
    const byLake = new Map(lakes.map(l => [l.id, l]));
    const data = { lakes: lakes.length, rows: metrics.map(m => { const l = byLake.get(m.lake_id) || {}; return { id: m.lake_id, name: l.name, county: l.county, town: l.town, lat: l.lat, lon: l.lon, acres: l.acres, maxDepth: l.max_depth, species: m.species, n: m.n_measured, max: m.max_len, nBig: m.n_big, pctBig: m.pct_big, nTrophy: m.n_trophy, years: m.years || [], cpue: m.cpue, gear: m.gear, catch: m.total_catch, nets: m.nets, normal: m.normal_range, year: m.cpue_year }; }), updated: new Date().toISOString() };
    try { U.store.set(METRICS_KEY, { t: Date.now(), data }); } catch (e) { /* storage full: fine, it will refetch */ }
    return data;
  }
  const refreshStatus = () => fail_(sb.from('refresh_jobs').select('*').order('id', { ascending: false }).limit(1)).then(r => r[0] || null);

  return {
    init, available, onAuth: fn => listeners.push(fn), get user() { return user; }, get session() { return session; }, uid,
    signUp, signIn, magicLink, resetPassword, updatePassword, signOut, getProfile, updateProfile,
    pullPins, pushPins, deletePins, pullFavorites, pushFavorites, deleteFavorites,
    pullCatches, pushCatches, deleteCatches, uploadPhoto, photoUrl,
    listFriendships, invite, respond, removeFriendship, feed, postReport, myReports, deleteReport,
    lakeMetrics, refreshStatus
  };
})();
