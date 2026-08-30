import { MOBILE_EVENT_TYPES, normalizeMobileEventType } from './eventRequestMessage';

const ARABIC_LABELS: Record<string, string> = Object.fromEntries(
  MOBILE_EVENT_TYPES.map((item) => [item.key, item.label]),
);

// Legacy display-only
ARABIC_LABELS.engagement = 'خطوبة';
ARABIC_LABELS.congratulation = 'خبر عائلي';
ARABIC_LABELS.invitation = 'دعوة عشاء';
ARABIC_LABELS.travel = 'خبر عائلي';
ARABIC_LABELS.happy = 'خبر عائلي';
ARABIC_LABELS.other = 'مناسبة عامة';
ARABIC_LABELS.meeting = 'اجتماع عائلي';

const NOTICE_TYPES = new Set(
  MOBILE_EVENT_TYPES.filter((item) => item.mode === 'notice').map((item) => item.key),
);

export function eventTypeArabicLabel(type?: string | null) {
  const raw = String(type || '').trim();
  if (!raw) return 'مناسبة عامة';
  const key = normalizeMobileEventType(raw);
  if (ARABIC_LABELS[key]) return ARABIC_LABELS[key];
  const lower = raw.toLowerCase();
  if (ARABIC_LABELS[lower]) return ARABIC_LABELS[lower];
  if (ARABIC_LABELS[raw]) return ARABIC_LABELS[raw];
  return raw;
}

export function isNoticeEventType(type?: string | null) {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  return NOTICE_TYPES.has(key);
}
