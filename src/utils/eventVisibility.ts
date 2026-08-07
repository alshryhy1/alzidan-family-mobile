/**
 * مصدر ظهور الأخبار الواحد (مسار C / NEWS-001).
 * القواعد مطابقة لـ web `isFamilyEventPubliclyVisible`:
 * - وفاة: 3 أيام تقويمية من يوم الحدث (أو created_at إن لم يوجد event_date)
 * - غير الوفاة: ضمن نافذة showDays من created_at (1–7، افتراضي 7)
 * - الأفراح المؤرخة: تختفي بعد انتهاء يوم المناسبة
 * - event_date = null: يعتمد على created_at / showDays فقط (لا ظهور أبدي)
 */
import moment from 'moment-hijri';

export type EventVisibilityInput = {
  type?: string | null;
  category?: string | null;
  eventDate?: string | null;
  date?: string | null;
  dateLabel?: string | null;
  createdAt?: string | null;
  showDays?: number | null;
  details?: string | Record<string, unknown> | null;
};

const DEATH_KEEP_DAYS = 3;
const DEFAULT_SHOW_DAYS = 7;

function normalizeArabicDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\\\-.]/g, '/')
    .trim();
}

function startOfLocalDayMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function clampVisibilityDays(value: unknown, fallback = DEFAULT_SHOW_DAYS) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 1) return 1;
  if (n > 7) return 7;
  return Math.trunc(n);
}

export function parseEventEnvelope(details: EventVisibilityInput['details']) {
  if (details == null || details === '') return null;
  if (typeof details === 'object') return details as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(details));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function getEventVisibilityDays(event: EventVisibilityInput) {
  if (event.showDays != null) {
    return clampVisibilityDays(event.showDays);
  }
  const env = parseEventEnvelope(event.details);
  if (
    env &&
    env.v === 1 &&
    (env.kind === 'happy_notice' || env.kind === 'health_notice' || env.kind === 'death_notice')
  ) {
    return clampVisibilityDays(env.showDays);
  }
  return DEFAULT_SHOW_DAYS;
}

export function isDeathEventType(event: EventVisibilityInput) {
  const type = String(event.type || '').trim().toLowerCase();
  if (type === 'death') return true;
  return String(event.category || '').trim().toLowerCase() === 'condolence';
}

export function isHappyEventType(event: EventVisibilityInput) {
  const type = String(event.type || '').trim().toLowerCase();
  if (!type) {
    const category = String(event.category || '').trim().toLowerCase();
    return category === 'happy' || category === '';
  }
  return !['death', 'sick', 'operation', 'discharge'].includes(type);
}

/** فرق الأيام: موجب = مستقبل، 0 = اليوم، سالب = ماضٍ. null إن تعذّر الحل. */
export function daysFromEventDay(event: EventVisibilityInput, now: Date = new Date()) {
  const dayMs = parseFamilyEventDayMs(event);
  if (dayMs == null) return null;
  const todayStart = startOfLocalDayMs(now);
  return Math.round((dayMs - todayStart) / (24 * 60 * 60 * 1000));
}

export function parseFamilyEventDayMs(event: EventVisibilityInput) {
  const eventDate = normalizeArabicDigits(event.eventDate || '');
  const ymd = eventDate.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (year >= 1900) {
      return new Date(year, month - 1, day).getTime();
    }
    if (year >= 1300 && year < 1900) {
      try {
        const converted = moment(`${year}/${month}/${day}`, 'iYYYY/iM/iD').toDate();
        if (converted instanceof Date && Number.isFinite(converted.getTime())) {
          return startOfLocalDayMs(converted);
        }
      } catch {
        // ignore
      }
    }
  }

  const label = normalizeArabicDigits(event.date || event.dateLabel || event.eventDate || '');
  const parts = label.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/);
  if (!parts) return null;
  const a = Number(parts[1]);
  const month = Number(parts[2]);
  const c = Number(parts[3]);
  const year = a >= 1300 ? a : c;
  const day = a >= 1300 ? c : a;
  if (!year || !month || !day) return null;

  try {
    const converted = moment(`${year}/${month}/${day}`, 'iYYYY/iM/iD').toDate();
    if (converted instanceof Date && Number.isFinite(converted.getTime())) {
      return startOfLocalDayMs(converted);
    }
  } catch {
    // ignore
  }
  return null;
}

export function isWithinDaysFromEventDay(
  event: EventVisibilityInput,
  keepDays: number,
  now: Date = new Date(),
) {
  const days = Math.max(1, keepDays);
  const diff = daysFromEventDay(event, now);
  if (diff !== null) return diff >= -(days - 1);

  if (!event.createdAt) return true;
  const createdAt = Date.parse(String(event.createdAt));
  if (!Number.isFinite(createdAt)) return true;
  const created = new Date(createdAt);
  const createdStart = startOfLocalDayMs(created);
  const todayStart = startOfLocalDayMs(now);
  const ageDays = Math.round((todayStart - createdStart) / (24 * 60 * 60 * 1000));
  return ageDays >= 0 && ageDays <= days - 1;
}

export function isCreatedWithinShowWindow(event: EventVisibilityInput, now: Date = new Date()) {
  if (!event.createdAt) return true;
  const createdAt = Date.parse(String(event.createdAt));
  if (!Number.isFinite(createdAt)) return true;
  const maxAgeMs = getEventVisibilityDays(event) * 24 * 60 * 60 * 1000;
  return createdAt >= now.getTime() - maxAgeMs;
}

/** هل الخبر يجب أن يظهر للعامة (تطبيق / ودجت / ويب)؟ */
export function isFamilyEventPubliclyVisible(
  event: EventVisibilityInput,
  now: Date = new Date(),
) {
  if (isDeathEventType(event)) {
    return isWithinDaysFromEventDay(event, DEATH_KEEP_DAYS, now);
  }

  if (!isCreatedWithinShowWindow(event, now)) return false;

  if (isHappyEventType(event)) {
    const diff = daysFromEventDay(event, now);
    if (diff !== null && diff < 0) return false;
  }

  return true;
}

/** أقرب لحظة يُفترض بعدها إعادة تقييم الظهور (منتصف الليل التالي محليًا). */
export function nextVisibilityRefreshDate(now: Date = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  return next;
}
