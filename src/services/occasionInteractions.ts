import { callPublicRpc } from './supabase';
import { eventFamilyOf, normalizeMobileEventType } from '../utils/eventRequestMessage';

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

export function filterCatalogForType(
  items: OccasionInteractionType[] | null | undefined,
  eventType: string,
) {
  const typeKey = normalizeMobileEventType(eventType);
  let list = Array.isArray(items) ? items.slice() : [];
  list = list.filter((item) => {
    if (!item || DROP_REPLY_KEYS.has(item.key)) return false;
    const types = item.applies_to_types;
    if (Array.isArray(types) && types.length) return types.includes(typeKey);
    return true;
  });
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
