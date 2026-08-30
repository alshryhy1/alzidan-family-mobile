export type WeatherPlace = {
  label: string;
  lat: number;
  lon: number;
};

const DEFAULT_PLACE: WeatherPlace = {
  label: 'حائل',
  lat: 27.5114,
  lon: 41.7208,
};

const PLACES: Array<{ match: string; place: WeatherPlace }> = [
  { match: 'حائل', place: DEFAULT_PLACE },
  { match: 'الرياض', place: { label: 'الرياض', lat: 24.7136, lon: 46.6753 } },
  { match: 'جدة', place: { label: 'جدة', lat: 21.5433, lon: 39.1728 } },
  { match: 'جده', place: { label: 'جدة', lat: 21.5433, lon: 39.1728 } },
  { match: 'مكة', place: { label: 'مكة', lat: 21.3891, lon: 39.8579 } },
  { match: 'المدينة', place: { label: 'المدينة', lat: 24.5247, lon: 39.5692 } },
  { match: 'الدمام', place: { label: 'الدمام', lat: 26.4207, lon: 50.0888 } },
  { match: 'الخبر', place: { label: 'الخبر', lat: 26.2172, lon: 50.1971 } },
  { match: 'بريدة', place: { label: 'بريدة', lat: 26.326, lon: 43.975 } },
  { match: 'عنيزة', place: { label: 'عنيزة', lat: 26.0956, lon: 43.986 } },
  { match: 'القصيم', place: { label: 'القصيم', lat: 26.326, lon: 43.975 } },
  { match: 'أبها', place: { label: 'أبها', lat: 18.2164, lon: 42.5053 } },
  { match: 'تبوك', place: { label: 'تبوك', lat: 28.3838, lon: 36.555 } },
  { match: 'الخرج', place: { label: 'الخرج', lat: 24.1556, lon: 47.312 } },
  { match: 'الزلفي', place: { label: 'الزلفي', lat: 26.2992, lon: 44.8154 } },
];

function normalizePlace(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function resolveWeatherPlace(city?: string | null): WeatherPlace {
  const raw = normalizePlace(city || '');
  if (!raw) return DEFAULT_PLACE;
  const hit = PLACES.find((row) => raw.includes(row.match) || row.match.includes(raw));
  return hit?.place ?? DEFAULT_PLACE;
}

export function weatherConditionLabel(code: number | null): string {
  if (code == null) return '';
  if (code === 0) return 'صحو';
  if (code <= 3) return 'غائم جزئيًا';
  if (code === 45 || code === 48) return 'ضباب';
  if (code >= 51 && code <= 67) return 'مطر';
  if (code >= 71 && code <= 77) return 'برد';
  if (code >= 80 && code <= 82) return 'زخات';
  if (code >= 95) return 'رعد';
  return '';
}
