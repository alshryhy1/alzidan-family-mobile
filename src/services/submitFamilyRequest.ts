import { notifyAdminOfNewRequest, notifyWomenManagersOfRequest } from './eventOutboundNotify';
import { notifyBranchDelegatesOfRequest } from './notifyBranchDelegates';
import { insertPublicRow } from './supabase';

export type FamilyRequestSubmit = {
  requestId: string;
  kind: string;
  branchKey: string;
  name: string;
  phone: string;
  email?: string | null;
  message: string;
  createdAt?: string;
};

/** Insert the request then notify branch delegates (and admin). Notify failure does not undo the save. */
export async function submitFamilyRequest(row: FamilyRequestSubmit) {
  const requestId = String(row.requestId || '').trim();
  const kind = String(row.kind || '').trim();
  const branchKey = String(row.branchKey || '').trim();
  const name = String(row.name || '').trim();
  const phone = String(row.phone || '').trim();
  const createdAt = row.createdAt || new Date().toISOString();
  if (!requestId || !kind || !branchKey) {
    throw new Error('تعذر حفظ الطلب. أكمل الفرع والنوع.');
  }

  await insertPublicRow('approval_requests', {
    request_id: requestId,
    kind,
    branch_key: branchKey,
    name: name || null,
    phone: phone || null,
    email: row.email ? String(row.email).trim() : null,
    message: String(row.message || ''),
    status: 'pending',
    created_at: createdAt,
  });

  const notify = {
    request_id: requestId,
    kind,
    branch_key: branchKey,
    status: 'pending' as const,
    name: name || null,
    phone: phone || null,
  };
  await notifyBranchDelegatesOfRequest(notify);
  await notifyAdminOfNewRequest(notify);
  await notifyWomenManagersOfRequest(notify);
  return { requestId, createdAt };
}
