import { weatherIsNotable } from '../utils/pulseFocus';
import {
  resolveWeatherPlace,
  weatherConditionLabel,
  type WeatherPlace,
} from '../utils/pulseWeatherPlace';
import type { PulseWeatherSnap } from '../utils/pulseFocus';

const CACHE_MS = 20 * 60 * 1000;

let cache: { at: number; key: string; snap: PulseWeatherSnap } | null = null;

export async function loadPulseWeather(city?: string | null): Promise<PulseWeatherSnap | null> {
  const place = resolveWeatherPlace(city);
  const key = `${place.lat},${place.lon}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return cache.snap;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}` +
    `&longitude=${place.lon}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FRiyadh`;

  try {
    const response = await fetch(url);
    if (!response.ok) return cachedOrNull(place);
    const body = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
    };
    const tempC =
      body.current && Number.isFinite(Number(body.current.temperature_2m))
        ? Number(body.current.temperature_2m)
        : null;
    const code =
      body.current && Number.isFinite(Number(body.current.weather_code))
        ? Number(body.current.weather_code)
        : null;
    const isDayRaw = body.current?.is_day;
    const isDay =
      isDayRaw === 1 || isDayRaw === 0 ? isDayRaw === 1 : null;
    const snap: PulseWeatherSnap = {
      tempC,
      code,
      isDay,
      notable: weatherIsNotable(tempC, code),
      placeLabel: place.label,
      conditionLabel: weatherConditionLabel(code) || place.label,
    };
    cache = { at: Date.now(), key, snap };
    return snap;
  } catch {
    return cachedOrNull(place);
  }
}

function cachedOrNull(place: WeatherPlace): PulseWeatherSnap | null {
  if (cache && cache.key === `${place.lat},${place.lon}`) return cache.snap;
  return null;
}
