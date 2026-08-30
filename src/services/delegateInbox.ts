import { callPublicRpc } from './supabase';

export type DelegateInboxSession = {
  enabled: boolean;
  branchKey: string | null;
  roleKey: string | null;
  name: string | null;
  canTree: boolean;
  canEvents: boolean;
  canPhone: boolean;
};

export type DelegateInboxRequest = {
  id: number;
  requestId: string;
  kind: string;
  lane: string;
  name: string;
  phone: string;
  branchKey: string;
  createdAt: string | null;
  detail: string;
};

export type DelegateInboxPerson = {
  id: number;
  personId: string | null;
  branchKey: string;
  displayName: string;
  path: string | null;
  gender: string | null;
  isDeceased: boolean;
  phone: string | null;
  status: string | null;
};

export class DelegateInboxRpcMissingError extends Error {
  constructor() {
    super('sql_missing');
    this.name = 'DelegateInboxRpcMissingError';
  }
}

type SessionRpc = {
  ok?: boolean;
  enabled?: boolean;
  error?: string;
  branch_key?: string | null;
  role_key?: string | null;
  name?: string | null;
  can_tree?: boolean;
  can_events?: boolean;
  can_phone?: boolean;
};

type ListRpc = {
  ok?: boolean;
  error?: string;
  branch_key?: string | null;
  role_key?: string | null;
  can_tree?: boolean;
  can_events?: boolean;
  can_phone?: boolean;
  rows?: Array<{
    id?: number;
    request_id?: string | null;
    kind?: string | null;
    lane?: string | null;
    name?: string | null;
    phone?: string | null;
    branch_key?: string | null;
    created_at?: string | null;
    detail?: string | null;
  }>;
};

type SearchRpc = {
  ok?: boolean;
  error?: string;
  need_query?: boolean;
  rows?: Array<{
    id?: number;
    person_id?: string | null;
    branch_key?: string | null;
    display_name?: string | null;
    path?: string | null;
    gender?: string | null;
    is_deceased?: boolean;
    phone?: string | null;
    status?: string | null;
  }>;
};

type ActionRpc = {
  ok?: boolean;
  error?: string;
};

function isMissingRpcMessage(message: string) {
  return /PGRST202|Could not find the function|sql_missing/i.test(message);
}

function rpcFailureCode(error: unknown): string {
  if (error instanceof DelegateInboxRpcMissingError) return 'sql_missing';
  const raw = error instanceof Error ? error.message : String(error || '');
  if (isMissingRpcMessage(raw)) return 'sql_missing';
  const text = raw.trim();
  if (/^[a-z_]+$/.test(text)) return text;
  try {
    const parsed = JSON.parse(raw) as { error?: string; code?: string };
    const code = String(parsed.error || parsed.code || '').toLowerCase();
    if (code) return code;
  } catch {
    // not json
  }
  const match = text.match(/\b([a-z_]{3,})\b/);
  return match ? match[1] : text;
}

function throwIfMissingRpc(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error || '');
  if (isMissingRpcMessage(message)) throw new DelegateInboxRpcMissingError();
  throw error instanceof Error ? error : new Error(message || 'تعذر الاتصال.');
}

function assertOk(row: ActionRpc | undefined) {
  if (!row) throw new DelegateInboxRpcMissingError();
  if (row.error === 'sql_missing') throw new DelegateInboxRpcMissingError();
  if (row.ok === false) throw new Error(row.error || 'not_allowed');
}

export async function fetchDelegateInboxSession(phone: string): Promise<DelegateInboxSession> {
  const cleaned = String(phone || '').trim();
  if (!cleaned) {
    return {
      enabled: false,
      branchKey: null,
      roleKey: null,
      name: null,
      canTree: false,
      canEvents: false,
      canPhone: false,
    };
  }
  try {
    const row = await callPublicRpc<SessionRpc>('delegate_app_session_v1', { p_phone: cleaned });
    return {
      enabled: Boolean(row && row.ok !== false && row.enabled),
      branchKey: row?.branch_key ? String(row.branch_key) : null,
      roleKey: row?.role_key ? String(row.role_key) : null,
      name: row?.name ? String(row.name) : null,
      canTree: Boolean(row?.can_tree),
      canEvents: Boolean(row?.can_events),
      canPhone: Boolean(row?.can_phone),
    };
  } catch {
    return {
      enabled: false,
      branchKey: null,
      roleKey: null,
      name: null,
      canTree: false,
      canEvents: false,
      canPhone: false,
    };
  }
}

export async function fetchDelegateInboxRequests(phone: string): Promise<DelegateInboxRequest[]> {
  const cleaned = String(phone || '').trim();
  if (!cleaned) return [];
  let row: ListRpc | undefined;
  try {
    row = await callPublicRpc<ListRpc>('delegate_app_requests_list_v1', { p_phone: cleaned });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
  return (row?.rows || [])
    .map((item) => ({
      id: Number(item.id),
      requestId: String(item.request_id || ''),
      kind: String(item.kind || '').trim(),
      lane: String(item.lane || '').trim(),
      name: String(item.name || '').trim(),
      phone: String(item.phone || '').trim(),
      branchKey: String(item.branch_key || '').trim(),
      createdAt: item.created_at ? String(item.created_at) : null,
      detail: String(item.detail || '').trim(),
    }))
    .filter((item) => item.id > 0);
}

export async function setDelegateInboxRequestStatus(
  phone: string,
  requestId: number,
  status: 'approved' | 'rejected',
): Promise<void> {
  const cleaned = String(phone || '').trim();
  if (!cleaned || requestId < 1) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('delegate_app_request_set_v1', {
      p_phone: cleaned,
      p_request_id: requestId,
      p_status: status,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

function mapPerson(item: NonNullable<SearchRpc['rows']>[number]): DelegateInboxPerson | null {
  const id = Number(item.id || 0);
  if (id < 1) return null;
  return {
    id,
    personId: item.person_id ? String(item.person_id) : null,
    branchKey: String(item.branch_key || '').trim(),
    displayName: String(item.display_name || '').trim(),
    path: item.path ? String(item.path).trim() : null,
    gender: item.gender ? String(item.gender).trim() : null,
    isDeceased: Boolean(item.is_deceased),
    phone: item.phone ? String(item.phone).trim() : null,
    status: item.status ? String(item.status).trim() : null,
  };
}

export async function searchDelegateInboxPeople(phone: string, query: string): Promise<DelegateInboxPerson[]> {
  const cleaned = String(phone || '').trim();
  const q = String(query || '').trim();
  if (!cleaned || q.length < 2) return [];
  let row: SearchRpc | undefined;
  try {
    row = await callPublicRpc<SearchRpc>('delegate_app_search_people_v1', {
      p_phone: cleaned,
      p_query: q,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
  return (row?.rows || []).map(mapPerson).filter((item): item is DelegateInboxPerson => Boolean(item));
}

export async function bindDelegateInboxRequest(args: {
  phone: string;
  requestId: number;
  treeChildId: number;
}): Promise<void> {
  const cleaned = String(args.phone || '').trim();
  if (!cleaned || args.requestId < 1 || args.treeChildId < 1) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('delegate_app_request_bind_v1', {
      p_phone: cleaned,
      p_request_id: args.requestId,
      p_tree_child_id: args.treeChildId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export function delegateInboxKindLabel(kind: string, lane: string) {
  if (lane === 'phone' || kind === 'member_phone_register' || kind === 'member_registration') {
    return 'تسجيل جوال';
  }
  if (kind === 'tree_card' || kind === 'add_person') return 'إضافة فرد';
  if (kind === 'tree_edit') return 'تصحيح شجرة';
  if (kind === 'memory_card' || kind === 'memory') return 'ذكرى';
  if (kind === 'event_card' || kind === 'family_event' || kind === 'event_request' || kind === 'occasion') {
    return 'مناسبة';
  }
  if (kind === 'patient' || kind === 'health') return 'حالة صحية';
  if (kind === 'event_death') return 'وفاة';
  return 'طلب فرع';
}

export function delegateInboxActionMessage(error: unknown): string {
  if (
    error instanceof DelegateInboxRpcMissingError ||
    isMissingRpcMessage(String(error instanceof Error ? error.message : error || ''))
  ) {
    return 'تعذر فتح طلبات الفرع الآن. راجِع الإدارة إن استمر.';
  }
  const code = rpcFailureCode(error);
  switch (code) {
    case 'sql_missing':
      return 'تعذر فتح طلبات الفرع الآن. راجِع الإدارة إن استمر.';
    case 'not_allowed':
      return 'هذه الجلسة ليست مندوب فرع معتمد.';
    case 'device_required':
      return 'الدخول من الجهاز الموثوق لهذا الرقم مطلوب.';
    case 'wrong_branch':
      return 'هذا الطلب خارج فرعك.';
    case 'bind_required':
      return 'طلب الجوال يُعتمد بربطه بشخص من فرعك.';
    case 'not_phone':
      return 'هذا الطلب ليس تسجيل جوال.';
    case 'phone_conflict':
      return 'هذا الجوال مربوط بشخص آخر.';
    case 'person_not_found':
    case 'not_found':
      return 'السجل غير موجود أو لم يعد معلّقًا.';
    case 'bad_phone':
    case 'bad_input':
      return 'البيانات غير مكتملة.';
    default:
      return 'تعذر إتمام العملية. أعد المحاولة.';
  }
}
