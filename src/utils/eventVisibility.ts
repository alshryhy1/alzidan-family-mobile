/**
 * مصدر ظهور الأخبار الواحد (مسار C / NEWS-001 + جدولة).
 * القواعد مطابقة لـ web `isFamilyEventPubliclyVisible`:
 * - وفاة: 3 أيام تقويمية من يوم الحدث (أو created_at إن لم يوجد event_date)
 * - صحة: ضمن نافذة showDays من created_at (1–7، افتراضي 7)
 * - الأفراح المؤرخة: لا تظهر قبل show_at (افتراضي 3 أيام قبل التاريخ)
 * - event_date = null: يعتمد على created_at / showDays فقط (لا ظهور أبدي)
 */
import moment from 'moment-hijri';

export type EventVisibilityInput = {
  type?: string | null;
  category?: string | null;
  eventDate?: string | null;
  event_date?: string | null;
  date?: string | null;
  dateLabel?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  showDays?: number | null;
  showAt?: string | null;
  show_at?: string | null;
  endAt?: string | null;
  end_at?: string | null;
  showBeforeDays?: number | null;
  show_before_days?: number | null;
  manualHidden?: boolean | null;
  manual_hidden?: boolean | null;
  details?: string | Record<string, unknown> | null;
};

const DEATH_KEEP_DAYS = 3;
const DEFAULT_SHOW_DAYS = 7;
const DEFAULT_SHOW_BEFORE_DAYS = 3;

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

export function isHealthEventType(event: EventVisibilityInput) {
  const type = String(event.type || '').trim().toLowerCase();
  return type === 'sick' || type === 'operation' || type === 'discharge';
}

function readScheduleValue(event: EventVisibilityInput, snake: string, camel: string) {
  const direct = (event as Record<string, unknown>)[snake] ?? (event as Record<string, unknown>)[camel];
  if (direct != null && direct !== '') return direct;
  const env = parseEventEnvelope(event.details);
  if (!env) return null;
  const nested = env.event && typeof env.event === 'object' ? (env.event as Record<string, unknown>) : null;
  const fromEnv = env[snake] ?? env[camel] ?? nested?.[snake] ?? nested?.[camel];
  if (fromEnv != null && fromEnv !== '') return fromEnv;
  return null;
}

export function getShowBeforeDays(event: EventVisibilityInput) {
  const raw = readScheduleValue(event, 'show_before_days', 'showBeforeDays');
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SHOW_BEFORE_DAYS;
  if (n < 1) return 1;
  if (n > 7) return 7;
  return Math.trunc(n);
}

export function isManualHidden(event: EventVisibilityInput) {
  const raw = readScheduleValue(event, 'manual_hidden', 'manualHidden');
  return raw === true || raw === 1 || raw === '1' || raw === 'true';
}

function parseTimestampMs(raw: unknown) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : null;
}

function endOfLocalDayMs(dayMs: number) {
  const d = new Date(dayMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

function resolveScheduleWindow(event: EventVisibilityInput, now: Date = new Date()) {
  const dayMs = parseFamilyEventDayMs({
    ...event,
    eventDate: event.eventDate || event.event_date || event.date || event.dateLabel,
  });
  const showAtMs = parseTimestampMs(readScheduleValue(event, 'show_at', 'showAt') ?? event.showAt ?? event.show_at);
  const endAtMs = parseTimestampMs(readScheduleValue(event, 'end_at', 'endAt') ?? event.endAt ?? event.end_at);
  const beforeDays = getShowBeforeDays(event);
  let resolvedShowAt = showAtMs;
  let resolvedEndAt = endAtMs;
  if (resolvedShowAt == null && dayMs != null) {
    resolvedShowAt = dayMs - beforeDays * 24 * 60 * 60 * 1000;
  }
  if (resolvedEndAt == null && dayMs != null) {
    resolvedEndAt = endOfLocalDayMs(dayMs);
  }
  return {
    showAtMs: resolvedShowAt,
    endAtMs: resolvedEndAt,
    eventDayMs: dayMs,
    nowMs: now.getTime(),
  };
}

/** فرق الأيام: موجب = مستقبل، 0 = اليوم، سالب = ماضٍ. null إن تعذّر الحل. */
export function daysFromEventDay(event: EventVisibilityInput, now: Date = new Date()) {
  const dayMs = parseFamilyEventDayMs(event);
  if (dayMs == null) return null;
  const todayStart = startOfLocalDayMs(now);
  return Math.round((dayMs - todayStart) / (24 * 60 * 60 * 1000));
}

export function parseFamilyEventDayMs(event: EventVisibilityInput) {
  const eventDate = normalizeArabicDigits(event.eventDate || event.event_date || '');
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

  const createdRaw = event.createdAt || event.created_at;
  if (!createdRaw) return true;
  const createdAt = Date.parse(String(createdRaw));
  if (!Number.isFinite(createdAt)) return true;
  const created = new Date(createdAt);
  const createdStart = startOfLocalDayMs(created);
  const todayStart = startOfLocalDayMs(now);
  const ageDays = Math.round((todayStart - createdStart) / (24 * 60 * 60 * 1000));
  return ageDays >= 0 && ageDays <= days - 1;
}

export function isCreatedWithinShowWindow(event: EventVisibilityInput, now: Date = new Date()) {
  const createdRaw = event.createdAt || event.created_at;
  if (!createdRaw) return true;
  const createdAt = Date.parse(String(createdRaw));
  if (!Number.isFinite(createdAt)) return true;
  const maxAgeMs = getEventVisibilityDays(event) * 24 * 60 * 60 * 1000;
  return createdAt >= now.getTime() - maxAgeMs;
}

/** هل الخبر يجب أن يظهر للعامة (تطبيق / ودجت / ويب)؟ */
export function isFamilyEventPubliclyVisible(
  event: EventVisibilityInput,
  now: Date = new Date(),
) {
  if (isManualHidden(event)) return false;

  if (isDeathEventType(event)) {
    return isWithinDaysFromEventDay(event, DEATH_KEEP_DAYS, now);
  }

  if (isHealthEventType(event)) {
    return isCreatedWithinShowWindow(event, now);
  }

  const win = resolveScheduleWindow(event, now);
  if (win.eventDayMs != null || win.showAtMs != null || win.endAtMs != null) {
    if (win.endAtMs != null && win.nowMs > win.endAtMs) return false;
    if (win.showAtMs != null && win.nowMs < win.showAtMs) return false;
    if (win.endAtMs == null) {
      const diff = daysFromEventDay(event, now);
      if (diff !== null && diff < 0) return false;
    }
    return true;
  }

  // Dated happy/travel events must not fall back to "created recently → show".
  // If a date label exists but could not be parsed, keep it hidden.
  const hasDatedHint = Boolean(
    String(event.eventDate || event.event_date || event.date || event.dateLabel || '').trim(),
  );
  if (hasDatedHint) return false;

  return isCreatedWithinShowWindow(event, now);
}

/** أقرب لحظة يُفترض بعدها إعادة تقييم الظهور (منتصف الليل التالي محليًا). */
export function nextVisibilityRefreshDate(now: Date = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  return next;
}
