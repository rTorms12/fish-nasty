/* Fish Nasty — sun, moon and solunar periods (uses SunCalc) */
window.FN = window.FN || {};

FN.solunar = (() => {
  const HOUR = 3600 * 1000;

  function phaseName(phase) {
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    const idx = Math.round(phase * 8) % 8;
    return names[idx];
  }
  function phaseIcon(phase) {
    const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    return icons[Math.round(phase * 8) % 8];
  }

  // Moon overhead (transit) and underfoot times for a local calendar day
  function moonTransits(day, lat, lon) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
    const end = new Date(start.getTime() + 24 * HOUR);
    const step = 5 * 60 * 1000;
    const samples = [];
    for (let t = start.getTime() - step; t <= end.getTime() + step; t += step) {
      samples.push({ t, alt: SunCalc.getMoonPosition(new Date(t), lat, lon).altitude });
    }
    const peaks = [], troughs = [];
    for (let i = 1; i < samples.length - 1; i++) {
      const a = samples[i - 1].alt, b = samples[i].alt, c = samples[i + 1].alt;
      if (b > a && b >= c) peaks.push(refine(samples[i].t, lat, lon, true));
      if (b < a && b <= c) troughs.push(refine(samples[i].t, lat, lon, false));
    }
    const inDay = t => t >= start.getTime() && t < end.getTime();
    return { overhead: peaks.filter(inDay).map(t => new Date(t)), underfoot: troughs.filter(inDay).map(t => new Date(t)) };
  }
  function refine(t0, lat, lon, max) {
    // golden-ish refinement around a 5-minute sample to ~30 s precision
    let lo = t0 - 5 * 60 * 1000, hi = t0 + 5 * 60 * 1000;
    while (hi - lo > 30 * 1000) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      const a1 = SunCalc.getMoonPosition(new Date(m1), lat, lon).altitude;
      const a2 = SunCalc.getMoonPosition(new Date(m2), lat, lon).altitude;
      if (max ? a1 < a2 : a1 > a2) lo = m1; else hi = m2;
    }
    return (lo + hi) / 2;
  }

  function dayInfo(day, lat, lon) {
    const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
    const sun = SunCalc.getTimes(noon, lat, lon);
    const moonT = SunCalc.getMoonTimes(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0), lat, lon, false);
    const ill = SunCalc.getMoonIllumination(noon);
    const tr = moonTransits(day, lat, lon);
    const majors = [...tr.overhead.map(t => ({ type: 'major', label: 'Moon overhead', center: t, half: 60 })),
                    ...tr.underfoot.map(t => ({ type: 'major', label: 'Moon underfoot', center: t, half: 60 }))];
    const minors = [];
    if (moonT.rise) minors.push({ type: 'minor', label: 'Moonrise', center: moonT.rise, half: 45 });
    if (moonT.set) minors.push({ type: 'minor', label: 'Moonset', center: moonT.set, half: 45 });
    const periods = [...majors, ...minors].sort((a, b) => a.center - b.center);
    return {
      date: new Date(day.getFullYear(), day.getMonth(), day.getDate()),
      sunrise: sun.sunrise, sunset: sun.sunset, dawn: sun.dawn, dusk: sun.dusk,
      moonrise: moonT.rise || null, moonset: moonT.set || null, moonAlwaysUp: !!moonT.alwaysUp, moonAlwaysDown: !!moonT.alwaysDown,
      overhead: tr.overhead, underfoot: tr.underfoot,
      phase: ill.phase, illumination: ill.fraction, phaseName: phaseName(ill.phase), phaseIcon: phaseIcon(ill.phase),
      periods
    };
  }

  // 0..1 strength of solunar influence at time t (1 = center of a major period)
  function strengthAt(t, info) {
    let s = 0;
    for (const p of info.periods) {
      const d = Math.abs(t - p.center) / 60000; // minutes
      const win = p.half + (p.type === 'major' ? 30 : 15); // taper beyond the nominal window
      if (d <= win) {
        const v = (p.type === 'major' ? 1 : 0.6) * (1 - Math.max(0, d - p.half * 0.5) / (win - p.half * 0.5));
        if (v > s) s = v;
      }
    }
    return s;
  }

  // Moon phase factor: +1 at new/full, -0.4 near quarters, 0 otherwise
  function phaseFactor(phase) {
    const dNew = Math.min(phase, 1 - phase);
    const dFull = Math.abs(phase - 0.5);
    const d = Math.min(dNew, dFull);
    if (d <= 0.07) return 1 - d / 0.07;
    const dq = Math.min(Math.abs(phase - 0.25), Math.abs(phase - 0.75));
    if (dq <= 0.05) return -0.4 * (1 - dq / 0.05);
    return 0;
  }

  // Day rating for the solunar calendar (0..4 fish icons)
  function dayRating(info) {
    const pf = phaseFactor(info.phase);
    let r = 2 + Math.round(pf * 2);
    return FN.util.clamp(r, 0, 4);
  }

  return { dayInfo, strengthAt, phaseFactor, phaseName, phaseIcon, dayRating };
})();
