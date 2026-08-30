import type { PulseSeasonSnapshot } from './pulseSeason';

export type PulseFocusKind = 'presence' | 'weather' | 'season' | 'next';

export type PulseWeatherSnap = {
  tempC: number | null;
  code: number | null;
  isDay: boolean | null;
  notable: boolean;
  placeLabel: string;
  conditionLabel: string;
};

export type PulseLiveModel = {
  online: number | null;
  weather: PulseWeatherSnap | null;
  season: PulseSeasonSnapshot;
};

export type PulseFocus = {
  kind: PulseFocusKind;
  value: string;
  caption: string;
};

function rainOrStorm(code: number | null) {
  if (code == null) return false;
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 99);
}

export function pickPulseFocus(model: PulseLiveModel): PulseFocus {
  const online = model.online;
  const weather = model.weather;
  const season = model.season;
  const current = season.current;
  const next = season.next;
  const daysUntil = season.daysUntilNext;
  const temp = weather?.tempC ?? null;

  if (weather && weather.notable && temp != null) {
    return {
      kind: 'weather',
      value: `${Math.round(temp)}°`,
      caption: weather.conditionLabel,
    };
  }

  if (next && daysUntil != null && daysUntil <= 7 && daysUntil >= 0) {
    return {
      kind: 'next',
      value: daysUntil === 0 ? 'اليوم' : String(daysUntil),
      caption: daysUntil === 0 ? next.label : `باقي على ${next.label}`,
    };
  }

  if (online != null && online >= 5) {
    return {
      kind: 'presence',
      value: String(online),
      caption: online === 1 ? 'متواجد الآن' : online === 2 ? 'متواجدان الآن' : 'متواجدون الآن',
    };
  }

  if (current) {
    return {
      kind: 'season',
      value: current.label,
      caption: 'الموسم الآن',
    };
  }

  if (temp != null && weather) {
    return {
      kind: 'weather',
      value: `${Math.round(temp)}°`,
      caption: weather.placeLabel,
    };
  }

  if (online != null && online > 0) {
    return {
      kind: 'presence',
      value: String(online),
      caption: online === 1 ? 'متواجد الآن' : online === 2 ? 'متواجدان الآن' : 'متواجدون الآن',
    };
  }

  if (next && daysUntil != null) {
    return {
      kind: 'next',
      value: String(daysUntil),
      caption: `باقي على ${next.label}`,
    };
  }

  return {
    kind: 'season',
    value: 'نبض اليوم',
    caption: 'عائلتك معك',
  };
}

export function weatherIsNotable(tempC: number | null, code: number | null) {
  if (rainOrStorm(code)) return true;
  if (tempC != null && (tempC >= 43 || tempC <= 8)) return true;
  return false;
}
