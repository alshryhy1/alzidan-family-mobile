import { invokePublicEdgeFunction } from './supabase';

const ADMIN_ONLY_KINDS = new Set([
  'special_card',
  'tree_delegate',
  'events_delegate',
  'org_role',
  'delegate_secret_reset',
]);

export type BranchRequestNotifyRow = {
  request_id: string;
  kind: string;
  branch_key: string;
  status?: string;
  name?: string | null;
  phone?: string | null;
};

/**
 * Same path as web: email + push to branch delegates.
 * Any branch request except البطاقة / طلبات المندوبية. Notify failure must not undo a saved request.
 */
export async function notifyBranchDelegatesOfRequest(row: BranchRequestNotifyRow) {
  const kind = String(row.kind || '').trim();
  const branch = String(row.branch_key || '').trim();
  const requestId = String(row.request_id || '').trim();
  if (!kind || !branch || !requestId) return { ok: false as const, skipped: 'missing' };
  if (ADMIN_ONLY_KINDS.has(kind) || /_audit$|^eva-|^aud-/i.test(kind)) {
    return { ok: false as const, skipped: 'kind' };
  }

  const record = {
    request_id: requestId,
    kind,
    branch_key: branch,
    status: String(row.status || 'pending').trim() || 'pending',
    name: String(row.name || '').trim() || null,
    person: String(row.name || '').trim() || null,
    phone: String(row.phone || '').trim() || null,
    email: null,
  };

  const body = { mode: 'branch_delegate_new_request', record };

  try {
    await invokePublicEdgeFunction('alzidan-push-notify', body);
  } catch {
    // Keep request; app push is best-effort.
  }

  try {
    await invokePublicEdgeFunction('alzidan-email-notify', body);
  } catch {
    // Keep request; email is extra.
  }

  return { ok: true as const };
}
