import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MemberRequest } from '../types';
import { canonicalizePhone, e164Digits } from '../utils/phone';
import { callPublicRpc } from './supabase';

const TRACK_KEY_PREFIX = 'alzidan_rx_my_requests_v1';
const LEGACY_TRACK_KEY = 'alzidan_rx_my_requests_v1';
const MAX_ENTRIES = 20;

export type TrackedRequest = {
  requestId: string;
  kind: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  person?: string;
  phone?: string;
};

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanPhone(value: unknown) {
  const raw = text(value);
  const e164 = canonicalizePhone(raw);
  return e164Digits(e164 || raw);
}

function trackIdKey(value: string) {
  return text(value).toUpperCase();
}

function trackKeyForPhone(phone?: string) {
  const cleaned = cleanPhone(phone || '');
  return cleaned.length >= 9 ? `${TRACK_KEY_PREFIX}:${cleaned}` : LEGACY_TRACK_KEY;
}

export async function readTrackedRequests(phone?: string): Promise<TrackedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(trackKeyForPhone(phone));
    const list = raw ? (JSON.parse(raw) as TrackedRequest[]) : [];
    return Array.isArray(list) ? list.filter((row) => text(row?.requestId)) : [];
  } catch {
    return [];
  }
}

async function writeTrackedRequests(list: TrackedRequest[], phone?: string) {
  await AsyncStorage.setItem(trackKeyForPhone(phone), JSON.stringify(list.slice(0, MAX_ENTRIES)));
}

export async function appendTrackedRequest(entry: TrackedRequest) {
  const requestId = text(entry.requestId);
  if (!requestId) return;
  const phone = cleanPhone(entry.phone || '');
  const current = await readTrackedRequests(phone);
  const next = [
    {
      ...entry,
      requestId,
      phone: phone || undefined,
      status: text(entry.status) || 'pending',
      createdAt: text(entry.createdAt) || new Date().toISOString(),
    },
    ...current.filter((row) => trackIdKey(row.requestId) !== trackIdKey(requestId)),
  ];
  await writeTrackedRequests(next, phone);
}

function normalizeStatus(status: string) {
  const value = text(status).toLowerCase();
  if (value === 'submitted' || value === 'in_review' || value === 'assigned') return 'pending';
  if (value === 'accepted' || value === 'applied' || value === 'done') return 'approved';
  if (value === 'denied') return 'rejected';
  return value || 'pending';
}

export function trackedToMemberRequest(row: TrackedRequest): MemberRequest {
  return {
    id: row.requestId,
    requestId: row.requestId,
    kind: row.kind,
    status: normalizeStatus(row.status),
    createdAt: row.createdAt,
    rejectionReason: text(row.rejectionReason) || undefined,
  };
}

type LiveStatusRow = {
  request_id?: string;
  status?: string;
  reject_reason?: string;
};

type PhoneRequestRow = {
  request_id?: string;
  kind?: string;
  status?: string;
  created_at?: string;
  reject_reason?: string;
};

async function syncLocalStatuses(local: TrackedRequest[]): Promise<TrackedRequest[]> {
  if (!local.length) return [];
  try {
    const ids = local.map((row) => row.requestId);
    const live = await callPublicRpc<LiveStatusRow[]>('public_my_request_statuses_v1', { p_ids: ids });
    const rows = Array.isArray(live) ? live : [];
    const byId = new Map<string, LiveStatusRow>();
    rows.forEach((row) => {
      const id = trackIdKey(row.request_id || '');
      if (id) byId.set(id, row);
    });

    const next: TrackedRequest[] = [];
    local.forEach((row) => {
      const liveRow = byId.get(trackIdKey(row.requestId));
      if (!liveRow) return;
      next.push({
        ...row,
        status: normalizeStatus(String(liveRow.status || row.status)),
        rejectionReason: text(liveRow.reject_reason) || row.rejectionReason,
      });
    });
    return next;
  } catch {
    return local;
  }
}

async function fetchRequestsByPhone(phone: string): Promise<TrackedRequest[]> {
  const cleaned = cleanPhone(phone);
  if (cleaned.length < 9) return [];
  try {
    const live = await callPublicRpc<PhoneRequestRow[]>('public_my_requests_by_phone_v1', {
      p_phone: cleaned,
    });
    const rows = Array.isArray(live) ? live : [];
    return rows
      .map((row) => ({
        requestId: text(row.request_id),
        kind: text(row.kind) || 'event_card',
        status: normalizeStatus(String(row.status || 'pending')),
        createdAt: text(row.created_at) || new Date().toISOString(),
        rejectionReason: text(row.reject_reason) || undefined,
        phone: cleaned,
      }))
      .filter((row) => row.requestId);
  } catch {
    return [];
  }
}

function mergeTracked(local: TrackedRequest[], remote: TrackedRequest[]) {
  const byId = new Map<string, TrackedRequest>();
  [...remote, ...local].forEach((row) => {
    const key = trackIdKey(row.requestId);
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, row);
      return;
    }
    byId.set(key, {
      ...prev,
      ...row,
      status: row.status || prev.status,
      rejectionReason: row.rejectionReason || prev.rejectionReason,
      createdAt: row.createdAt || prev.createdAt,
      phone: row.phone || prev.phone,
    });
  });
  return Array.from(byId.values())
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .slice(0, MAX_ENTRIES);
}

/**
 * When a member phone is known, remote phone query is source of truth.
 * Local device cache is only merged for that same phone — never mix another member's submissions.
 */
export async function loadMyRequests(phone?: string): Promise<MemberRequest[]> {
  const cleaned = cleanPhone(phone || '');
  if (cleaned.length >= 9) {
    const remote = await fetchRequestsByPhone(cleaned);
    const local = await syncLocalStatuses(await readTrackedRequests(cleaned));
    const localSamePhone = local.filter((row) => {
      const rowPhone = cleanPhone(row.phone || '');
      return !rowPhone || rowPhone === cleaned;
    });
    const merged = mergeTracked(localSamePhone, remote);
    await writeTrackedRequests(merged, cleaned);
    return merged.map(trackedToMemberRequest);
  }

  const local = await syncLocalStatuses(await readTrackedRequests());
  await writeTrackedRequests(local);
  return local.map(trackedToMemberRequest);
}

export async function clearTrackedRequests(phone?: string) {
  const cleaned = cleanPhone(phone || '');
  if (cleaned.length >= 9) {
    await AsyncStorage.removeItem(trackKeyForPhone(cleaned));
    return;
  }
  await AsyncStorage.removeItem(LEGACY_TRACK_KEY);
}

export async function syncTrackedRequestStatuses(): Promise<MemberRequest[]> {
  return loadMyRequests();
}
