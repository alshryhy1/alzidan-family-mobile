import { callPublicRpc } from './supabase';

export type WomenManagerSession = {
  enabled: boolean;
  treeChildId: number | null;
  personId: string | null;
};

export type WomenPhoneRequest = {
  id: number;
  requestId: string;
  name: string;
  phone: string;
  branchKey: string;
  createdAt: string | null;
};

export type WomenMemberMatch = {
  id: number;
  memberId: number | null;
  kind: 'tree' | 'pending';
  personId: string | null;
  branchKey: string;
  displayName: string;
  path: string | null;
  phone: string | null;
  status: string | null;
};

export type WomenAddMemberResult = {
  action: 'created_pending' | 'existing_pending' | 'existing_tree' | 'placed';
  memberId: number | null;
  treeChildId: number | null;
  kind: 'pending' | 'tree';
};

export type WomenTreePerson = {
  id: number;
  personId: string | null;
  branchKey: string;
  displayName: string;
  path: string | null;
};

export type WomenMotherChild = WomenTreePerson & {
  spouseId: number | null;
};

export type WomenMotherOverview = {
  motherId: number;
  spouses: number;
  noSpouse: boolean;
  children: WomenMotherChild[];
};

export class WomenManagerRpcMissingError extends Error {
  constructor() {
    super('sql_missing');
    this.name = 'WomenManagerRpcMissingError';
  }
}

type SessionRpc = {
  ok?: boolean;
  enabled?: boolean;
  tree_child_id?: number | null;
  person_id?: string | null;
};

type ListRpc = {
  ok?: boolean;
  error?: string;
  rows?: Array<{
    id?: number;
    request_id?: string | null;
    name?: string | null;
    phone?: string | null;
    branch_key?: string | null;
    created_at?: string | null;
  }>;
};

type SearchRpc = {
  ok?: boolean;
  error?: string;
  need_query?: boolean;
  rows?: Array<{
    id?: number;
    member_id?: number | null;
    kind?: string | null;
    person_id?: string | null;
    branch_key?: string | null;
    display_name?: string | null;
    path?: string | null;
    phone?: string | null;
    status?: string | null;
  }>;
};

type AddMemberRpc = {
  ok?: boolean;
  error?: string;
  action?: string;
  member_id?: number | null;
  tree_child_id?: number | null;
  kind?: string | null;
  detail?: string | null;
  sqlstate?: string | null;
};

type BindRpc = {
  ok?: boolean;
  error?: string;
};

function isMissingRpcMessage(message: string) {
  return /PGRST202|Could not find the function|sql_missing/i.test(message);
}

function rpcFailureCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const text = raw.trim();
  let parsedCode = '';
  let parsedMessage = '';
  try {
    const parsed = JSON.parse(text) as { code?: string; message?: string; error?: string; details?: string };
    if (parsed && typeof parsed === 'object') {
      parsedCode = String(parsed.error || parsed.code || '');
      parsedMessage = String(parsed.message || parsed.details || '');
    }
  } catch {
    parsedMessage = text;
  }
  const hay = `${parsedCode} ${parsedMessage} ${text}`;
  if (/57014|statement timeout|canceling statement due to statement timeout/i.test(hay)) {
    return 'timeout';
  }
  if (/23502|23505|23514|42501|42703|bind_failed|save_failed|null value in column|duplicate key/i.test(hay)) {
    return 'save_failed';
  }
  if (parsedCode && /^[a-z_]+$/.test(parsedCode)) return parsedCode;
  if (/^[a-z_]+$/.test(text)) return text;
  return text;
}

function throwIfMissingRpc(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error || '');
  if (isMissingRpcMessage(message)) throw new WomenManagerRpcMissingError();
  throw error instanceof Error ? error : new Error(message || 'تعذر الاتصال.');
}

export async function fetchWomenManagerSession(phone: string): Promise<WomenManagerSession> {
  const cleaned = String(phone || '').trim();
  if (!cleaned) return { enabled: false, treeChildId: null, personId: null };
  try {
    const row = await callPublicRpc<SessionRpc>('women_manager_session_v1', { p_phone: cleaned });
    return {
      enabled: Boolean(row && row.ok !== false && row.enabled),
      treeChildId: row?.tree_child_id != null ? Number(row.tree_child_id) : null,
      personId: row?.person_id ? String(row.person_id) : null,
    };
  } catch {
    return { enabled: false, treeChildId: null, personId: null };
  }
}

export async function fetchWomenPhoneRequests(managerPhone: string): Promise<WomenPhoneRequest[]> {
  const cleaned = String(managerPhone || '').trim();
  if (!cleaned) return [];
  let row: ListRpc | undefined;
  try {
    row = await callPublicRpc<ListRpc>('women_manager_phone_requests_v1', { p_phone: cleaned });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row?.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row && row.ok === false) {
    const err = new Error(row.error || 'not_allowed');
    throw err;
  }
  return (row?.rows || [])
    .map((item) => ({
      id: Number(item.id),
      requestId: String(item.request_id || ''),
      name: String(item.name || '').trim(),
      phone: String(item.phone || '').trim(),
      branchKey: String(item.branch_key || '').trim(),
      createdAt: item.created_at ? String(item.created_at) : null,
    }))
    .filter((item) => item.id > 0 && item.phone);
}

export async function searchWomenMembers(
  managerPhone: string,
  query: string,
  branchKey?: string | null,
): Promise<WomenMemberMatch[]> {
  const cleaned = String(managerPhone || '').trim();
  const q = String(query || '').trim();
  if (!cleaned || q.length < 2) return [];
  let row: SearchRpc | undefined;
  try {
    row = await callPublicRpc<SearchRpc>('women_manager_search_members_v1', {
      p_phone: cleaned,
      p_query: q,
      p_branch_key: branchKey ? String(branchKey).trim() : null,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row?.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row && row.ok === false) {
    throw new Error(row.error || 'not_allowed');
  }
  return (row?.rows || [])
    .map((item) => {
      const kind = String(item.kind || '').trim() === 'pending' ? 'pending' : 'tree';
      const memberId = item.member_id != null ? Number(item.member_id) : 0;
      const treeId = Number(item.id || 0);
      return {
        id: kind === 'pending' ? 0 : treeId,
        memberId: memberId > 0 ? memberId : null,
        kind,
        personId: item.person_id ? String(item.person_id) : null,
        branchKey: String(item.branch_key || '').trim(),
        displayName: String(item.display_name || '').trim(),
        path: item.path ? String(item.path).trim() : null,
        phone: item.phone ? String(item.phone).trim() : null,
        status: item.status ? String(item.status).trim() : null,
      } satisfies WomenMemberMatch;
    })
    .filter((item) => {
      if (!item.displayName) return false;
      if (item.kind === 'pending') return Number(item.memberId || 0) > 0;
      return item.id > 0;
    });
}

export async function addWomenMember(input: {
  managerPhone: string;
  fullName: string;
  memberPhone?: string | null;
}): Promise<WomenAddMemberResult> {
  const phone = String(input.managerPhone || '').trim();
  const fullName = String(input.fullName || '').trim();
  const memberPhone = String(input.memberPhone || '').trim();
  if (!phone || fullName.length < 2) {
    throw new Error('bad_name');
  }
  let row: AddMemberRpc | undefined;
  try {
    row = await callPublicRpc<AddMemberRpc>('women_manager_add_member_v1', {
      p_phone: phone,
      p_full_name: fullName,
      p_member_phone: memberPhone || null,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row.ok === false) {
    throw new Error(
      JSON.stringify({
        error: row.error || 'save_failed',
        message: row.detail || '',
        code: row.sqlstate || '',
      }),
    );
  }
  const action = String(row.action || '');
  if (action !== 'created_pending' && action !== 'existing_pending' && action !== 'existing_tree' && action !== 'placed') {
    throw new Error(row.error || 'save_failed');
  }
  return {
    action,
    memberId: row.member_id != null ? Number(row.member_id) : null,
    treeChildId: row.tree_child_id != null ? Number(row.tree_child_id) : null,
    kind: action === 'existing_tree' || action === 'placed' ? 'tree' : 'pending',
  };
}

export async function bindWomenPhoneRequest(input: {
  managerPhone: string;
  requestId: number;
  treeChildId: number;
}): Promise<void> {
  const phone = String(input.managerPhone || '').trim();
  if (!phone || input.requestId < 1 || input.treeChildId < 1) {
    throw new Error('bad_input');
  }
  let row: BindRpc | undefined;
  try {
    row = await callPublicRpc<BindRpc>('women_manager_bind_phone_v1', {
      p_phone: phone,
      p_request_id: input.requestId,
      p_tree_child_id: input.treeChildId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row?.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (!row || row.ok === false) {
    throw new Error(row?.error || 'bind_failed');
  }
}

export async function setWomenMemberPhone(input: {
  managerPhone: string;
  treeChildId: number;
  memberPhone: string;
}): Promise<void> {
  const phone = String(input.managerPhone || '').trim();
  const memberPhone = String(input.memberPhone || '').trim();
  if (!phone || input.treeChildId < 1 || !memberPhone) {
    throw new Error('bad_input');
  }
  let row: BindRpc | undefined;
  try {
    row = await callPublicRpc<BindRpc>('women_manager_set_member_phone_v1', {
      p_phone: phone,
      p_tree_child_id: input.treeChildId,
      p_member_phone: memberPhone,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row.ok === false) {
    throw new Error(row.error || 'bind_failed');
  }
}

export async function setWomenPendingPhone(input: {
  managerPhone: string;
  memberId: number;
  memberPhone: string;
}): Promise<void> {
  const phone = String(input.managerPhone || '').trim();
  const memberPhone = String(input.memberPhone || '').trim();
  if (!phone || input.memberId < 1 || !memberPhone) {
    throw new Error('bad_input');
  }
  let row: BindRpc | undefined;
  try {
    row = await callPublicRpc<BindRpc>('women_manager_set_pending_phone_v1', {
      p_phone: phone,
      p_member_id: input.memberId,
      p_member_phone: memberPhone,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row.ok === false) {
    throw new Error(row.error || 'bind_failed');
  }
}

type TreePeopleRpc = {
  ok?: boolean;
  error?: string;
  need_query?: boolean;
  rows?: Array<{
    id?: number;
    person_id?: string | null;
    branch_key?: string | null;
    display_name?: string | null;
    path?: string | null;
    spouse_id?: number | null;
  }>;
};

type MotherChildrenRpc = {
  ok?: boolean;
  error?: string;
  mother_id?: number;
  spouses?: number;
  no_spouse?: boolean;
  rows?: TreePeopleRpc['rows'];
};

function mapTreePerson(item: NonNullable<TreePeopleRpc['rows']>[number]): WomenTreePerson {
  return {
    id: Number(item.id || 0),
    personId: item.person_id ? String(item.person_id) : null,
    branchKey: String(item.branch_key || '').trim(),
    displayName: String(item.display_name || '').trim(),
    path: item.path ? String(item.path).trim() : null,
  };
}

export async function fetchWomenMotherChildren(
  managerPhone: string,
  motherTreeChildId: number,
): Promise<WomenMotherOverview> {
  const phone = String(managerPhone || '').trim();
  if (!phone || motherTreeChildId < 1) throw new Error('bad_input');
  let row: MotherChildrenRpc | undefined;
  try {
    row = await callPublicRpc<MotherChildrenRpc>('women_manager_mother_children_v1', {
      p_phone: phone,
      p_mother_tree_child_id: motherTreeChildId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row.ok === false) throw new Error(row.error || 'not_allowed');
  return {
    motherId: Number(row.mother_id || motherTreeChildId),
    spouses: Number(row.spouses || 0),
    noSpouse: Boolean(row.no_spouse),
    children: (row.rows || [])
      .map((item) => ({
        ...mapTreePerson(item),
        spouseId: item.spouse_id != null ? Number(item.spouse_id) : null,
      }))
      .filter((item) => item.id > 0 && item.displayName),
  };
}

export async function searchWomenTreePeople(
  managerPhone: string,
  query: string,
): Promise<WomenTreePerson[]> {
  const phone = String(managerPhone || '').trim();
  const q = String(query || '').trim();
  if (!phone || q.length < 2) return [];
  let row: TreePeopleRpc | undefined;
  try {
    row = await callPublicRpc<TreePeopleRpc>('women_manager_search_tree_people_v1', {
      p_phone: phone,
      p_query: q,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row.ok === false) throw new Error(row.error || 'not_allowed');
  return (row.rows || []).map(mapTreePerson).filter((item) => item.id > 0 && item.displayName);
}

export async function linkWomenMotherChild(input: {
  managerPhone: string;
  motherTreeChildId: number;
  childTreeChildId: number;
}): Promise<void> {
  const phone = String(input.managerPhone || '').trim();
  if (!phone || input.motherTreeChildId < 1 || input.childTreeChildId < 1) {
    throw new Error('bad_input');
  }
  let row: BindRpc | undefined;
  try {
    row = await callPublicRpc<BindRpc>('women_manager_link_mother_v1', {
      p_phone: phone,
      p_mother_tree_child_id: input.motherTreeChildId,
      p_child_tree_child_id: input.childTreeChildId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row.ok === false) throw new Error(row.error || 'bind_failed');
}

export async function unlinkWomenMotherChild(input: {
  managerPhone: string;
  motherTreeChildId: number;
  childTreeChildId: number;
}): Promise<void> {
  const phone = String(input.managerPhone || '').trim();
  if (!phone || input.motherTreeChildId < 1 || input.childTreeChildId < 1) {
    throw new Error('bad_input');
  }
  let row: BindRpc | undefined;
  try {
    row = await callPublicRpc<BindRpc>('women_manager_unlink_mother_v1', {
      p_phone: phone,
      p_mother_tree_child_id: input.motherTreeChildId,
      p_child_tree_child_id: input.childTreeChildId,
    });
  } catch (error) {
    throwIfMissingRpc(error);
  }
  if (!row) throw new WomenManagerRpcMissingError();
  if (row.error === 'sql_missing') throw new WomenManagerRpcMissingError();
  if (row.ok === false) throw new Error(row.error || 'bind_failed');
}

export function womenManagerActionMessage(
  error: unknown,
  slice: 'requests' | 'members' | 'mothers' = 'requests',
): string {
  if (error instanceof WomenManagerRpcMissingError || isMissingRpcMessage(String(error instanceof Error ? error.message : error || ''))) {
    return 'لم يُجهَّز هذا القسم بعد. راجعي الإدارة إن استمر.';
  }
  const code = rpcFailureCode(error);
  switch (code) {
    case 'sql_missing':
      return 'لم يُجهَّز هذا القسم بعد. راجعي الإدارة إن استمر.';
    case 'not_allowed':
      return 'هذه الجلسة ليست مسؤولة نسائية مفعّلة.';
    case 'phone_conflict':
      return 'هذا الجوال مربوط بعضوة أخرى. اختاري الشخص المطابق أو راجعي الإدارة الأصلية.';
    case 'not_daughter':
      return slice === 'mothers'
        ? 'الأم هنا عضوة أنثى في الشجرة فقط.'
        : 'الربط هنا للعضوات فقط، وليس للرجال.';
    case 'not_pending':
      return slice === 'members'
        ? 'هذه ليست عضوة بانتظار التثبيت العائلي.'
        : 'هذا الطلب لم يعد معلّقاً.';
    case 'request_not_found':
      return 'الطلب غير موجود.';
    case 'person_not_found':
      return slice === 'mothers' ? 'الأم غير موجودة في الشجرة.' : 'العضوة غير موجودة في الشجرة.';
    case 'child_not_found':
      return 'هذا الابن غير موجود في الشجرة. لا يُنشأ شخص جديد من هنا.';
    case 'no_spouse':
      return 'لا توجد زوجية مسجّلة لهذه الأم مع والد هذا الابن. سجّلي الزواج من الإدارة الأصلية أولًا، ثم اربطي الأمومة هنا.';
    case 'already_linked':
      return 'هذا الابن مربوط بأم أخرى. فك الربط السابق من الإدارة الأصلية إن لزم.';
    case 'not_linked':
      return 'هذا الابن غير مربوط بهذه الأم.';
    case 'self_link':
      return 'لا يمكن ربط الشخص بنفسه.';
    case 'not_phone_request':
      return 'هذا ليس طلب ربط جوال.';
    case 'bad_name':
      return 'اكتبي الاسم الكامل كما هو، حرفين على الأقل، دون تقسيم بن أو أب.';
    case 'ambiguous_name':
      return 'يوجد أكثر من تطابق بنفس الاسم في الشجرة. ابحثي عن العضوة هناك أو راجعي الإدارة الأصلية.';
    case 'timeout':
      return 'العملية أخذت وقتًا أطول من المتوقع. راجعي الإدارة ثم أضيفي الاسم من زر إضافة.';
    case 'save_failed':
    case 'profile_insert_failed': {
      const raw = error instanceof Error ? error.message : String(error || '');
      if (/23505|duplicate key|unique/i.test(raw)) {
        return 'هذا الاسم أو الجوال محفوظ مسبقًا. ابحثي عنه في البحث بدل إضافة جديدة.';
      }
      return 'تعذر حفظ العضوة. راجعي الإدارة ثم أضيفي الاسم من زر إضافة.';
    }
    case 'bad_phone':
    case 'bad_input':
      return slice === 'members' ? 'رقم الجوال غير مكتمل.' : 'بيانات الطلب غير مكتملة.';
    default:
      return slice === 'members'
        ? 'تعذر حفظ العضوة. راجعي الإدارة ثم أضيفي الاسم من زر إضافة.'
        : 'تعذر إتمام العملية. أعيدي المحاولة.';
  }
}
