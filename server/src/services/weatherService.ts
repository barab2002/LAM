import type { WeatherSnapshot } from '../types/api';

/**
 * Open-Meteo current weather — free, no API key.
 * https://open-meteo.com/en/docs
 */

// WMO weather interpretation codes → coarse condition buckets
function conditionFromWmoCode(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'thunderstorm';
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    temperature_2m_min: number[];
    temperature_2m_max: number[];
  };
}

export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,precipitation,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_min,temperature_2m_max&forecast_days=1&timezone=auto';

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;

  return {
    tempC: data.current.temperature_2m,
    tempMinC: data.daily.temperature_2m_min[0],
    tempMaxC: data.daily.temperature_2m_max[0],
    precipitationMm: data.current.precipitation,
    windKmh: data.current.wind_speed_10m,
    condition: conditionFromWmoCode(data.current.weather_code),
  };
}
