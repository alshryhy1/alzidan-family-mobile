import moment from 'moment-hijri';

export type PulseSeasonId =
  | 'ramadan'
  | 'eid_fitr'
  | 'hajj_ten'
  | 'eid_adha'
  | 'founding'
  | 'national'
  | 'school_start'
  | 'summer_break'
  | 'winter'
  | 'summer';

export type PulseSeason = {
  id: PulseSeasonId;
  label: string;
  start: string;
  end: string;
  priority: number;
};

export type PulseSeasonSnapshot = {
  today: string;
  current: PulseSeason | null;
  next: PulseSeason | null;
  daysUntilNext: number | null;
  daysLeftInCurrent: number | null;
  /** Next named occasion to count down to (skips winter/summer). days=0 means today. */
  countdown: { id: PulseSeasonId; label: string; days: number } | null;
};

const RIYADH = 'Asia/Riyadh';

const LABELS: Record<PulseSeasonId, string> = {
  ramadan: 'رمضان',
  eid_fitr: 'عيد الفطر',
  hajj_ten: 'العشر من ذي الحجة',
  eid_adha: 'عيد الأضحى',
  founding: 'يوم التأسيس',
  national: 'اليوم الوطني',
  school_start: 'بداية الدراسة',
  summer_break: 'الإجازة الصيفية',
  winter: 'الشتاء',
  summer: 'الصيف',
};

function latinDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function riyadhYmd(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) {
    return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
  }
  return `${year}-${month}-${day}`;
}

function ymdToUtcNoon(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((part) => Number(part));
  return new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
}

function diffDays(fromYmd: string, toYmd: string): number {
  const from = ymdToUtcNoon(fromYmd).getTime();
  const to = ymdToUtcNoon(toYmd).getTime();
  return Math.round((to - from) / 86400000);
}

function contains(season: PulseSeason, ymd: string) {
  return ymd >= season.start && ymd <= season.end;
}

function hijriYmd(hYear: number, hMonth: number, hDay: number): string {
  const stamp = moment(`${hYear}/${hMonth}/${hDay}`, 'iYYYY/iM/iD');
  if (!stamp.isValid()) return '';
  return latinDigits(stamp.format('YYYY-MM-DD'));
}

function hijriYearOf(ymd: string): number {
  const stamp = moment(ymdToUtcNoon(ymd));
  return Number(latinDigits(stamp.format('iYYYY')));
}

function makeSeason(
  id: PulseSeasonId,
  start: string,
  end: string,
  priority: number,
): PulseSeason | null {
  if (!start || !end || start > end) return null;
  return { id, label: LABELS[id], start, end, priority };
}

function gregorianWindows(gYear: number): PulseSeason[] {
  const y = String(gYear);
  const next = String(gYear + 1);
  const out: PulseSeason[] = [];
  const push = (row: PulseSeason | null) => {
    if (row) out.push(row);
  };

  push(makeSeason('founding', `${y}-02-21`, `${y}-02-23`, 80));
  push(makeSeason('national', `${y}-09-22`, `${y}-09-24`, 80));
  push(makeSeason('school_start', `${y}-08-16`, `${y}-09-30`, 60));
  push(makeSeason('summer_break', `${y}-05-28`, `${y}-08-15`, 50));
  push(makeSeason('winter', `${y}-12-01`, `${next}-02-20`, 40));
  push(makeSeason('summer', `${y}-06-01`, `${y}-08-31`, 20));
  return out;
}

function hijriWindows(hYear: number): PulseSeason[] {
  const out: PulseSeason[] = [];
  const push = (row: PulseSeason | null) => {
    if (row) out.push(row);
  };
  push(makeSeason('ramadan', hijriYmd(hYear, 9, 1), hijriYmd(hYear, 9, 30), 100));
  push(makeSeason('eid_fitr', hijriYmd(hYear, 10, 1), hijriYmd(hYear, 10, 3), 95));
  push(makeSeason('hajj_ten', hijriYmd(hYear, 12, 1), hijriYmd(hYear, 12, 9), 90));
  push(makeSeason('eid_adha', hijriYmd(hYear, 12, 10), hijriYmd(hYear, 12, 13), 95));
  return out;
}

function allWindows(today: string): PulseSeason[] {
  const gYear = Number(today.slice(0, 4));
  const hYear = hijriYearOf(today);
  return [
    ...gregorianWindows(gYear - 1),
    ...gregorianWindows(gYear),
    ...gregorianWindows(gYear + 1),
    ...hijriWindows(hYear - 1),
    ...hijriWindows(hYear),
    ...hijriWindows(hYear + 1),
  ].filter((row) => Boolean(row.start && row.end));
}

const COUNTDOWN_IDS: PulseSeasonId[] = [
  'ramadan',
  'eid_fitr',
  'hajj_ten',
  'eid_adha',
  'founding',
  'national',
  'school_start',
];

const TODAY_OCCASION_IDS: PulseSeasonId[] = [
  'ramadan',
  'eid_fitr',
  'hajj_ten',
  'eid_adha',
  'founding',
  'national',
];

function pickCountdown(
  today: string,
  covering: PulseSeason[],
  windows: PulseSeason[],
): PulseSeasonSnapshot['countdown'] {
  const todayHit = covering.find((row) => TODAY_OCCASION_IDS.includes(row.id));
  if (todayHit) {
    return { id: todayHit.id, label: todayHit.label, days: 0 };
  }
  const upcoming = windows
    .filter((row) => COUNTDOWN_IDS.includes(row.id) && row.start > today)
    .sort((a, b) => a.start.localeCompare(b.start) || b.priority - a.priority);
  const next = upcoming[0];
  if (!next) return null;
  return { id: next.id, label: next.label, days: Math.max(0, diffDays(today, next.start)) };
}

export function resolvePulseSeason(at: Date = new Date()): PulseSeasonSnapshot {
  const today = riyadhYmd(at);
  const windows = allWindows(today);
  const covering = windows.filter((row) => contains(row, today));
  covering.sort((a, b) => b.priority - a.priority || a.start.localeCompare(b.start));
  const current = covering[0] ?? null;

  const upcoming = windows
    .filter((row) => row.start > today)
    .sort((a, b) => a.start.localeCompare(b.start) || b.priority - a.priority);
  const next = upcoming[0] ?? null;

  return {
    today,
    current,
    next,
    daysUntilNext: next ? Math.max(0, diffDays(today, next.start)) : null,
    daysLeftInCurrent: current ? Math.max(0, diffDays(today, current.end)) : null,
    countdown: pickCountdown(today, covering, windows),
  };
}

export function daysWord(n: number) {
  if (n === 0) return 'اليوم';
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومان';
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يوم`;
}

export function remainingOccasionPhrase(label: string, days: number) {
  const name = String(label || '').trim();
  if (!name) return '';
  if (days <= 0) return `${name} اليوم`;
  return `متبقي على ${name} ${daysWord(days)}`;
}
