import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

import { MEMBER_PHONE_KEY } from '../theme';
import { canonicalizePhone } from '../utils/phone';
import { callPublicRpc, classifyPublicRpcError, setRpcHeaderProvider } from './supabase';
import { ensureLocalUnlock, isDeviceLockEnabled } from './deviceLock';

const DEVICE_ID_KEY = 'alzidan_device_public_id_v1';
const DEVICE_SECRET_KEY = 'alzidan_device_secret_v1';
const DEVICE_PHONE_KEY = 'alzidan_device_bound_phone_v1';
const DEVICE_LOCKED_PHONE_KEY = 'alzidan_device_locked_phone_v1';

const secureOpts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export type DeviceSession = {
  phone: string;
  displayName: string | null;
  treeChildId: number | null;
  personId: string | null;
  branchKey: string | null;
  role: 'member' | 'delegate' | 'both';
  memberId: number | null;
  isDelegate: boolean;
  isMember: boolean;
};

type SessionRpc = {
  ok?: boolean;
  error?: string;
  need?: string;
  phone?: string;
  display_name?: string | null;
  tree_child_id?: number | null;
  person_id?: string | null;
  branch_key?: string | null;
  role?: 'member' | 'delegate' | 'both' | 'none';
  member_id?: number | null;
  is_delegate?: boolean;
  is_member?: boolean;
};

let cachedSession: DeviceSession | null = null;
const listeners = new Set<(session: DeviceSession | null) => void>();

function randomHex(bytes: number) {
  const buf = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < bytes; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function newDevicePublicId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const hex = randomHex(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function deviceLabel() {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').trim() || 'iPhone';
}

function notify(session: DeviceSession | null) {
  cachedSession = session;
  listeners.forEach((cb) => cb(session));
}

export function getCachedDeviceSession() {
  return cachedSession;
}

export function subscribeDeviceSession(cb: (session: DeviceSession | null) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function readSecret() {
  return String((await SecureStore.getItemAsync(DEVICE_SECRET_KEY, secureOpts)) || '').trim();
}

async function readDeviceId() {
  return String((await SecureStore.getItemAsync(DEVICE_ID_KEY, secureOpts)) || '').trim();
}

async function readBoundPhone() {
  return canonicalizePhone(String((await SecureStore.getItemAsync(DEVICE_PHONE_KEY, secureOpts)) || '').trim());
}

async function readLockedPhone() {
  return canonicalizePhone(
    String((await SecureStore.getItemAsync(DEVICE_LOCKED_PHONE_KEY, secureOpts)) || '').trim(),
  );
}

setRpcHeaderProvider(async () => {
  const secret = await readSecret();
  const phone = await readBoundPhone();
  const headers: Record<string, string> = {};
  if (secret) headers['X-Device-Secret'] = secret;
  if (phone) headers['X-Member-Phone'] = phone;
  return headers;
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim(),
  );
}

export async function ensureLocalDevice() {
  let id = await readDeviceId();
  let secret = await readSecret();
  if (!isUuid(id)) {
    id = newDevicePublicId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id, secureOpts);
  }
  if (!secret || secret.length < 64) {
    secret = randomHex(32);
    await SecureStore.setItemAsync(DEVICE_SECRET_KEY, secret, secureOpts);
  }
  return { id, secret, label: deviceLabel() };
}

function sessionFromRpc(row: SessionRpc, fallbackPhone: string): DeviceSession | null {
  if (!row?.ok) return null;
  const phone = canonicalizePhone(row.phone || fallbackPhone);
  if (!phone) return null;
  const role = row.role === 'delegate' || row.role === 'both' ? row.role : 'member';
  return {
    phone,
    displayName: row.display_name || null,
    treeChildId: Number(row.tree_child_id || 0) || null,
    personId: row.person_id || null,
    branchKey: String(row.branch_key || '').trim() || null,
    role,
    memberId: Number(row.member_id || 0) || null,
    isDelegate: Boolean(row.is_delegate) || role === 'delegate' || role === 'both',
    isMember: Boolean(row.is_member) || role === 'member' || role === 'both',
  };
}

async function rememberLockedPhone(phone: string) {
  const cleaned = canonicalizePhone(phone);
  if (!cleaned) return;
  const locked = await readLockedPhone();
  if (!locked) {
    await SecureStore.setItemAsync(DEVICE_LOCKED_PHONE_KEY, cleaned, secureOpts);
  }
}

async function persistSession(session: DeviceSession) {
  await SecureStore.setItemAsync(DEVICE_PHONE_KEY, session.phone, secureOpts);
  await SecureStore.setItemAsync(DEVICE_LOCKED_PHONE_KEY, session.phone, secureOpts);
  await AsyncStorage.setItem(MEMBER_PHONE_KEY, session.phone);
  notify(session);
}

async function endLocalSession() {
  await SecureStore.deleteItemAsync(DEVICE_PHONE_KEY, secureOpts).catch(() => {});
  await AsyncStorage.removeItem(MEMBER_PHONE_KEY).catch(() => {});
  notify(null);
}

export async function clearPhoneOnlyLegacySession() {
  const secret = await readSecret();
  if (secret) return;
  await AsyncStorage.removeItem(MEMBER_PHONE_KEY).catch(() => {});
}

export async function hasBoundSessionPhone() {
  return Boolean(await readBoundPhone());
}

export async function resumeTrustedDevice(): Promise<DeviceSession | null> {
  const phone = await readBoundPhone();
  const secret = await readSecret();
  if (phone) await rememberLockedPhone(phone);
  if (!phone || !secret) {
    await clearPhoneOnlyLegacySession();
    notify(null);
    return null;
  }
  if (await isDeviceLockEnabled()) {
    const unlocked = await ensureLocalUnlock();
    if (!unlocked) {
      notify(null);
      return null;
    }
  }
  try {
    const row = await callPublicRpc<SessionRpc>('member_device_resume_v1', {
      p_phone: phone,
      p_device_secret: secret,
    });
    const session = sessionFromRpc(row, phone);
    if (!session) {
      await endLocalSession();
      return null;
    }
    await persistSession(session);
    return session;
  } catch {
    notify(null);
    return null;
  }
}

export async function loginTrustedDevice(phone: string): Promise<DeviceSession | { error: string }> {
  const cleaned = canonicalizePhone(phone);
  if (!cleaned) return { error: 'bad_phone' };
  if ((await isDeviceLockEnabled()) && (await hasBoundSessionPhone())) {
    const unlocked = await ensureLocalUnlock();
    if (!unlocked) return { error: 'lock_required' };
  }
  try {
    const local = await ensureLocalDevice();
    const row = await callPublicRpc<SessionRpc>('member_device_login_v1', {
      p_phone: cleaned,
      p_device_public_id: local.id,
      p_device_secret: local.secret,
      p_label: local.label,
    });
    const session = sessionFromRpc(row, cleaned);
    if (!session) return { error: String(row?.error || 'not_found') };
    await persistSession(session);
    return session;
  } catch (err) {
    return { error: classifyPublicRpcError(err) };
  }
}

export async function logoutTrustedDevice() {
  const bound = await readBoundPhone();
  if (bound) await rememberLockedPhone(bound);
  await endLocalSession();
}

export function sessionToMemberRow(session: DeviceSession) {
  return {
    id: session.memberId || 0,
    phone: session.phone,
    branch_key: session.branchKey || '',
    tree_child_id: session.treeChildId || 0,
    person_id: session.personId,
    display_name: session.displayName,
    status: 'active',
    role: session.role,
  };
}
