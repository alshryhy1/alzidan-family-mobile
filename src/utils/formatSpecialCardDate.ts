import moment from 'moment-hijri';

function normalizeArabicDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function parseStoredEventDate(value: string) {
  const raw = normalizeArabicDigits(value)
    .trim()
    .replace(/\//g, '-');

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!iso) return null;

  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  if (!year || !month || !day) return null;

  if (year >= 1300 && year < 1900) {
    return { kind: 'hijri' as const, year, month, day };
  }
  if (year >= 1900 && year < 2100) {
    return { kind: 'gregorian' as const, year, month, day };
  }

  return null;
}

function toEventDate(parsed: { kind: 'hijri' | 'gregorian'; year: number; month: number; day: number }) {
  if (parsed.kind === 'gregorian') {
    return new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0);
  }

  const hijriMoment = moment(`${parsed.year}/${parsed.month}/${parsed.day}`, 'iYYYY/iM/iD');
  if (!hijriMoment.isValid()) return null;
  return hijriMoment.toDate();
}

function formatGregorianArabic(date: Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
  }).format(date);
}

function formatHijriArabic(date: Date) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** event_date في special_cards قد يكون هجرياً (1448-01-18) أو ميلادياً (2026-07-12) */
export function formatSpecialCardDate(value?: string | null): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = parseStoredEventDate(raw);
  if (!parsed) return raw;

  const date = toEventDate(parsed);
  if (!date || !Number.isFinite(date.getTime())) return raw;

  const hijriLine = formatHijriArabic(date);
  const gregorianLine = formatGregorianArabic(date);
  return `${hijriLine}\n${gregorianLine}`;
}
