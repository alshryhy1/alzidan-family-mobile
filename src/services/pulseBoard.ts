import { callPublicRpc } from './supabase';
import type { PulseBoardNotice } from '../utils/pulseNotices';
import { pulseNasabFromPath, pulseNameBlockedFromTicker } from '../utils/pulseNotices';

type BoardRow = {
  kind?: string;
  name?: string;
  branch_key?: string;
  at?: string;
};

type BoardPayload = {
  ok?: boolean;
  notices?: BoardRow[];
  delegates?: BoardRow[];
};

function asRows(value: unknown): BoardRow[] {
  if (Array.isArray(value)) return value as BoardRow[];
  return [];
}

function cleanName(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return pulseNasabFromPath(raw) || raw;
}

export async function loadPulseFamilyBoard(): Promise<{
  notices: PulseBoardNotice[];
  delegates: PulseBoardNotice[];
}> {
  try {
    const data = await callPublicRpc<BoardPayload | BoardPayload[]>('pulse_family_board_v1', {});
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.ok === false) return { notices: [], delegates: [] };
    const notices = asRows(row.notices)
      .map((item) => {
        const kind = item.kind === 'phone' || item.kind === 'son' || item.kind === 'rename' ? item.kind : null;
        const name = cleanName(item.name);
        if (!kind || !name || pulseNameBlockedFromTicker(name)) return null;
        return { kind, name, at: item.at } as PulseBoardNotice;
      })
      .filter((item): item is PulseBoardNotice => Boolean(item));
    const delegates = asRows(row.delegates)
      .map((item) => {
        const name = cleanName(item.name);
        const branchKey = String(item.branch_key || '').trim();
        const at = String(item.at || '').trim();
        if (!name || pulseNameBlockedFromTicker(name) || !at) return null;
        return { kind: 'delegate' as const, name, branchKey, at };
      })
      .filter((item): item is PulseBoardNotice => Boolean(item));
    return { notices, delegates };
  } catch (error) {
    if (__DEV__) {
      console.warn('[pulse] family board', error instanceof Error ? error.message : error);
    }
    return { notices: [], delegates: [] };
  }
}
