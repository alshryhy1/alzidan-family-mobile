import { callPublicRpc } from './supabase';

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


export function yourOccasionPhrase(type?: string | null) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'promotion_notice' || t === 'promotion') return 'ترقيتك';
  if (t === 'graduation_notice' || t === 'graduation') return 'تخرجك';
  if (t === 'retirement_notice' || t === 'retirement') return 'تقاعدك';
  if (t === 'marriage' || t === 'wedding' || t === 'contract') return 'زواجك';
  if (t === 'birth' || t === 'aqiqa') return 'مولودكم';
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
  if (['feast', 'gathering', 'family_meetup', 'dinner', 'lunch', 'general'].includes(t)) {
    return 'دعوتك';
  }
  return 'مناسبتك';
}

export function trackTitle(track?: string | null) {
  const t = String(track || '').trim().toLowerCase();
  if (t === 'deceased') return 'دعاء للمتوفى';
  if (t === 'bereaved') return 'مواساة أهل الفقيد';
  return '';
}

export function ctaTitleForType(type?: string | null, person?: string | null) {
  const t = String(type || '').trim().toLowerCase();
  const name = String(person || '').trim() || 'صاحب المناسبة';
  if (['sick', 'operation', 'healing', 'discharge', 'safety'].includes(t)) {
    return `شارك في الدعاء لـ ${name}`;
  }
  if (t === 'death' || t === 'condolence') return 'شارك الدعاء والمواساة';
  if (['feast', 'gathering', 'family_meetup', 'dinner', 'lunch', 'general'].includes(t)) {
    return `رد على دعوة ${name}`;
  }
  return `شارك ${name} فرحته`;
}

export async function fetchOccasionInteractionCatalog(eventType: string) {
  const family =
    ['sick', 'operation', 'healing', 'discharge', 'safety'].includes(eventType)
      ? 'health'
      : ['death', 'condolence'].includes(eventType)
        ? 'death'
        : [
              'wedding',
              'contract',
              'graduation',
              'aqiqa',
              'feast',
              'gathering',
              'family_meetup',
              'promotion',
              'retirement',
              'dinner',
              'lunch',
              'general',
            ].includes(eventType)
          ? 'occasion'
          : 'news';

  const data = await callPublicRpc<OccasionInteractionType[] | { error?: string }>(
    'occasion_interaction_catalog_v1',
    {
      p_event_type: eventType,
      p_family: family,
    },
  );
  if (Array.isArray(data)) return data;
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
