import { invokePublicEdgeFunction } from './supabase';

type AdminRequestRow = {
  request_id: string;
  kind: string;
  branch_key: string;
  status?: string;
  name?: string | null;
  phone?: string | null;
};

/** Push + email to central admin. No delegate path. Failure must not undo the saved request. */
export async function notifyAdminOfNewRequest(row: AdminRequestRow) {
  const kind = String(row.kind || '').trim();
  const branch = String(row.branch_key || '').trim();
  const requestId = String(row.request_id || '').trim();
  if (!kind || !branch || !requestId) return { ok: false as const, skipped: 'missing' };

  const record = {
    request_id: requestId,
    kind,
    branch_key: branch,
    status: String(row.status || 'pending').trim() || 'pending',
    name: String(row.name || '').trim() || null,
    person: String(row.name || '').trim() || null,
    phone: String(row.phone || '').trim() || null,
  };

  const body = { mode: 'admin_new_request', record };

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

export async function notifyWomenManagersOfRequest(row: AdminRequestRow) {
  const kind = String(row.kind || '').trim();
  const branch = String(row.branch_key || '').trim();
  const requestId = String(row.request_id || '').trim();
  if (!kind || !requestId) return { ok: false as const, skipped: 'missing' };
  if (kind !== 'member_phone_register' && kind !== 'member_registration') {
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
  };

  const body = { mode: 'women_manager_new_request', record };

  try {
    await invokePublicEdgeFunction('alzidan-push-notify', body);
  } catch {
    // Keep request; push is best-effort.
  }

  return { ok: true as const };
}

export async function notifyRequesterStatusChanged(row: AdminRequestRow & {
  status: string;
  reject_reason?: string | null;
}) {
  const kind = String(row.kind || '').trim();
  const requestId = String(row.request_id || '').trim();
  const phone = String(row.phone || '').trim();
  const status = String(row.status || '').trim().toLowerCase();
  if (!kind || !requestId || !phone) return { ok: false as const, skipped: 'missing' };
  if (status !== 'approved' && status !== 'rejected') {
    return { ok: false as const, skipped: 'status' };
  }

  const record = {
    request_id: requestId,
    kind,
    branch_key: String(row.branch_key || '').trim(),
    status,
    name: String(row.name || '').trim() || null,
    person: String(row.name || '').trim() || null,
    phone,
    reject_reason: String(row.reject_reason || '').trim() || null,
  };

  const body = { mode: 'status_changed', record };

  try {
    await invokePublicEdgeFunction('alzidan-email-notify', body);
  } catch {
    // Keep action; email is best-effort.
  }

  try {
    await invokePublicEdgeFunction('alzidan-push-notify', body);
  } catch {
    // Keep action; push is best-effort.
  }

  return { ok: true as const };
}

export async function notifyInboxShare(occasionId: number, senderPhone?: string) {
  const id = Number(occasionId || 0);
  if (!id) return { ok: false as const, skipped: 'missing' };
  try {
    await invokePublicEdgeFunction('alzidan-push-notify', {
      mode: 'inbox_share',
      occasion_id: id,
      sender_phone: String(senderPhone || '').trim() || undefined,
    });
  } catch {
    // Interaction already saved.
  }
  return { ok: true as const };
}

type FamilyEventPushRow = {
  type: string;
  person: string;
  branch_key: string;
  text?: string;
};

/** Family-wide Expo push after a published occasion. Same body as web publish. */
export async function notifyFamilyEventPublished(row: FamilyEventPushRow) {
  const type = String(row.type || '').trim();
  const person = String(row.person || '').trim();
  if (!type && !person) return { ok: false as const, skipped: 'missing' };

  try {
    await invokePublicEdgeFunction('alzidan-push-notify', {
      type,
      person,
      branch_key: String(row.branch_key || '').trim(),
      details: String(row.text || '').trim().slice(0, 180),
    });
  } catch {
    // Publish already saved; push is best-effort.
  }

  return { ok: true as const };
}
