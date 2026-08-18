import { invokePublicEdgeFunction } from './supabase';

const DELEGATE_NOTIFY_KINDS = new Set([
  'event_card',
  'family_event',
  'event_request',
  'occasion',
  'patient',
  'health',
  'event_death',
  'tree_card',
  'add_person',
  'tree_edit',
  'memory_card',
  'memory',
  'tree_founder',
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
 * Never forwards the request message. Notify failure must not undo a saved request.
 */
export async function notifyBranchDelegatesOfRequest(row: BranchRequestNotifyRow) {
  const kind = String(row.kind || '').trim();
  const branch = String(row.branch_key || '').trim();
  const requestId = String(row.request_id || '').trim();
  if (!kind || !branch || !requestId) return { ok: false as const, skipped: 'missing' };
  if (!DELEGATE_NOTIFY_KINDS.has(kind)) return { ok: false as const, skipped: 'kind' };

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
    await invokePublicEdgeFunction('alzidan-email-notify', body);
  } catch {
    // Keep request; email is best-effort.
  }

  try {
    await invokePublicEdgeFunction('alzidan-push-notify', body);
  } catch {
    // Keep request; push is best-effort.
  }

  return { ok: true as const };
}