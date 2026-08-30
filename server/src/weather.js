// Open-Meteo forecast + geocoding (free, no API key). Cached for 15 minutes.

const CACHE_MS = 15 * 60 * 1000;
let cache = { key: null, at: 0, data: null };

export async function getForecast(loc, timezone) {
  const key = `${loc.lat},${loc.lon}`;
  if (cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.data;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', loc.lat);
  url.searchParams.set('longitude', loc.lon);
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('timezone', timezone || 'auto');
  url.searchParams.set('temperature_unit', 'fahrenheit');

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`weather http ${res.status}`);
  const raw = await res.json();
  const data = {
    location_name: loc.name || null,
    current: { temp: Math.round(raw.current.temperature_2m), code: raw.current.weather_code },
    daily: raw.daily.time.map((date, i) => ({
      date,
      code: raw.daily.weather_code[i],
      high: Math.round(raw.daily.temperature_2m_max[i]),
      low: Math.round(raw.daily.temperature_2m_min[i]),
    })),
  };
  cache = { key, at: Date.now(), data };
  return data;
}

export async function geocode(query) {
  if (!query.trim()) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.trim());
  url.searchParams.set('count', '5');
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const raw = await res.json();
  return (raw.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}
