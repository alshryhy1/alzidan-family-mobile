import { callPublicRpc } from './supabase';

export type FamilyAdminSession = {
  enabled: boolean;
  treeChildId: number | null;
  personId: string | null;
};

export type FamilyAdminPerson = {
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

export type FamilyAdminRequest = {
  id: number;
  requestId: string;
  kind: string;
  requestType: string;
  name: string;
  phone: string;
  branchKey: string;
  createdAt: string | null;
};

export type FamilyAdminDelegateRole = {
  roleKey: string;
  titleAr: string;
};

export type FamilyAdminDelegate = {
  id: string;
  branchKey: string;
  name: string;
  phone: string;
  email: string;
  roleKey: string;
  roleTitleAr: string;
  isEnabled: boolean;
};

export type FamilyAdminDevice = {
  id: number;
  phoneKey: string;
  label: string;
  status: string;
  boundAt: string | null;
  lastSeenAt: string | null;
};

export class FamilyAdminRpcMissingError extends Error {
  constructor() {
    super('sql_missing');
    this.name = 'FamilyAdminRpcMissingError';
  }
}

type SessionRpc = {
  ok?: boolean;
  enabled?: boolean;
  tree_child_id?: number | null;
  person_id?: string | null;
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

type ListRpc = {
  ok?: boolean;
  error?: string;
  rows?: Array<{
    id?: number;
    request_id?: string | null;
    kind?: string | null;
    request_type?: string | null;
    name?: string | null;
    phone?: string | null;
    branch_key?: string | null;
    created_at?: string | null;
  }>;
};

type DelegatesRpc = {
  ok?: boolean;
  error?: string;
  rows?: Array<{
    id?: string | null;
    branch_key?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    role_key?: string | null;
    role_title_ar?: string | null;
    is_enabled?: boolean;
  }>;
  roles?: Array<{
    role_key?: string | null;
    title_ar?: string | null;
  }>;
};

type DevicesRpc = {
  ok?: boolean;
  error?: string;
  items?: Array<{
    id?: number;
    phone_key?: string | null;
    label?: string | null;
    status?: string | null;
    bound_at?: string | null;
    last_seen_at?: string | null;
  }>;
};

function isMissingRpcMessage(message: string) {
  return /PGRST202|Could not find the function|sql_missing/i.test(message);
}

function rpcFailureCode(error: unknown): string {
  if (error instanceof FamilyAdminRpcMissingError) return 'sql_missing';
  const raw = error instanceof Error ? error.message : String(error || '');
  if (isMissingRpcMessage(raw)) return 'sql_missing';
  const text = raw.trim();
  if (/^[a-z_]+$/.test(text)) return text;
  try {
    const parsed = JSON.parse(raw) as { error?: string; code?: string; message?: string };
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
  if (isMissingRpcMessage(message)) throw new FamilyAdminRpcMissingError();
  throw error instanceof Error ? error : new Error(message || 'تعذر الاتصال.');
}

function assertOk(row: ActionRpc | undefined) {
  if (!row) throw new FamilyAdminRpcMissingError();
  if (row.error === 'sql_missing') throw new FamilyAdminRpcMissingError();
  if (row.ok === false) throw new Error(row.error || 'not_allowed');
}

export async function fetchFamilyAdminSession(phone: string): Promise<FamilyAdminSession> {
  const cleaned = String(phone || '').trim();
  if (!cleaned) return { enabled: false, treeChildId: null, personId: null };
  try {
    const row = await callPublicRpc<SessionRpc>('family_admin_session_v1', { p_phone: cleaned });
    return {
      enabled: Boolean(row && row.ok !== false && row.enabled),
      treeChildId: row?.tree_child_id != null ? Number(row.tree_child_id) : null,
      personId: row?.person_id ? String(row.person_id) : null,
    };
  } catch {
    return { enabled: false, treeChildId: null, personId: null };
  }
}

function mapPerson(item: NonNullable<SearchRpc['rows']>[number]): FamilyAdminPerson | null {
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

export async function searchFamilyAdminPeople(
  adminPhone: string,
  query: string,
  branchKey?: string | null,
): Promise<FamilyAdminPerson[]> {
  const cleaned = String(adminPhone || '').trim();
  const q = String(query || '').trim();
  if (!cleaned || q.length < 2) return [];
  let row: SearchRpc | undefined;
  try {
    row = await callPublicRpc<SearchRpc>('family_admin_search_people_v1', {
      p_phone: cleaned,
      p_query: q,
      p_branch_key: branchKey ? String(branchKey).trim() : null,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
  return (row?.rows || []).map(mapPerson).filter((item): item is FamilyAdminPerson => Boolean(item));
}

export async function updateFamilyAdminPerson(args: {
  adminPhone: string;
  treeChildId: number;
  displayName: string;
  gender: string | null;
  isDeceased: boolean;
}): Promise<void> {
  const cleaned = String(args.adminPhone || '').trim();
  if (!cleaned || args.treeChildId < 1) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_update_person_v1', {
      p_phone: cleaned,
      p_tree_child_id: args.treeChildId,
      p_display_name: String(args.displayName || '').trim() || null,
      p_gender: args.gender ? String(args.gender).trim() : null,
      p_is_deceased: args.isDeceased,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export async function setFamilyAdminPhone(args: {
  adminPhone: string;
  treeChildId: number;
  memberPhone: string;
}): Promise<void> {
  const cleaned = String(args.adminPhone || '').trim();
  if (!cleaned || args.treeChildId < 1) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_set_phone_v1', {
      p_phone: cleaned,
      p_tree_child_id: args.treeChildId,
      p_member_phone: String(args.memberPhone || '').trim(),
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export async function fetchFamilyAdminRequests(adminPhone: string): Promise<FamilyAdminRequest[]> {
  const cleaned = String(adminPhone || '').trim();
  if (!cleaned) return [];
  let row: ListRpc | undefined;
  try {
    row = await callPublicRpc<ListRpc>('family_admin_requests_list_v1', { p_phone: cleaned });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
  return (row?.rows || [])
    .map((item) => ({
      id: Number(item.id),
      requestId: String(item.request_id || ''),
      kind: String(item.kind || '').trim(),
      requestType: String(item.request_type || '').trim(),
      name: String(item.name || '').trim(),
      phone: String(item.phone || '').trim(),
      branchKey: String(item.branch_key || '').trim(),
      createdAt: item.created_at ? String(item.created_at) : null,
    }))
    .filter((item) => item.id > 0);
}

export function isFamilyAdminMemberRequest(row: FamilyAdminRequest) {
  if (isFamilyAdminDelegateRequest(row)) return false;
  const kind = String(row.kind || '').trim();
  return !kind || kind === 'member_registration' || kind === 'member_phone_register';
}

export function isFamilyAdminDelegateRequest(row: FamilyAdminRequest) {
  const kind = String(row.kind || '').trim();
  const type = String(row.requestType || '').trim();
  return (
    kind === 'tree_delegate' ||
    kind === 'events_delegate' ||
    kind === 'delegate_secret_reset' ||
    type === 'delegate_secret_reset'
  );
}

export async function rejectFamilyAdminRequest(adminPhone: string, requestId: number): Promise<void> {
  const cleaned = String(adminPhone || '').trim();
  if (!cleaned || requestId < 1) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_request_reject_v1', {
      p_phone: cleaned,
      p_request_id: requestId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export async function approveFamilyAdminRequest(adminPhone: string, requestId: number): Promise<void> {
  const cleaned = String(adminPhone || '').trim();
  if (!cleaned || requestId < 1) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_request_approve_v1', {
      p_phone: cleaned,
      p_request_id: requestId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export async function fetchFamilyAdminDelegates(adminPhone: string): Promise<{
  rows: FamilyAdminDelegate[];
  roles: FamilyAdminDelegateRole[];
}> {
  const cleaned = String(adminPhone || '').trim();
  if (!cleaned) return { rows: [], roles: [] };
  let row: DelegatesRpc | undefined;
  try {
    row = await callPublicRpc<DelegatesRpc>('family_admin_delegates_list_v1', { p_phone: cleaned });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
  const roles = (row?.roles || [])
    .map((item) => ({
      roleKey: String(item.role_key || '').trim(),
      titleAr: String(item.title_ar || item.role_key || '').trim(),
    }))
    .filter((item) => item.roleKey);
  const rows = (row?.rows || [])
    .map((item) => ({
      id: String(item.id || '').trim(),
      branchKey: String(item.branch_key || '').trim(),
      name: String(item.name || '').trim(),
      phone: String(item.phone || '').trim(),
      email: String(item.email || '').trim(),
      roleKey: String(item.role_key || '').trim(),
      roleTitleAr: String(item.role_title_ar || item.role_key || '').trim(),
      isEnabled: Boolean(item.is_enabled),
    }))
    .filter((item) => item.id);
  return { rows, roles };
}

export async function setFamilyAdminDelegateRole(args: {
  adminPhone: string;
  delegateId: string;
  roleKey: string;
}): Promise<void> {
  const cleaned = String(args.adminPhone || '').trim();
  const id = String(args.delegateId || '').trim();
  const role = String(args.roleKey || '').trim();
  if (!cleaned || !id || !role) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_delegates_set_role_v1', {
      p_phone: cleaned,
      p_id: id,
      p_role_key: role,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export async function setFamilyAdminDelegateEnabled(args: {
  adminPhone: string;
  delegateId: string;
  enabled: boolean;
}): Promise<void> {
  const cleaned = String(args.adminPhone || '').trim();
  const id = String(args.delegateId || '').trim();
  if (!cleaned || !id) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_delegates_set_enabled_v1', {
      p_phone: cleaned,
      p_id: id,
      p_enabled: Boolean(args.enabled),
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export async function bindFamilyAdminRequest(args: {
  adminPhone: string;
  requestId: number;
  treeChildId: number;
}): Promise<void> {
  const cleaned = String(args.adminPhone || '').trim();
  if (!cleaned || args.requestId < 1 || args.treeChildId < 1) throw new Error('bad_input');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_request_bind_v1', {
      p_phone: cleaned,
      p_request_id: args.requestId,
      p_tree_child_id: args.treeChildId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export async function fetchFamilyAdminDevices(adminPhone: string): Promise<FamilyAdminDevice[]> {
  const cleaned = String(adminPhone || '').trim();
  if (!cleaned) return [];
  let row: DevicesRpc | undefined;
  try {
    row = await callPublicRpc<DevicesRpc>('family_admin_devices_list_v1', { p_phone: cleaned });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
  return (row?.items || [])
    .map((item) => ({
      id: Number(item.id || 0),
      phoneKey: String(item.phone_key || '').trim(),
      label: String(item.label || '').trim(),
      status: String(item.status || '').trim(),
      boundAt: item.bound_at ? String(item.bound_at) : null,
      lastSeenAt: item.last_seen_at ? String(item.last_seen_at) : null,
    }))
    .filter((item) => item.phoneKey);
}

export async function unbindFamilyAdminDevice(adminPhone: string, targetPhone: string): Promise<void> {
  const cleaned = String(adminPhone || '').trim();
  const target = String(targetPhone || '').trim();
  if (!cleaned || !target) throw new Error('bad_phone');
  let row: ActionRpc | undefined;
  try {
    row = await callPublicRpc<ActionRpc>('family_admin_device_unbind_v1', {
      p_phone: cleaned,
      p_target_phone: target,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  assertOk(row);
}

export function familyAdminDelegatesSqlHint() {
  return 'تعذر فتح صلاحيات المناديب الآن. راجِع الإدارة إن استمر.';
}

export function familyAdminActionMessage(error: unknown): string {
  if (
    error instanceof FamilyAdminRpcMissingError ||
    isMissingRpcMessage(String(error instanceof Error ? error.message : error || ''))
  ) {
    return 'تعذر فتح إدارة العائلة الآن. راجِع الإدارة إن استمر.';
  }
  const code = rpcFailureCode(error);
  switch (code) {
    case 'sql_missing':
      return 'تعذر فتح إدارة العائلة الآن. راجِع الإدارة إن استمر.';
    case 'not_allowed':
      return 'هذه الجلسة ليست إدارة عائلة مفعّلة.';
    case 'device_required':
      return 'الدخول من الجهاز الموثوق لهذا الرقم مطلوب.';
    case 'phone_conflict':
      return 'هذا الجوال مربوط بشخص آخر.';
    case 'person_not_found':
    case 'not_found':
      return 'السجل غير موجود أو لم يعد معلّقًا.';
    case 'bad_phone':
    case 'bad_input':
      return 'البيانات غير مكتملة.';
    case 'wrong_kind':
      return 'هذا النوع يُعالَج من مسار مختلف.';
    case 'bind_required':
      return 'سجّل الرقم على الشخص في الشجرة ثم اعتمد الطلب.';
    case 'unknown_role':
      return 'هذا الدور غير معروف.';
    case 'missing_secret_hash':
      return 'طلب إعادة الرقم السري بلا رقم جديد.';
    case 'no_delegate_target':
      return 'لا يوجد مندوب مطابق لتحديث رقمه السري.';
    default:
      return 'تعذر إتمام العملية. أعد المحاولة.';
  }
}
