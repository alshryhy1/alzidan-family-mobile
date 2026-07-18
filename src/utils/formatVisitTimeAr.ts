/** Display-only: HH:mm → Arabic 12h like ٥ م or ٥:٣٠ م (ص/م). Does not change stored values. */

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeWesternDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function toEasternDigits(value: string) {
  return value.replace(/\d/g, (digit) => EASTERN_DIGITS[Number(digit)] ?? digit);
}

export function formatVisitTimeAr(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = normalizeWesternDigits(raw);
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(normalized);
  if (!match) return raw;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return raw;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return raw;

  const suffix = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  if (minute === 0) {
    return `${toEasternDigits(String(hour))} ${suffix}`;
  }

  return `${toEasternDigits(String(hour))}:${toEasternDigits(String(minute).padStart(2, '0'))} ${suffix}`;
}

export function formatVisitTimeRangeAr(from?: string | null, to?: string | null): string {
  const fromLabel = from ? formatVisitTimeAr(from) : '';
  const toLabel = to ? formatVisitTimeAr(to) : '';
  if (fromLabel && toLabel) return `من ${fromLabel} إلى ${toLabel}`;
  return fromLabel || toLabel || '';
}
