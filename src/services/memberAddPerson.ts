import { callPublicRpc, classifyPublicRpcError } from './supabase';
import {
  buildMemberOccasionRow,
  publishMemberOccasion,
} from './memberOccasions';
import { notifyFamilyEventPublished } from './eventOutboundNotify';
import { leafPersonName } from '../utils/personEncounter';
import type { TreeChild } from '../types';

export type MemberAddPersonResult = {
  ok?: boolean;
  error?: string;
  tree_child_id?: number;
  person_id?: string;
  parent_id?: number;
  existing?: boolean;
};

export function isOwnTreeNode(owner?: TreeChild | null, node?: TreeChild | null) {
  if (!owner || !node) return false;
  if (Number(owner.id) === Number(node.id)) return true;
  const ownerPath = String(owner.name || '').trim().replace(/\/+$/, '');
  const nodePath = String(node.name || '').trim().replace(/\/+$/, '');
  if (!ownerPath || !nodePath) return false;
  return nodePath === ownerPath || nodePath.startsWith(`${ownerPath}/`);
}

export function memberAddPersonMessage(error: string) {
  if (error === 'not_registered') return 'الجوال غير موثّق في العائلة.';
  if (error === 'not_placed') return 'رقمك موثّق وما انربط بشخصك في الشجرة بعد.';
  if (error === 'not_own_tree') return 'تقدر تضيف في شجرتك فقط.';
  if (error === 'not_father') return 'الإضافة تحت الأب في شجرتك، مو تحت هذا الاسم.';
  if (error === 'person_not_found') return 'تعذر إيجاد الأب في الشجرة.';
  if (error === 'name_conflict') return 'اسم الابن مسجل مسبقًا لهذا الأب.';
  if (error === 'same_as_father') return 'لا يمكن أن يكون اسم الابن مطابقًا لاسم الأب.';
  if (error === 'bad_date') return 'تاريخ الميلاد غير صحيح. الصيغة: YYYY-MM-DD';
  if (error === 'bad_order') return 'ترتيب الميلاد يجب أن يكون رقمًا صحيحًا يبدأ من 1.';
  if (error === 'not_own_child') return 'التعديل لك ولأبنائك فقط.';
  if (error === 'update_failed') return 'تعذر حفظ التعديل في الشجرة.';
  if (error === 'bad_input') return 'اكتب الاسم بكلمة واحدة.';
  if (error === 'rpc_missing' || error === 'sql_missing') {
    return 'نفّذ أمر الصيانة في الإدارة ثم أعد المحاولة.';
  }
  if (error === 'device_required') return 'اربط الجهاز من ملفي ثم أضف من شجرتك.';
  return 'تعذر إتمام الإضافة الآن.';
}

export async function addOwnTreePerson(input: {
  phone: string;
  parentId: number;
  given: string;
  gender?: 'son' | 'daughter';
  birthDate?: string;
  birthDateHijri?: string;
  birthOrder?: string;
}): Promise<MemberAddPersonResult> {
  try {
    return await callPublicRpc<MemberAddPersonResult>('member_add_person_v1', {
      p_phone: input.phone,
      p_parent_id: input.parentId,
      p_given: input.given,
      p_gender: input.gender || 'son',
      p_birth_date: input.birthDate || null,
    });
  } catch (error) {
    const kind = classifyPublicRpcError(error);
    if (kind === 'rpc_missing') return { ok: false, error: 'rpc_missing' };
    if (kind === 'device_required') return { ok: false, error: 'device_required' };
    throw error;
  }
}

export async function announceOwnTreeBirth(input: {
  phone: string;
  branchKey: string;
  childName: string;
  parentName: string;
  submitterName: string;
  birthDate?: string;
}) {
  const createdAt = new Date().toISOString();
  const requestId = `BIRTH-${Date.now().toString(36).toUpperCase()}`;
  const person = [input.childName, input.parentName].filter(Boolean).join(' بن ');
  const row = buildMemberOccasionRow({
    branch: input.branchKey,
    type: 'birth',
    person,
    dateLabel: input.birthDate || '',
    place: '',
    hospitalDept: '',
    contactPhone: '',
    prayerPlace: '',
    prayerTime: '',
    burialPlace: '',
    text: '',
    imageUrl: '',
    videoUrl: '',
    submitterName: input.submitterName,
    submitterPhone: input.phone,
    requestId,
    createdAt,
  });
  const published = await publishMemberOccasion(input.phone, row);
  if (published?.ok) {
    await notifyFamilyEventPublished({
      type: 'birth',
      person: row.person,
      branch_key: row.branch_key,
      text: '',
    });
  }
  return published;
}

export function isAccountChild(owner?: TreeChild | null, node?: TreeChild | null) {
  if (!owner || !node) return false;
  if (Number(owner.id) === Number(node.id)) return false;
  if (String(owner.branchKey || '') !== String(node.branchKey || '')) return false;
  const ownerPath = String(owner.name || '').trim().replace(/\/+$/, '');
  const parentPath = String(node.parentName || '').trim().replace(/\/+$/, '');
  return Boolean(ownerPath && parentPath && parentPath === ownerPath);
}

export async function updateOwnTreePerson(input: {
  phone: string;
  targetId: number;
  given: string;
  birthDate?: string;
  birthDateHijri?: string;
}): Promise<MemberAddPersonResult> {
  try {
    return await callPublicRpc<MemberAddPersonResult>('member_update_person_v1', {
      p_phone: input.phone,
      p_target_id: input.targetId,
      p_given: input.given,
      p_birth_date: input.birthDate == null ? null : input.birthDate,
      p_birth_date_h: input.birthDateHijri == null ? null : input.birthDateHijri,
    });
  } catch (error) {
    const kind = classifyPublicRpcError(error);
    if (kind === 'rpc_missing') return { ok: false, error: 'rpc_missing' };
    if (kind === 'device_required') return { ok: false, error: 'device_required' };
    throw error;
  }
}

export function parentDisplayName(person: TreeChild) {
  return leafPersonName(person.name);
}
