import { canonicalizePhone, memberProfilePhoneQuery, phonesMatch } from '../utils/phone';
import { callPublicRpc, classifyPublicRpcError, selectPublicRows } from './supabase';
import {
  clampFinjalHours,
  eventFamilyOf,
  findMobileEventType,
  isFinjalEventType,
  isNoticeEventType,
  normalizePlaceKind,
  parseCoordinates,
  toIsoDateOrEmpty,
} from '../utils/eventRequestMessage';

export type MemberOccasionRow = {
  branch_key: string;
  type: string;
  person: string;
  date_label: string;
  event_date: string;
  details: Record<string, unknown>;
  hospital_name: string;
  hospital_dept: string;
  contact_phone: string;
  created_at: string;
};

export function buildMemberOccasionRow(input: {
  branch: string;
  type: string;
  person: string;
  dateLabel: string;
  place: string;
  placeKind?: string;
  coords?: string;
  hospitalDept: string;
  contactPhone: string;
  prayerPlace: string;
  prayerTime: string;
  burialPlace: string;
  text: string;
  imageUrl: string;
  videoUrl: string;
  submitterName: string;
  submitterPhone: string;
  requestId: string;
  createdAt: string;
  durationHours?: number;
}): MemberOccasionRow {
  const typeMeta = findMobileEventType(input.type);
  const family = eventFamilyOf(input.type);
  const notice = isNoticeEventType(input.type);
  const eventDate = toIsoDateOrEmpty(input.dateLabel);
  const placeKind = normalizePlaceKind(input.placeKind);
  const coords = parseCoordinates(input.coords);
  const hospitalName = family === 'health' ? input.place.trim() : '';
  const condolencePlace = family === 'death' ? input.place.trim() : '';

  return {
    branch_key: input.branch.trim(),
    type: typeMeta.key,
    person: input.person.trim(),
    date_label: input.dateLabel.trim() || eventDate,
    event_date: eventDate,
    hospital_name: hospitalName,
    hospital_dept: input.hospitalDept.trim(),
    contact_phone: input.contactPhone.trim(),
    created_at: input.createdAt,
    details: {
      v: 1,
      kind:
        family === 'death'
          ? 'death_notice'
          : family === 'health'
            ? 'health_notice'
            : notice
              ? 'family_notice'
              : 'happy_notice',
      mode: typeMeta.mode,
      family,
      type: typeMeta.key,
      typeLabel: typeMeta.adminTypeLabel,
      person: input.person.trim(),
      date_label: input.dateLabel.trim() || null,
      event_date: eventDate || null,
      place: input.place.trim() || null,
      place_kind: placeKind || null,
      extra: input.place.trim() || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      hospital_name: hospitalName || null,
      hospital_dept: input.hospitalDept.trim() || null,
      prayer_place: input.prayerPlace.trim() || null,
      prayer_time: input.prayerTime.trim() || null,
      burial_place: input.burialPlace.trim() || null,
      condolence_place: condolencePlace || null,
      text: input.text.trim(),
      image_url: input.imageUrl.trim() || null,
      video_url: input.videoUrl.trim() || null,
      contact_phone: input.contactPhone.trim() || null,
      submitter_name: input.submitterName.trim(),
      submitter_phone: input.submitterPhone.trim(),
      request_id: input.requestId,
      created_at: input.createdAt,
      source: 'member',
      showDays: 7,
      duration_hours: isFinjalEventType(typeMeta.key) ? clampFinjalHours(input.durationHours) : null,
    },
  };
}

type RpcResult = { ok?: boolean; id?: number; error?: string };

export async function publishMemberOccasion(phone: string, row: MemberOccasionRow) {
  try {
    return await callPublicRpc<RpcResult>('member_publish_occasion_v1', {
      p_phone: phone,
      p_row: row,
    });
  } catch (error) {
    if (classifyPublicRpcError(error) === 'device_required') {
      return { ok: false, error: 'device_required' };
    }
    throw error;
  }
}

export async function updateMemberOccasion(phone: string, id: number, row: MemberOccasionRow) {
  try {
    return await callPublicRpc<RpcResult>('member_update_occasion_v1', {
      p_phone: phone,
      p_id: id,
      p_row: row,
    });
  } catch (error) {
    if (classifyPublicRpcError(error) === 'device_required') {
      return { ok: false, error: 'device_required' };
    }
    throw error;
  }
}

export async function deleteMemberOccasion(phone: string, id: number) {
  return callPublicRpc<RpcResult>('member_delete_occasion_v1', {
    p_phone: phone,
    p_id: id,
  });
}

export async function isRegisteredMemberPhone(phone: string) {
  const wanted = canonicalizePhone(phone);
  if (!wanted) return false;

  try {
    const { resumeTrustedDevice, getCachedDeviceSession } = await import('./deviceAuth');
    const cached = getCachedDeviceSession();
    if (cached?.phone && phonesMatch(cached.phone, wanted)) return true;
    const session = await resumeTrustedDevice();
    if (session?.phone && phonesMatch(session.phone, wanted)) return true;
  } catch {
    /* keep checking the family register */
  }

  try {
    const registered = await callPublicRpc<string | null>('member_phone_registered_v1', {
      p_phone: wanted,
    });
    if (typeof registered === 'string' && registered.trim()) return true;
  } catch (error) {
    if (classifyPublicRpcError(error) === 'device_required') {
      /* live function still gated by device; fall through to profiles */
    }
  }

  try {
    const path = memberProfilePhoneQuery(wanted);
    if (!path) return false;
    const rows = await selectPublicRows<{ id?: number }>(path);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}
