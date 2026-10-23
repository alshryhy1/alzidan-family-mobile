import { callPublicRpc } from './supabase';
import {
  eventFamilyOf,
  isFinjalEventType,
  normalizeMobileEventType,
} from '../utils/eventRequestMessage';

export type OccasionInteractionType = {
  id?: number;
  key: string;
  family: string;
  applies_to_types?: string[];
  track?: string | null;
  label: string;
  full_text: string;
  allows_message?: boolean;
  sort_order?: number;
};

export type OccasionInboxItem = {
  occasion_id: number;
  occasion_type?: string;
  occasion_person?: string;
  branch_key?: string;
  recipient_id?: number;
  recipient_role?: string;
  recipient_name?: string;
  total: number;
  by_type?: Record<string, number>;
  latest_at?: string;
  messages?: Array<{
    id: number;
    sender_name?: string;
    interaction_type_key?: string;
    label?: string;
    full_text?: string;
    message?: string | null;
    created_at?: string;
  }>;
};


const RSVP_TYPES = new Set([
  'feast',
  'gathering',
  'family_meetup',
  'dinner',
  'lunch',
  'general',
  'finjal_asr',
  'finjal_isha',
  'finjal_hawlna',
]);
const CEREMONY_TYPES = new Set([
  'wedding',
  'contract',
  'graduation',
  'promotion',
  'retirement',
  'aqiqa',
]);
const DROP_REPLY_KEYS = new Set(['inv_details', 'inv_contact']);

const ILLNESS_ONLY_KEYS = new Set(['heal_ask', 'heal_tahoor']);
const SICKNESS_PRAYER_KEYS = new Set(['heal_ask', 'heal_tahoor', 'heal_shifa']);

export function filterCatalogForType(
  items: OccasionInteractionType[] | null | undefined,
  eventType: string,
) {
  const typeKey = normalizeMobileEventType(eventType);
  const family = eventFamilyOf(typeKey);
  let list = Array.isArray(items) ? items.slice() : [];
  list = list.filter((item) => {
    if (!item || DROP_REPLY_KEYS.has(item.key)) return false;
    const types = item.applies_to_types;
    if (!Array.isArray(types) || !types.length || !types.includes(typeKey)) return false;
    if (family === 'death' && item.family && item.family !== 'death') return false;
    if (family === 'health' && item.family && item.family !== 'health') return false;
    if ((family === 'news' || family === 'occasion') && item.family === 'death') return false;
    return true;
  });
  if (typeKey === 'healing') {
    list = list.filter((item) => !ILLNESS_ONLY_KEYS.has(item.key));
  }
  if (typeKey === 'safety') {
    list = list.filter((item) => !SICKNESS_PRAYER_KEYS.has(item.key));
  }
  if (RSVP_TYPES.has(typeKey)) {
    list = list.filter(
      (item) =>
        item.key === 'inv_yes' ||
        item.key === 'inv_no' ||
        item.key === 'inv_maybe' ||
        item.allows_message,
    );
  }
  return list;
}

export function yourOccasionPhrase(type?: string | null) {
  const t = normalizeMobileEventType(type);
  if (t === 'promotion_notice') return 'ترقيتك';
  if (t === 'graduation_notice') return 'تخرجك';
  if (t === 'retirement_notice') return 'تقاعدك';
  if (t === 'marriage') return 'زواجك';
  if (t === 'birth') return 'مولودكم';
  if (t === 'new_house') return 'منزلك الجديد';
  if (t === 'success') return 'نجاحك';
  if (t === 'achievement') return 'إنجازك';
  if (t === 'appointment') return 'تعيينك';
  if (t === 'certification') return 'شهادتك';
  if (t === 'family_news') return 'خبرك';
  if (['sick', 'operation', 'healing', 'discharge', 'safety'].includes(t)) {
    return 'حالتك الصحية';
  }
  if (t === 'death' || t === 'condolence') return 'مناسبة العزاء';
  if (RSVP_TYPES.has(t) || CEREMONY_TYPES.has(t)) return 'دعوتك';
  return 'مناسبتك';
}

export function trackTitle(track?: string | null) {
  const t = String(track || '').trim().toLowerCase();
  if (t === 'deceased') return 'دعاء للمتوفى';
  if (t === 'bereaved') return 'مواساة أهل الفقيد';
  return '';
}

export function ctaTitleForType(type?: string | null, person?: string | null) {
  const t = normalizeMobileEventType(type);
  const family = eventFamilyOf(t);
  const name = String(person || '').trim() || 'صاحب المناسبة';
  if (family === 'health' || ['sick', 'operation', 'healing', 'discharge', 'safety'].includes(t)) {
    return `شارك في الدعاء لـ ${name}`;
  }
  if (family === 'death' || t === 'death' || t === 'condolence') return 'شارك الدعاء والمواساة';
  if (family === 'occasion' || RSVP_TYPES.has(t) || CEREMONY_TYPES.has(t)) {
    return `رد على دعوة ${name}`;
  }
  return `شارك ${name} تهنئته`;
}

export async function fetchOccasionInteractionCatalog(eventType: string) {
  const typeKey = normalizeMobileEventType(eventType);
  const family = eventFamilyOf(typeKey);

  const data = await callPublicRpc<OccasionInteractionType[] | { error?: string }>(
    'occasion_interaction_catalog_v1',
    {
      p_event_type: typeKey,
      p_family: family,
    },
  );
  if (Array.isArray(data)) return filterCatalogForType(data, typeKey);
  return [];
}

export async function fetchMyOccasionInteraction(occasionId: number, phone: string) {
  const data = await callPublicRpc<{ ok?: boolean; interaction?: { interaction_type_key?: string; message?: string } | null }>(
    'occasion_my_interaction_v1',
    {
      p_occasion_id: occasionId,
      p_sender_phone: phone,
    },
  );
  return data?.interaction ?? null;
}

export async function submitOccasionInteraction(input: {
  occasionId: number;
  interactionTypeKey: string;
  senderPhone: string;
  senderName?: string;
  message?: string;
  recipientId?: number | null;
}) {
  return callPublicRpc<{ ok?: boolean; error?: string; id?: number }>(
    'occasion_interaction_submit_v1',
    {
      p_occasion_id: input.occasionId,
      p_interaction_type_key: input.interactionTypeKey,
      p_sender_phone: input.senderPhone,
      p_sender_name: input.senderName || null,
      p_message: input.message || null,
      p_recipient_id: input.recipientId ?? null,
    },
  );
}

export async function fetchOccasionInbox(phone: string) {
  const data = await callPublicRpc<{ ok?: boolean; items?: OccasionInboxItem[]; error?: string }>(
    'occasion_inbox_for_phone_v1',
    { p_phone: phone },
  );
  return Array.isArray(data?.items) ? data.items : [];
}

/** أقصى بقاء لردود الفنجال بعد آخر تفاعل (أطول مدة نشر ١٢ ساعة + هامش). */
export const FINJAL_INBOX_KEEP_MS = 36 * 60 * 60 * 1000;
/** بقية المناسبات: أسبوع من آخر تفاعل إن لم تعد ظاهرة على المجلس. */
export const OCCASION_INBOX_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export function occasionInboxTimestampMs(item: OccasionInboxItem): number {
  const latest = Date.parse(String(item.latest_at || ''));
  if (Number.isFinite(latest) && latest > 0) return latest;
  const messages = Array.isArray(item.messages) ? item.messages : [];
  let max = 0;
  for (const message of messages) {
    const at = Date.parse(String(message.created_at || ''));
    if (Number.isFinite(at) && at > max) max = at;
  }
  return max;
}

export type FilterOccasionInboxOptions = {
  /** معرفات المناسبات الظاهرة الآن على المجلس. الفنجال خارجها يُخفى فورًا. */
  activeOccasionIds?: Iterable<string | number> | null;
  now?: Date;
};

/**
 * يخفي ردود فنجال سابق حتى لا تظهر مع فنجال اليوم وكأنها مرسلة اليوم.
 * الفنجال غير الظاهر على المجلس لا يبقى في «وصلك من العائلة».
 */
export function isCurrentOccasionInboxItem(
  item: OccasionInboxItem,
  opts: FilterOccasionInboxOptions = {},
) {
  const nowMs = (opts.now ?? new Date()).getTime();
  const id = String(item.occasion_id ?? '').trim();
  const active =
    opts.activeOccasionIds == null
      ? null
      : new Set([...opts.activeOccasionIds].map((value) => String(value).trim()).filter(Boolean));
  // قائمة فارغة أثناء التحميل ≠ «لا مناسبة»؛ نرجع لعمر الرد فقط.
  const boardReady = Boolean(active && active.size > 0);

  if (boardReady && id && active!.has(id)) return true;

  const at = occasionInboxTimestampMs(item);
  const age = at > 0 ? nowMs - at : Number.POSITIVE_INFINITY;

  if (isFinjalEventType(item.occasion_type)) {
    // فنجال انتهى من المجلس أو تجاوز نافذة الردود → لا يُعرض في جلسة لاحقة.
    if (boardReady && id && !active!.has(id)) return false;
    return age <= FINJAL_INBOX_KEEP_MS;
  }

  return age <= OCCASION_INBOX_KEEP_MS;
}

export function filterCurrentOccasionInbox(
  items: OccasionInboxItem[] | null | undefined,
  opts: FilterOccasionInboxOptions = {},
) {
  if (!Array.isArray(items) || !items.length) return [];
  return items.filter((item) => isCurrentOccasionInboxItem(item, opts));
}

/** تسمية الدعوة في صندوق الوارد حتى لا تُخلط جلسة قديمة بجديدة. */
export function occasionInboxHeadline(item: OccasionInboxItem) {
  const person = String(item.occasion_person || '').trim();
  const yours = yourOccasionPhrase(item.occasion_type);
  if (!person) return yours;
  if (yours === 'دعوتك') return `دعوة ${person}`;
  return `${yours} · ${person}`;
}

/** وقت الرد بالعربية حتى لا تبدو رسالة سابقة وكأنها اليوم. */
export function formatOccasionInboxWhen(raw?: string | null, now: Date = new Date()) {
  const at = Date.parse(String(raw || ''));
  if (!Number.isFinite(at) || at <= 0) return '';
  const diffMs = now.getTime() - at;
  if (diffMs < 0) return 'الآن';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'قبل ساعة' : `قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days < 14) return `قبل ${days} يوم`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return weeks === 1 ? 'قبل أسبوع' : `قبل ${weeks} أسابيع`;
  const d = new Date(at);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
