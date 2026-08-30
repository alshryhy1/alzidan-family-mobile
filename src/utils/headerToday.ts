const RIYADH = 'Asia/Riyadh';

export const FRIDAY_SALAWAT = 'صلوا على محمد';

export type HeaderToday = {
  weekday: string;
  hijri: string;
  gregorian: string;
  salawat: string | null;
};

function riyadhWeekday(at: Date) {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: RIYADH,
      weekday: 'short',
    }).format(at) || ''
  );
}

/** Friday from 00:00 Riyadh (the night Friday begins) until Saturday. */
export function fridaySalawatFromMidnight(at: Date = new Date()) {
  if (riyadhWeekday(at) !== 'Fri') return null;
  return FRIDAY_SALAWAT;
}

function toArabicDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d);
}

function numericDayMonthYear(at: Date, calendar: 'islamic-umalqura' | 'gregory') {
  const parts = new Intl.DateTimeFormat(`en-u-ca-${calendar}`, {
    timeZone: RIYADH,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(at);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return toArabicDigits(`${num('day')}-${num('month')}-${num('year')}`);
}

export function formatHeaderTodayNumeric(at: Date = new Date()): HeaderToday {
  const weekday = new Intl.DateTimeFormat('ar-SA', {
    timeZone: RIYADH,
    weekday: 'long',
  }).format(at);
  return {
    weekday,
    hijri: `${numericDayMonthYear(at, 'islamic-umalqura')} هـ`,
    gregorian: numericDayMonthYear(at, 'gregory'),
    salawat: fridaySalawatFromMidnight(at),
  };
}

export function formatHeaderToday(at: Date = new Date()): HeaderToday {
  const weekday = new Intl.DateTimeFormat('ar-SA', {
    timeZone: RIYADH,
    weekday: 'long',
  }).format(at);
  const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    timeZone: RIYADH,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(at);
  const gregorian = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: RIYADH,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(at);
  return { weekday, hijri, gregorian, salawat: fridaySalawatFromMidnight(at) };
}
