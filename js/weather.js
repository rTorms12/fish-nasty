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

  async function forecast(lat, lon) {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < 30 * 60 * 1000) return hit.data;
    const p = new URLSearchParams({
      latitude: lat.toFixed(4), longitude: lon.toFixed(4),
      hourly: 'temperature_2m,apparent_temperature,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,weather_code,is_day',
      daily: 'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,weather_code',
      current: 'temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,weather_code,precipitation,is_day',
      temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch',
      timezone: C.tz, past_days: '2', forecast_days: '8'
    });
    const r = await fetch(`${C.weather}?${p.toString()}`);
    if (!r.ok) throw new Error('Weather request failed');
    const j = await r.json();
    const U = FN.util;
    const h = j.hourly;
    const hours = h.time.map((t, i) => ({
      t: U.parseLocal(t),
      temp: h.temperature_2m[i], feels: h.apparent_temperature[i],
      pressure: h.pressure_msl[i],
      wind: h.wind_speed_10m[i], windDir: h.wind_direction_10m[i], gust: h.wind_gusts_10m[i],
      cloud: h.cloud_cover[i], precip: h.precipitation[i], pop: h.precipitation_probability[i],
      code: h.weather_code[i], isDay: h.is_day[i] === 1
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
    const data = {
      lat: j.latitude, lon: j.longitude, elevation: j.elevation,
      fetched: new Date(),
      current: {
        t: c.time ? U.parseLocal(c.time) : new Date(),
        temp: c.temperature_2m, feels: c.apparent_temperature, wind: c.wind_speed_10m, windDir: c.wind_direction_10m,
        gust: c.wind_gusts_10m, pressure: c.pressure_msl, cloud: c.cloud_cover, code: c.weather_code, precip: c.precipitation, isDay: c.is_day === 1
      },
      hours, days
    };
    cache.set(key, { t: Date.now(), data });
    return data;
  }

  const hPaToInHg = hpa => (hpa * 0.02953).toFixed(2);

  return { forecast, describe, hPaToInHg };
})();
