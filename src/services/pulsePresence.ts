import AsyncStorage from '@react-native-async-storage/async-storage';

import { callPublicRpc } from './supabase';

const SESSION_KEY = 'alzidan_pulse_session_v1';

function newSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === 'x' ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getPulseSessionId(): Promise<string> {
  try {
    const existing = String((await AsyncStorage.getItem(SESSION_KEY)) || '').trim();
    if (existing) return existing;
    const next = newSessionId();
    await AsyncStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return newSessionId();
  }
}

function readOnline(data: unknown): number | null {
  let row: unknown = data;
  if (typeof row === 'string') {
    try {
      row = JSON.parse(row);
    } catch {
      const n = Number(row);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
    }
  }
  if (Array.isArray(row)) row = row[0];
  if (typeof row === 'number' && Number.isFinite(row)) return Math.max(0, Math.round(row));
  if (!row || typeof row !== 'object') return null;
  const rec = row as { ok?: boolean; online?: unknown };
  if (rec.ok === false) return null;
  const nested = rec.online;
  if (typeof nested === 'string') {
    try {
      const parsed = JSON.parse(nested) as unknown;
      return readOnline(parsed);
    } catch {
      const n = Number(nested);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
    }
  }
  const n = Number(nested);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

/** Count from the server. Null if the heartbeat RPC is not live yet. */
export async function pulseHeartbeat(sessionId: string): Promise<number | null> {
  try {
    const data = await callPublicRpc<unknown>('pulse_heartbeat_v1', {
      p_session_id: sessionId,
    });
    return readOnline(data);
  } catch (error) {
    if (__DEV__) {
      console.warn('[pulse] heartbeat', error instanceof Error ? error.message : error);
    }
    return null;
  }
}
