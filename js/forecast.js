/* Fish Nasty — bite forecast model (weather + solunar + season + species behavior) */
window.FN = window.FN || {};

FN.forecast = (() => {
  const U = FN.util;

  const LABELS = {
    lowLight: 'Dawn / dusk low light',
    night: 'Night hours',
    midday: 'Midday bright sun',
    solunar: 'Solunar feeding period',
    moon: 'Moon phase',
    pressure: 'Barometric pressure',
    postFront: 'Post-frontal high & clear',
    wind: 'Wind',
    sky: 'Cloud cover',
    precip: 'Precipitation',
    storm: 'Thunderstorms',
    coldFront: 'Cold front (temp drop)',
    warming: 'Warming trend',
    heat: 'Heat',
    frigid: 'Frigid air',
    season: 'Seasonal pattern',
    personal: 'Your catch history'
  };

  const PERIODS = [['dawn', 5, 8], ['morning', 8, 11], ['midday', 11, 15], ['afternoon', 15, 18], ['evening', 18, 21], ['night', 21, 29]];
  const periodOf = h => { const hh = h < 5 ? h + 24 : h; return (PERIODS.find(([, a, b]) => hh >= a && hh < b) || PERIODS[5])[0]; };
  const MOONS = { new: 'new moon', full: 'full moon', quarter: 'quarter moon', other: 'in between' };
  const moonBucket = phase => { if (phase == null) return null; const d = Math.min(phase, 1 - phase); if (d <= 0.08) return 'new'; if (Math.abs(phase - 0.5) <= 0.08) return 'full'; if (Math.abs(phase - 0.25) <= 0.08 || Math.abs(phase - 0.75) <= 0.08) return 'quarter'; return 'other'; };

  // What the angler's own catch log says: counts by period, pressure trend, moon, month, lake; biggest fish
  function insights(catches, speciesCode) {
    const list = (catches || []).filter(c => !speciesCode || speciesCode === 'ALL' || c.species === speciesCode || (FN.profileFor(c.species) || {}).name === (FN.profileFor(speciesCode) || {}).name);
    const n = list.length;
    if (!n) return null;
    const count = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
    const hourOf = c => { const h = c.conditions && c.conditions.hour != null ? c.conditions.hour : new Date(c.caughtAt).getHours(); return h; };
    const byPeriod = count(list, c => periodOf(hourOf(c)));
    const byPressure = count(list, c => c.conditions && c.conditions.pressureTrend);
    const byMoon = count(list, c => moonBucket(c.conditions && c.conditions.moonPhase));
    const byMonth = count(list, c => new Date(c.caughtAt).toLocaleDateString('en-US', { month: 'long' }));
    const byLake = count(list, c => c.lakeName);
    const withLen = list.filter(c => c.length);
    const biggest = withLen.length ? withLen.reduce((a, b) => (b.length > a.length ? b : a)) : null;
    const avgLen = withLen.length ? withLen.reduce((a, b) => a + b.length, 0) / withLen.length : null;
    const avgScore = list.filter(c => c.conditions && c.conditions.biteScore != null).map(c => c.conditions.biteScore);
    return { n, biggest, avgLen, byPeriod, byPressure, byMoon, byMonth, byLake, moonLabel: k => MOONS[k] || k, avgBite: avgScore.length ? Math.round(avgScore.reduce((a, b) => a + b, 0) / avgScore.length) : null };
  }

  // Hour-by-hour adjustment (max about ±10) learned from the angler's own catches for this species
  function personalFactor(catches, speciesCode) {
    const ins = insights(catches, speciesCode);
    if (!ins || ins.n < 5) return null;
    const periodShare = new Map(ins.byPeriod.map(([k, v]) => [k, v / ins.n]));
    const pressShare = new Map(ins.byPressure.map(([k, v]) => [k, v / ins.n]));
    const pressN = ins.byPressure.reduce((a, [, v]) => a + v, 0);
    return hourRec => {
      const per = periodOf(hourRec.t.getHours());
      let v = U.clamp(((periodShare.get(per) || 0) - 1 / 6) * 30, -6, 8);
      let detail = `${Math.round((periodShare.get(per) || 0) * 100)}% of your ${ins.n} ${FN.profileFor(speciesCode) ? FN.profileFor(speciesCode).name.toLowerCase() : ''} catches came in the ${per}`;
      const trend = hourRec.details.pressure ? hourRec.details.pressure.split(' ')[0] : null; // falling / steady / rising
      if (pressN >= 5 && trend) {
        const key = trend === 'falling' ? 'falling' : trend === 'rising' ? 'rising' : 'steady';
        v += U.clamp(((pressShare.get(key) || 0) - 1 / 3) * 15, -4, 5);
      }
      return { value: Math.round(v * 10) / 10, detail };
    };
  }

  function rating(score) {
    if (score >= 75) return { word: 'Excellent', cls: 'r4' };
    if (score >= 62) return { word: 'Good', cls: 'r3' };
    if (score >= 48) return { word: 'Fair', cls: 'r2' };
    return { word: 'Poor', cls: 'r1' };
  }

  function compute(weather, lat, lon, speciesCode, catches) {
    const profile = FN.profileFor(speciesCode) || FN.PROFILES.ALL;
    const personal = catches && catches.length ? personalFactor(catches, speciesCode) : null;
    const W = profile.weights || {};
    const w = k => (W[k] == null ? 1 : W[k]);
    const hours = weather.hours;
    const infos = new Map();
    const infoFor = d => {
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!infos.has(k)) infos.set(k, FN.solunar.dayInfo(d, lat, lon));
      return infos.get(k);
    };

    const out = [];
    for (let i = 0; i < hours.length; i++) {
      const h = hours[i], t = h.t, info = infoFor(t);
      const f = {}, d = {};
      const hr = t.getHours();

      // --- light ---
      const mTo = (a, b) => Math.abs(a - b) / 60000;
      const dLight = Math.min(mTo(t, info.sunrise), mTo(t, info.sunset));
      let low = 0;
      if (dLight <= 30) low = 12; else if (dLight <= 90) low = 12 * (1 - (dLight - 30) / 60);
      if (low > 0.5) { f.lowLight = low * w('lowLight'); d.lowLight = dLight <= mTo(t, info.sunrise) + 0.1 && mTo(t, info.sunrise) <= mTo(t, info.sunset) ? 'near sunrise' : 'near sunset'; }
      const isNight = t < new Date(info.dawn.getTime() - 60 * 60000) || t > new Date(info.dusk.getTime() + 60 * 60000);
      if (isNight) f.night = -8 * w('night');
      if (h.isDay && hr >= 11 && hr <= 15 && h.cloud < 60) f.midday = -5 * w('midday');

      // --- solunar / moon ---
      const s = FN.solunar.strengthAt(t, info);
      if (s > 0.05) {
        f.solunar = 16 * s * w('solunar');
        const near = info.periods.map(p => ({ p, dm: Math.abs(t - p.center) / 60000 })).sort((a, b) => a.dm - b.dm)[0];
        if (near) d.solunar = `${near.p.label} ${U.fmtTime(near.p.center)}`;
      }
      const pf = FN.solunar.phaseFactor(info.phase);
      if (pf !== 0) { f.moon = (pf > 0 ? 8 * pf : 3 * pf) * w('moon'); d.moon = info.phaseName; }

      // --- pressure ---
      const p3 = i >= 3 ? h.pressure - hours[i - 3].pressure : 0;
      const p24 = i >= 24 ? h.pressure - hours[i - 24].pressure : 0;
      let pr = 0, pd = '';
      if (p3 <= -4) { pr = 5; pd = 'falling fast'; }
      else if (p3 <= -1) { pr = 10; pd = 'falling slowly'; }
      else if (p3 < 1) { if (h.pressure > 1024) { pr = -5; pd = 'steady & high'; } else { pr = 3; pd = 'steady'; } }
      else if (p3 <= 3) { pr = -4; pd = 'rising'; }
      else { pr = -10; pd = 'rising fast'; }
      f.pressure = pr * (pr > 0 ? w('pressureFall') : w('postFront'));
      d.pressure = `${pd} (${p3 >= 0 ? '+' : ''}${p3.toFixed(1)} hPa / 3 h)`;
      if (p24 > 6 && h.cloud < 30 && h.isDay) { f.postFront = -8 * w('postFront'); d.postFront = `+${p24.toFixed(0)} hPa in 24 h`; }

      // --- wind ---
      const ws = h.wind;
      let wf = 0, wd = '';
      if (ws < 3) { wf = h.isDay ? -3 : 0; wd = 'flat calm'; }
      else if (ws < 7) { wf = 3; wd = 'light breeze'; }
      else if (ws <= 15) { wf = 6; wd = 'good chop'; }
      else if (ws <= 20) { wf = 0; wd = 'breezy'; }
      else if (ws <= 28) { wf = -8; wd = 'rough'; }
      else { wf = -15; wd = 'dangerous'; }
      if (wf) f.wind = wf * (ws < 3 ? w('calm') : w('wind'));
      d.wind = `${Math.round(ws)} mph ${U.windDir(h.windDir)} · ${wd}`;

      // --- sky ---
      if (h.isDay) {
        if (h.cloud >= 70) { f.sky = 6 * w('overcast'); d.sky = `overcast (${h.cloud}%)`; }
        else if (h.cloud >= 30) { f.sky = 2 * w('overcast'); d.sky = `partly cloudy (${h.cloud}%)`; }
        else if (hr >= 10 && hr <= 16) { f.sky = -4 * w('clear'); d.sky = `clear skies (${h.cloud}%)`; }
      }

      // --- precipitation ---
      const code = h.code;
      if (code >= 95) { f.storm = -20; d.storm = 'lightning risk — stay off the water'; }
      else if ((code >= 71 && code <= 77) || code === 85 || code === 86) { f.precip = -5 * w('rain'); d.precip = 'snow'; }
      else if (h.precip > 0.25) { f.precip = -10 * w('rain'); d.precip = `heavy rain (${h.precip.toFixed(2)} in/h)`; }
      else if (h.precip > 0.08) { f.precip = -4 * w('rain'); d.precip = `rain (${h.precip.toFixed(2)} in/h)`; }
      else if (h.precip > 0) { f.precip = 4 * w('rain'); d.precip = 'light rain / drizzle'; }

      // --- temperature ---
      const dT = i >= 24 ? h.temp - hours[i - 24].temp : 0;
      if (dT < -15) { f.coldFront = -10 * w('cold'); d.coldFront = `${dT.toFixed(0)}°F vs. yesterday`; }
      else if (dT < -8) { f.coldFront = -5 * w('cold'); d.coldFront = `${dT.toFixed(0)}°F vs. yesterday`; }
      else if (dT > 5) { f.warming = 3; d.warming = `+${dT.toFixed(0)}°F vs. yesterday`; }
      if (h.temp > 88 && h.isDay) { f.heat = -5 * w('heat'); d.heat = `${Math.round(h.temp)}°F`; }
      if (h.temp < 10) { f.frigid = -5 * w('cold'); d.frigid = `${Math.round(h.temp)}°F`; }

      // --- season ---
      const sea = profile.season ? profile.season[t.getMonth()] : 0;
      if (sea) f.season = sea;

      if (personal) {
        const rec = { t, details: d };
        const pf = personal(rec);
        if (pf && Math.abs(pf.value) >= 0.5) { f.personal = pf.value; d.personal = pf.detail; }
      }
      const sum = Object.values(f).reduce((a, b) => a + b, 0);
      const score = U.clamp(Math.round(50 + sum), 0, 100);
      out.push({ t, score, factors: f, details: d, weather: h, info, isNight, rating: rating(score) });
    }

    // --- daily summaries (today onward) ---
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const byDay = new Map();
    for (const hRec of out) {
      if (hRec.t < today) continue;
      const k = hRec.t.toDateString();
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(hRec);
    }
    const days = [];
    for (const [k, hrs] of byDay) {
      if (hrs.length < 12 || days.length >= 7) continue;
      const info = hrs[0].info;
      const fishable = hrs.filter(x => x.t >= new Date(info.sunrise.getTime() - 90 * 60000) && x.t <= new Date(info.sunset.getTime() + 90 * 60000));
      const pool = fishable.length ? fishable : hrs;
      const sorted = [...pool].sort((a, b) => b.score - a.score);
      const top = sorted.slice(0, 6);
      const mean = arr => arr.reduce((a, b) => a + b.score, 0) / Math.max(1, arr.length);
      const score = Math.round(0.6 * mean(top) + 0.4 * mean(pool));
      const windows = bestWindows(hrs, Math.max(60, score));
      const drivers = topDrivers(pool);
      const wx = weather.days.find(dd => U.sameDay(dd.date, hrs[0].t));
      days.push({ date: new Date(hrs[0].t.getFullYear(), hrs[0].t.getMonth(), hrs[0].t.getDate()), hours: hrs, score, rating: rating(score), windows, drivers, info, wx });
    }

    return { species: speciesCode || 'ALL', profile, hours: out, days, computed: new Date() };
  }

  function bestWindows(hrs, threshold) {
    const runs = [];
    let cur = null;
    for (const h of hrs) {
      if (h.score >= threshold) {
        if (cur && h.t - cur.end <= 3600 * 1000) { cur.end = h.t; cur.peak = Math.max(cur.peak, h.score); cur.sum += h.score; cur.n++; }
        else { cur = { start: h.t, end: h.t, peak: h.score, sum: h.score, n: 1 }; runs.push(cur); }
      }
    }
    return runs.map(r => ({ start: r.start, end: new Date(r.end.getTime() + 3600 * 1000), peak: r.peak, avg: Math.round(r.sum / r.n) }))
      .sort((a, b) => b.peak - a.peak || b.avg - a.avg).slice(0, 3).sort((a, b) => a.start - b.start);
  }

  function topDrivers(hrs) {
    const agg = {};
    for (const h of hrs) for (const [k, v] of Object.entries(h.factors)) agg[k] = (agg[k] || 0) + v / hrs.length;
    const list = Object.entries(agg).map(([k, v]) => ({ key: k, value: v, label: LABELS[k] || k }));
    const pos = list.filter(x => x.value > 1.5).sort((a, b) => b.value - a.value).slice(0, 3);
    const neg = list.filter(x => x.value < -1.5).sort((a, b) => a.value - b.value).slice(0, 2);
    return { pos, neg };
  }

  function explain(hourRec) {
    return Object.entries(hourRec.factors)
      .map(([k, v]) => ({ key: k, value: v, label: LABELS[k] || k, detail: hourRec.details[k] || '' }))
      .filter(x => Math.abs(x.value) >= 0.5)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  return { compute, rating, explain, insights, personalFactor, periodOf, LABELS };
})();
