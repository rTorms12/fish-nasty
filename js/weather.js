/* Fish Nasty — weather (Open-Meteo, no API key) */
window.FN = window.FN || {};

FN.weather = (() => {
  const C = FN.config;
  const cache = new Map();

  const WMO = {
    0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
    45: ['Fog', '🌫️'], 48: ['Freezing fog', '🌫️'],
    51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
    56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
    61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
    66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
    71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
    80: ['Rain showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Heavy showers', '⛈️'],
    85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'],
    95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm w/ hail', '⛈️'], 99: ['Severe thunderstorm', '⛈️']
  };
  const describe = code => WMO[code] || ['—', '🌡️'];

  const FRESH = 30 * 60 * 1000, HIST_FRESH = 6 * 3600 * 1000;
  const fkey = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hkey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const forecastParams = (lats, lons) => new URLSearchParams({
    latitude: lats, longitude: lons,
    hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,weather_code,is_day,shortwave_radiation',
    daily: 'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,weather_code',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,weather_code,precipitation,is_day',
    temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch',
    timezone: C.tz, past_days: '2', forecast_days: '8'
  });
  const historyParams = (lats, lons) => new URLSearchParams({ latitude: lats, longitude: lons, daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min', temperature_unit: 'fahrenheit', timezone: C.tz, past_days: '45', forecast_days: '8' });

  function parseForecast(j) {
    const U = FN.util;
    const h = j.hourly;
    const hours = h.time.map((t, i) => ({
      t: U.parseLocal(t),
      temp: h.temperature_2m[i], feels: h.apparent_temperature[i], humidity: h.relative_humidity_2m ? h.relative_humidity_2m[i] : null,
      pressure: h.pressure_msl[i],
      wind: h.wind_speed_10m[i], windDir: h.wind_direction_10m[i], gust: h.wind_gusts_10m[i],
      cloud: h.cloud_cover[i], precip: h.precipitation[i], pop: h.precipitation_probability[i],
      code: h.weather_code[i], isDay: h.is_day[i] === 1, radiation: h.shortwave_radiation ? h.shortwave_radiation[i] : null
    }));
    const d = j.daily;
    const days = d.time.map((t, i) => ({
      date: U.parseLocal(t),
      sunrise: U.parseLocal(d.sunrise[i]), sunset: U.parseLocal(d.sunset[i]),
      hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i],
      precip: d.precipitation_sum[i], pop: d.precipitation_probability_max[i],
      windMax: d.wind_speed_10m_max[i], gustMax: d.wind_gusts_10m_max[i],
      code: d.weather_code[i]
    }));
    const c = j.current || {};
    return {
      lat: j.latitude, lon: j.longitude, elevation: j.elevation,
      fetched: new Date(),
      current: {
        t: c.time ? U.parseLocal(c.time) : new Date(),
        temp: c.temperature_2m, feels: c.apparent_temperature, wind: c.wind_speed_10m, windDir: c.wind_direction_10m,
        gust: c.wind_gusts_10m, humidity: c.relative_humidity_2m, pressure: c.pressure_msl, cloud: c.cloud_cover, code: c.weather_code, precip: c.precipitation, isDay: c.is_day === 1
      },
      hours, days
    };
  }
  const parseHistory = j => { const d = j.daily; return d.time.map((t, i) => ({ date: FN.util.parseLocal(t), mean: d.temperature_2m_mean[i], hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i] })).filter(x => x.mean != null); };

  // One entry per spot: { t, data } once loaded, { p } while a request is in the air (so two screens asking at once share it)
  function cached(map, key, maxAge, load) {
    const hit = map.get(key);
    if (hit && hit.data && Date.now() - hit.t < maxAge) return Promise.resolve(hit.data);
    if (hit && hit.p) return hit.p;
    const p = load().then(data => { map.set(key, { t: Date.now(), data }); return data; }, e => { if (map.get(key) && map.get(key).p === p) map.delete(key); throw e; });
    map.set(key, Object.assign({}, hit, { p }));
    return p;
  }
  const getJSON = (params, what) => fetch(`${C.weather}?${params.toString()}`).then(r => { if (!r.ok) throw new Error(what + ' request failed'); return r.json(); });

  const forecast = (lat, lon) => cached(cache, fkey(lat, lon), FRESH, () => getJSON(forecastParams(lat.toFixed(4), lon.toFixed(4)), 'Weather').then(parseForecast));

  const hPaToInHg = hpa => (hpa * 0.02953).toFixed(2);

  // Daily mean air temperature for the past 45 days plus the forecast week: feeds the water-temperature model
  const histCache = new Map();
  const history = (lat, lon) => cached(histCache, hkey(lat, lon), HIST_FRESH, () => getJSON(historyParams(lat.toFixed(4), lon.toFixed(4)), 'History').then(parseHistory));

  // Several lakes at once (weekend rankings): Open-Meteo takes comma-separated coordinates and answers with one result per point,
  // so ten lakes cost two requests instead of twenty. Results land in the same caches forecast() and history() read.
  async function prefetch(points) {
    const pts = (points || []).filter(p => p && p.lat != null && p.lon != null);
    const batch = (map, keyOf, maxAge, paramsOf, parse, what) => {
      const seen = new Set();
      const need = pts.filter(p => { const k = keyOf(p.lat, p.lon), hit = map.get(k); if (seen.has(k) || (hit && (hit.p || (hit.data && Date.now() - hit.t < maxAge)))) return false; seen.add(k); return true; });
      if (need.length < 2) return Promise.resolve();
      const all = getJSON(paramsOf(need.map(p => p.lat.toFixed(4)).join(','), need.map(p => p.lon.toFixed(4)).join(',')), what).then(j => (Array.isArray(j) ? j : [j]));
      need.forEach((p, i) => {
        const k = keyOf(p.lat, p.lon);
        const mine = all.then(list => { if (!list[i]) throw new Error(what + ' missing'); const data = parse(list[i]); map.set(k, { t: Date.now(), data }); return data; });
        mine.catch(() => { if (map.get(k) && map.get(k).p === mine) map.delete(k); });
        map.set(k, Object.assign({}, map.get(k), { p: mine }));
      });
      return all.then(() => {}, () => {});
    };
    await Promise.all([
      batch(cache, fkey, FRESH, forecastParams, parseForecast, 'Weather'),
      batch(histCache, hkey, HIST_FRESH, historyParams, parseHistory, 'History')
    ]);
  }

  // Active National Weather Service alerts for a point (warnings, watches, advisories). Never blocks: returns [] on any failure.
  const alertCache = new Map();
  async function alerts(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = alertCache.get(key);
    if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.data;
    try {
      const r = await fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: { Accept: 'application/geo+json' } });
      if (!r.ok) throw new Error('alerts ' + r.status);
      const j = await r.json();
      const rank = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
      const data = (j.features || []).map(f => f.properties || {}).map(p => ({
        id: p.id, event: p.event || 'Weather alert', headline: p.headline || '', severity: p.severity || 'Unknown', urgency: p.urgency || '',
        onset: p.onset || p.effective || null, ends: p.ends || p.expires || null, description: p.description || '', instruction: p.instruction || '', area: p.areaDesc || '', sender: p.senderName || ''
      })).sort((a, b) => (rank[a.severity] ?? 4) - (rank[b.severity] ?? 4));
      alertCache.set(key, { t: Date.now(), data });
      return data;
    } catch (e) { return hit ? hit.data : []; }
  }

  return { forecast, history, prefetch, describe, hPaToInHg, alerts };
})();
