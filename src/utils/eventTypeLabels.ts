import { MOBILE_EVENT_TYPES } from './eventRequestMessage';

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
  const key = String(type || '')
    .trim()
    .toLowerCase();
  if (!key) return 'خبر عائلي';
  return ARABIC_LABELS[key] || 'خبر عائلي';
}

export function isNoticeEventType(type?: string | null) {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  return NOTICE_TYPES.has(key);
}
