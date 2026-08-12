import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MemberRequest } from '../types';
import { callPublicRpc } from './supabase';

const TRACK_KEY = 'alzidan_rx_my_requests_v1';
const MAX_ENTRIES = 20;

export type TrackedRequest = {
  requestId: string;
  kind: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  person?: string;
};

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function trackIdKey(value: string) {
  return text(value).toUpperCase();
}

export async function readTrackedRequests(): Promise<TrackedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(TRACK_KEY);
    const list = raw ? (JSON.parse(raw) as TrackedRequest[]) : [];
    return Array.isArray(list) ? list.filter((row) => text(row?.requestId)) : [];
  } catch {
    return [];
  }
}

async function writeTrackedRequests(list: TrackedRequest[]) {
  await AsyncStorage.setItem(TRACK_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
}

export async function appendTrackedRequest(entry: TrackedRequest) {
  const requestId = text(entry.requestId);
  if (!requestId) return;
  const current = await readTrackedRequests();
  const next = [
    { ...entry, requestId, status: text(entry.status) || 'pending', createdAt: text(entry.createdAt) || new Date().toISOString() },
    ...current.filter((row) => trackIdKey(row.requestId) !== trackIdKey(requestId)),
  ];
  await writeTrackedRequests(next);
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
  const cleaned = text(phone).replace(/[^\d]/g, '');
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
    });
  });
  return Array.from(byId.values())
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .slice(0, MAX_ENTRIES);
}

export async function loadMyRequests(phone?: string): Promise<MemberRequest[]> {
  const local = await syncLocalStatuses(await readTrackedRequests());
  const remote = phone ? await fetchRequestsByPhone(phone) : [];
  const merged = mergeTracked(local, remote);
  await writeTrackedRequests(merged);
  return merged.map(trackedToMemberRequest);
}

export async function syncTrackedRequestStatuses(): Promise<MemberRequest[]> {
  return loadMyRequests();
}
