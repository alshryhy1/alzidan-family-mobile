import { callPublicRpc, classifyPublicRpcError, isSupabaseConfigured } from './supabase';
import { canonicalizePhone } from '../utils/phone';

export type AidSituation = 'widow' | 'divorced' | 'other';

export type AidPayChannel = 'othaim_card' | 'sawaa_electric' | 'sawaa_rent' | 'family_fund';

export type AidRequestStatus = 'pending' | 'published' | 'closed' | 'declined';

export type MyAidRequest = {
  id: number;
  situation: AidSituation;
  situationLabel: string;
  needText: string;
  hideName: boolean;
  status: AidRequestStatus;
  publicTitle: string | null;
  publicBody: string | null;
  publishContactNote: string | null;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
};

export type PublishedAidRequest = {
  id: number;
  situation: AidSituation;
  situationLabel: string;
  title: string;
  body: string;
  contactNote: string;
  payChannel: AidPayChannel | null;
  payChannelLabel: string;
  payRef: string | null;
  branchKey: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export const AID_SITUATIONS: { id: AidSituation; label: string; hint: string }[] = [
  { id: 'widow', label: 'أرملة', hint: 'طلب خاص — لا يُعرض اسمك للعامة' },
  { id: 'divorced', label: 'مطلقة', hint: 'طلب خاص — لا يُعرض اسمك للعامة' },
  { id: 'other', label: 'أخرى', hint: 'حالة أخرى تحتاج مساعدة' },
];

export function aidPayChannelLabel(channel?: string | null) {
  const c = String(channel || '')
    .trim()
    .toLowerCase();
  if (c === 'othaim_card') return 'ساهم عبر رقم بطاقة العثيم';
  if (c === 'sawaa_electric') return 'ساهم بسداد فاتورة سوا — كهرباء';
  if (c === 'sawaa_rent') return 'ساهم بسداد فاتورة سوا — إيجار';
  if (c === 'family_fund') return 'ساهم عبر صندوق العائلة / الإدارة';
  return 'ساهم عبر إدارة العائلة وصندوق العائلة';
}

/** عنوان خانة الرقم حسب قناة المساهمة. */
export function aidPayRefFieldLabel(channel?: string | null) {
  const c = String(channel || '')
    .trim()
    .toLowerCase();
  if (c === 'othaim_card') return 'رقم بطاقة العثيم';
  if (c === 'sawaa_electric') return 'رقم / مرجع فاتورة سوا — كهرباء';
  if (c === 'sawaa_rent') return 'رقم / مرجع فاتورة سوا — إيجار';
  if (c === 'family_fund') return 'مرجع صندوق العائلة';
  return 'رقم المساهمة';
}

/** خطوات المساهمة الظاهرة تحت الخانة. */
export function aidPayHowTo(channel?: string | null) {
  const c = String(channel || '')
    .trim()
    .toLowerCase();
  if (c === 'othaim_card') {
    return 'انسخ رقم البطاقة ثم اشحن/أضف رصيد بطاقة العثيم بهذا الرقم — بلا تحويل باسم المستفيدة.';
  }
  if (c === 'sawaa_electric') {
    return 'انسخ مرجع الفاتورة وادفع عبر سوا (كهرباء) بهذا الرقم — بلا اسم المستفيدة.';
  }
  if (c === 'sawaa_rent') {
    return 'انسخ مرجع الفاتورة وادفع عبر سوا (إيجار) بهذا الرقم — بلا اسم المستفيدة.';
  }
  if (c === 'family_fund') {
    return 'المساهمة عبر صندوق العائلة / الإدارة حسب المرجع أعلاه.';
  }
  return 'ساهم عبر القناة الظاهرة دون طلب اسم المستفيدة.';
}

function normalizePayChannel(value: unknown): AidPayChannel | null {
  const c = String(value || '')
    .trim()
    .toLowerCase();
  if (c === 'othaim_card' || c === 'sawaa_electric' || c === 'sawaa_rent' || c === 'family_fund') {
    return c;
  }
  return null;
}

export function aidStatusLabel(status: string) {
  const s = String(status || '').toLowerCase();
  if (s === 'pending') return 'بانتظار الإدارة';
  if (s === 'published') return 'منشور للمساعدة';
  if (s === 'closed') return 'أُغلق';
  if (s === 'declined') return 'لم يُعتمد';
  return status || '—';
}

function mapMine(row: Record<string, unknown>): MyAidRequest {
  return {
    id: Number(row.id || 0),
    situation: (String(row.situation || 'other') as AidSituation) || 'other',
    situationLabel: String(row.situation_label || ''),
    needText: String(row.need_text || ''),
    hideName: row.hide_name !== false,
    status: (String(row.status || 'pending') as AidRequestStatus) || 'pending',
    publicTitle: row.public_title != null ? String(row.public_title) : null,
    publicBody: row.public_body != null ? String(row.public_body) : null,
    publishContactNote: row.publish_contact_note != null ? String(row.publish_contact_note) : null,
    createdAt: String(row.created_at || ''),
    publishedAt: row.published_at != null ? String(row.published_at) : null,
    closedAt: row.closed_at != null ? String(row.closed_at) : null,
  };
}

function mapPublished(row: Record<string, unknown>): PublishedAidRequest {
  const payChannel = normalizePayChannel(row.pay_channel);
  return {
    id: Number(row.id || 0),
    situation: (String(row.situation || 'other') as AidSituation) || 'other',
    situationLabel: String(row.situation_label || ''),
    title: String(row.title || row.situation_label || 'فرصة مساعدة'),
    body: String(row.body || ''),
    contactNote: String(
      row.contact_note ||
        'ساهم عبر القناة أدناه — بلا تحويل باسم المستفيدة.',
    ),
    payChannel,
    payChannelLabel: String(row.pay_channel_label || '') || aidPayChannelLabel(payChannel),
    payRef: row.pay_ref != null ? String(row.pay_ref).trim() || null : null,
    branchKey: row.branch_key != null ? String(row.branch_key) : null,
    publishedAt: row.published_at != null ? String(row.published_at) : null,
    createdAt: String(row.created_at || ''),
  };
}

function rpcErrorMessage(code: string) {
  if (code === 'not_registered') return 'يلزم تسجيل الدخول برقم عضو مسجّل.';
  if (code === 'bad_situation') return 'اختر الحالة: أرملة أو مطلقة أو أخرى.';
  if (code === 'need_too_short') return 'اكتب وصف الاحتياج بوضوح (٨ أحرف على الأقل).';
  if (code === 'sql_missing') return 'أمر المساعدة غير مفعّل بعد في قاعدة البيانات.';
  if (code === 'insert_failed') return 'تعذر إرسال الطلب. حاول لاحقاً.';
  return 'تعذر إتمام العملية.';
}

export async function submitAidRequest(input: {
  phone: string;
  situation: AidSituation;
  needText: string;
  hideName?: boolean;
  contactPhone?: string;
}) {
  if (!isSupabaseConfigured()) throw new Error('تعذر الاتصال الآن.');
  const phone = canonicalizePhone(input.phone);
  if (!phone) throw new Error('رقم الجوال غير صالح.');

  try {
    const res = await callPublicRpc<{ ok?: boolean; error?: string; id?: number }>(
      'member_aid_request_submit_v1',
      {
        p_phone: phone,
        p_situation: input.situation,
        p_need_text: String(input.needText || '').trim(),
        p_hide_name: input.hideName !== false,
        p_contact_phone: input.contactPhone ? canonicalizePhone(input.contactPhone) : null,
      },
    );
    if (!res || res.ok !== true) {
      throw new Error(rpcErrorMessage(String(res?.error || '')));
    }
    return { id: Number(res.id || 0) };
  } catch (err) {
    if (classifyPublicRpcError(err) === 'rpc_missing') {
      throw new Error('أمر المساعدة غير مفعّل بعد. نفّذ SQL طلبات المساعدة في Supabase.');
    }
    throw err instanceof Error ? err : new Error('تعذر إرسال الطلب.');
  }
}

export async function loadMyAidRequests(phone: string) {
  if (!isSupabaseConfigured()) return [] as MyAidRequest[];
  const cleaned = canonicalizePhone(phone);
  if (!cleaned) return [];
  try {
    const res = await callPublicRpc<{ ok?: boolean; rows?: Record<string, unknown>[] }>(
      'member_aid_requests_mine_v1',
      { p_phone: cleaned },
    );
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    return rows.map(mapMine).filter((r) => r.id > 0);
  } catch (err) {
    if (classifyPublicRpcError(err) === 'rpc_missing') return [];
    throw err;
  }
}

export async function loadPublishedAidRequests() {
  if (!isSupabaseConfigured()) {
    throw new Error('تعذر الاتصال الآن. تحقق من ملف .env ثم أعد تشغيل Expo.');
  }
  try {
    const res = await callPublicRpc<{ ok?: boolean; rows?: Record<string, unknown>[] | string }>(
      'public_aid_requests_published_v1',
      {},
    );
    let raw = res?.rows;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as Record<string, unknown>[];
      } catch {
        raw = [];
      }
    }
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map(mapPublished).filter((r) => r.id > 0);
  } catch (err) {
    if (classifyPublicRpcError(err) === 'rpc_missing') {
      throw new Error('أمر فرص المساعدة غير مفعّل في قاعدة البيانات.');
    }
    throw err instanceof Error ? err : new Error('تعذر تحميل فرص المساعدة.');
  }
}
