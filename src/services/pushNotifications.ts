import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { callPublicRpc, isSupabaseConfigured, upsertPublicRow } from './supabase';
import { canonicalizePhone } from '../utils/phone';

/** EAS project UUID — required in bare/TestFlight when Constants omit projectId. */
const EAS_PROJECT_ID = '8a6659eb-ef85-49b5-a8db-7b7be96b8c1f';

export const PUSH_DEBUG_STORAGE_KEY = 'push_debug_v1';
const MEMBER_PHONE_KEY = 'alzidan_member_phone_v1';
const PUSH_PHONE_KEY = 'alzidan_push_phone_v1';

export type PushDebugTrace = {
  timestamp: string;
  step: string;
  tokenPrefix?: string | null;
  projectId?: string | null;
  errorMessage?: string | null;
  ok?: boolean;
  detail?: string | null;
};

export type RegisterPushTokenResult = {
  ok: boolean;
  token?: string;
  reason?: string;
  error?: string;
  via?: 'rpc' | 'fallback_upsert';
  rpcError?: string;
};

const PUSH_REGISTRATION_USER_MESSAGES: Record<string, string> = {
  register_start: 'جاري تفعيل الإشعارات…',
  not_physical_device: 'الإشعارات تعمل على الجهاز الحقيقي.',
  push_requires_physical_device: 'الإشعارات تعمل على الجهاز الحقيقي.',
  permission_denied: 'لم يُسمح بالإشعارات.',
  permission_granted: 'تم السماح بالإشعارات.',
  project_id: 'جاري تفعيل الإشعارات…',
  supabase_not_configured: 'تعذر تفعيل الإشعارات الآن.',
  supabase_env_missing: 'تعذر تفعيل الإشعارات الآن.',
  token_received: 'تم تفعيل الإشعارات.',
  token_empty: 'تعذر تفعيل الإشعارات.',
  empty_expo_push_token: 'تعذر تفعيل الإشعارات.',
  token_unchanged: 'الإشعارات مفعّلة.',
  token_fetch_failed: 'تعذر تفعيل الإشعارات.',
  rpc_success: 'تم تفعيل الإشعارات.',
  rpc_failed: 'تعذر تفعيل الإشعارات.',
  fallback_upsert_success: 'تم تفعيل الإشعارات.',
  fallback_upsert_failed: 'تعذر تفعيل الإشعارات.',
  registration_failed: 'تعذر تفعيل الإشعارات.',
};

export function getPushRegistrationUserMessage(input: {
  reason?: string | null;
  step?: string | null;
}): string {
  const key = String(input.reason || input.step || '').trim();
  if (key && PUSH_REGISTRATION_USER_MESSAGES[key]) {
    return PUSH_REGISTRATION_USER_MESSAGES[key];
  }
  return 'تعذر تفعيل الإشعارات. حاول مرة أخرى لاحقاً.';
}

function normalizeSaudiPhone(value: string) {
  return canonicalizePhone(value);
}

export async function rememberPushPhone(phone: string) {
  const normalized = normalizeSaudiPhone(phone);
  if (!normalized || normalized.replace(/\D/g, '').length < 9) return;
  await AsyncStorage.setItem(PUSH_PHONE_KEY, normalized);
}

export async function clearPushPhone() {
  try {
    await AsyncStorage.removeItem(PUSH_PHONE_KEY);
  } catch {
    // ignore
  }
  lastBoundPhone = null;
}

async function getStoredPushPhone() {
  try {
    const [member, push] = await Promise.all([
      AsyncStorage.getItem(MEMBER_PHONE_KEY),
      AsyncStorage.getItem(PUSH_PHONE_KEY),
    ]);
    return normalizeSaudiPhone(member || '') || normalizeSaudiPhone(push || '') || '';
  } catch {
    return '';
  }
}

function tokenPrefix(token: string | null | undefined) {
  const value = String(token || '').trim();
  if (!value) return null;
  return value.length <= 12 ? value : `${value.slice(0, 12)}…`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorStack(error: unknown) {
  if (error instanceof Error && error.stack) return error.stack;
  return null;
}

function logPushError(label: string, error: unknown) {
  const message = errorMessage(error);
  const stack = errorStack(error);
  console.error(`[PUSH] ${label}:`, message);
  if (stack) {
    console.error(`[PUSH] ${label} stack:`, stack);
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function savePushDebugTrace(trace: PushDebugTrace) {
  try {
    await AsyncStorage.setItem(PUSH_DEBUG_STORAGE_KEY, JSON.stringify(trace));
  } catch (storageError) {
    console.warn('[PUSH] failed to persist debug trace:', storageError);
  }
}

export async function getPushDebugTrace(): Promise<PushDebugTrace | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_DEBUG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PushDebugTrace;
  } catch {
    return null;
  }
}

async function tracePush(step: string, patch: Partial<Omit<PushDebugTrace, 'timestamp' | 'step'>> = {}) {
  const entry: PushDebugTrace = {
    timestamp: new Date().toISOString(),
    step,
    ...patch,
  };
  console.log('[PUSH]', step, entry);
  await savePushDebugTrace(entry);
  return entry;
}

export type FormalNotificationText = {
  typeLabel: string;
  subject: string;
  body: string;
  title: string;
};

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeType(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function pickFirstText(...values: unknown[]) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
}

export function formatFormalNotificationText(input: {
  type?: unknown;
  person?: unknown;
  fallbackTitle?: unknown;
  fallbackBody?: unknown;
}): FormalNotificationText {
  const type = normalizeType(input.type);
  const person = normalizeText(input.person);
  const fallbackTitle = normalizeText(input.fallbackTitle);
  const fallbackBody = normalizeText(input.fallbackBody);

  if (type === 'inbox_share') {
    return {
      typeLabel: 'وصلك من العائلة',
      subject: 'وصلك من العائلة',
      body: fallbackBody || 'شاركك أحد مناسبة تخصك.',
      title: fallbackTitle || 'وصلك من العائلة',
    };
  }

  if (
    type === 'branch_delegate_new_request' ||
    type === 'admin_new_request' ||
    type === 'women_manager_new_request' ||
    type === 'status_changed'
  ) {
    return {
      typeLabel: fallbackTitle || 'طلب',
      subject: person || fallbackTitle || 'طلب',
      body: fallbackBody || fallbackTitle || 'وصل طلب جديد.',
      title: fallbackTitle || 'طلب',
    };
  }

  if (type === 'birth' || type === 'aqiqa') {
    return {
      typeLabel: 'مولود جديد',
      subject: person || 'مولود جديد',
      body: person ? `وُلد ${person}.` : 'خبر مولود جديد في العائلة.',
      title: 'مولود جديد',
    };
  }

  if (type === 'death' || type === 'condolence') {
    return {
      typeLabel: 'وفاة',
      subject: person || 'وفاة',
      body: person || 'خبر وفاة في العائلة.',
      title: 'إنا لله وإنا إليه راجعون',
    };
  }

  if (type === 'sick' || type === 'operation' || type === 'discharge' || type === 'healing' || type === 'health') {
    return {
      typeLabel: 'حالة صحية',
      subject: person || 'حالة صحية',
      body: person || 'خبر حالة صحية في العائلة.',
      title: 'حالة صحية',
    };
  }

  if (type === 'marriage' || type === 'wedding' || type === 'contract') {
    return {
      typeLabel: 'زواج',
      subject: person || 'زواج',
      body: person || 'مناسبة زواج في العائلة.',
      title: 'زواج',
    };
  }

  if (
    type === 'graduation' ||
    type === 'graduation_notice' ||
    type === 'promotion' ||
    type === 'promotion_notice' ||
    type === 'family_news' ||
    type === 'news' ||
    type === 'general' ||
    type === 'success' ||
    type === 'achievement'
  ) {
    return {
      typeLabel: 'خبر عائلي',
      subject: person || 'خبر عائلي',
      body: person || fallbackBody || 'خبر جديد في العائلة.',
      title: 'خبر عائلي',
    };
  }

  return {
    typeLabel: 'مناسبة',
    subject: person || 'مناسبة',
    body: person || fallbackBody || 'مناسبة جديدة في العائلة.',
    title: fallbackTitle && fallbackTitle !== 'إشعار جديد' ? fallbackTitle : 'مناسبة',
  };
}

export function formatFormalNotificationFromPayload(payload: {
  title?: unknown;
  body?: unknown;
  data?: Record<string, unknown> | null;
}) {
  const data = payload.data || {};
  const person = pickFirstText(
    data.person,
    data.name,
    data.display_name,
    data.full_name,
    data.member_name,
  );
  const type = pickFirstText(
    data.mode,
    data.notification_type,
    data.type,
    data.event_type,
  );

  return formatFormalNotificationText({
    type,
    person,
    fallbackTitle: payload.title,
    fallbackBody: payload.body,
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId() {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEasConfig = Constants.easConfig?.projectId;
  const manifest2Extra = (Constants as { manifest2?: { extra?: { eas?: { projectId?: string } } } }).manifest2?.extra;
  const fromManifest2 = manifest2Extra?.eas?.projectId;

  return fromExpoConfig || fromEasConfig || fromManifest2 || EAS_PROJECT_ID;
}

async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    status = requested.status;
  }

  return status;
}

async function fetchExpoPushToken(projectId: string) {
  const maxAttempts = 4;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`[PUSH] getExpoPushTokenAsync attempt ${attempt}/${maxAttempts}`, { projectId });
      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      console.log('[PUSH] Got Expo Push Token?', Boolean(tokenResult?.data), tokenPrefix(tokenResult?.data));
      return tokenResult;
    } catch (error) {
      lastError = error;
      logPushError(`getExpoPushTokenAsync attempt ${attempt} failed`, error);
      if (attempt < maxAttempts) {
        await sleep(750 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError));
}

async function persistPushToken(token: string, projectId: string): Promise<RegisterPushTokenResult> {
  if (!isSupabaseConfigured()) {
    const message = 'supabase_env_missing';
    console.error('[PUSH] Supabase not configured — RPC/upsert skipped');
    await tracePush('supabase_not_configured', {
      ok: false,
      projectId,
      tokenPrefix: tokenPrefix(token),
      errorMessage: message,
    });
    return { ok: false, reason: 'supabase_not_configured', error: message };
  }

  const phone = await getStoredPushPhone();
  const now = new Date().toISOString();
  const tokenRow: Record<string, unknown> = {
    token,
    platform: Platform.OS,
    device_name: Device.deviceName || null,
    app_version: Constants.expoConfig?.version || null,
    enabled: true,
    updated_at: now,
  };
  if (phone) tokenRow.phone = phone;

  const rpcArgs: Record<string, unknown> = {
    p_token: tokenRow.token,
    p_platform: tokenRow.platform,
    p_device_name: tokenRow.device_name,
    p_app_version: tokenRow.app_version,
  };
  if (phone) rpcArgs.p_phone = phone;

  console.log('[PUSH] RPC called? yes — register_push_token_v1', {
    ...rpcArgs,
    p_token: tokenPrefix(token),
    p_phone: phone ? `${phone.slice(0, 4)}…` : null,
  });

  const tryRpc = async (args: Record<string, unknown>) => {
    const rpcResult = await callPublicRpc<{ ok?: boolean; error?: string }>(
      'register_push_token_v1',
      args,
    );
    if (rpcResult?.ok === false) {
      throw new Error(rpcResult.error || 'register_push_token_v1_failed');
    }
  };

  try {
    try {
      await tryRpc(rpcArgs);
    } catch (firstRpcError) {
      if (!phone) throw firstRpcError;
      const msg = errorMessage(firstRpcError);
      if (!/could not find the function|PGRST202|p_phone/i.test(msg)) throw firstRpcError;
      const { p_phone: _ignored, ...withoutPhone } = rpcArgs;
      await tryRpc(withoutPhone);
    }

    lastBoundPhone = phone || null;
    await tracePush('rpc_success', {
      ok: true,
      projectId,
      tokenPrefix: tokenPrefix(token),
      detail: phone ? 'register_push_token_v1+phone' : 'register_push_token_v1',
    });
    return { ok: true, token, via: 'rpc' };
  } catch (rpcError) {
    const message = errorMessage(rpcError);
    logPushError('RPC register_push_token_v1 failed', rpcError);
    await tracePush('rpc_failed', {
      ok: false,
      projectId,
      tokenPrefix: tokenPrefix(token),
      errorMessage: message,
      detail: 'register_push_token_v1',
    });

    console.log('[PUSH] Fallback upsert executed? attempting push_tokens upsert', {
      ...tokenRow,
      token: tokenPrefix(token),
    });

    try {
      try {
        await upsertPublicRow('push_tokens', tokenRow, 'token');
      } catch (firstUpsertError) {
        if (!phone) throw firstUpsertError;
        const { phone: _ignored, ...withoutPhone } = tokenRow;
        await upsertPublicRow('push_tokens', withoutPhone, 'token');
      }
      lastBoundPhone = phone || null;
      console.log('[PUSH] Fallback upsert push_tokens: success');
      await tracePush('fallback_upsert_success', {
        ok: true,
        projectId,
        tokenPrefix: tokenPrefix(token),
        detail: phone ? 'push_tokens+phone' : 'push_tokens',
      });
      return { ok: true, token, via: 'fallback_upsert' };
    } catch (upsertError) {
      const upsertMessage = errorMessage(upsertError);
      logPushError('fallback upsert push_tokens failed', upsertError);
      await tracePush('fallback_upsert_failed', {
        ok: false,
        projectId,
        tokenPrefix: tokenPrefix(token),
        errorMessage: upsertMessage,
        detail: 'push_tokens',
      });
      return {
        ok: false,
        reason: 'registration_failed',
        error: upsertMessage,
        rpcError: message,
      };
    }
  }
}

let registrationInFlight: Promise<RegisterPushTokenResult> | null = null;
let lastRegisteredToken: string | null = null;
let lastBoundPhone: string | null = null;

export async function registerPushToken(source = 'direct'): Promise<RegisterPushTokenResult> {
  if (registrationInFlight) {
    console.log('[PUSH] registerPushToken already in flight, awaiting existing call', { source });
    return registrationInFlight;
  }

  registrationInFlight = (async () => {
    await tracePush('register_start', { ok: false, detail: `${Platform.OS}:${source}` });

    if (!Device.isDevice) {
      await tracePush('not_physical_device', {
        ok: false,
        errorMessage: 'push_requires_physical_device',
      });
      return { ok: false, reason: 'push_requires_physical_device' };
    }

    const status = await ensureNotificationPermission();
    if (status !== 'granted') {
      await tracePush('permission_denied', {
        ok: false,
        errorMessage: `permission_status:${status}`,
      });
      return { ok: false, reason: 'permission_denied' };
    }

    await tracePush('permission_granted', { ok: false });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('family-events', {
        name: 'أخبار العائلة',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#047857',
      });
    }

    const projectId = getProjectId();
    console.log('[PUSH] projectId resolved:', projectId, {
      expoConfig: Constants.expoConfig?.extra?.eas?.projectId ?? null,
      easConfig: Constants.easConfig?.projectId ?? null,
      fallback: EAS_PROJECT_ID,
    });
    await tracePush('project_id', {
      ok: false,
      projectId,
      detail: 'project_id_present',
    });

    let tokenResult: Notifications.ExpoPushToken;
    try {
      tokenResult = await fetchExpoPushToken(projectId);
    } catch (tokenError) {
      const message = errorMessage(tokenError);
      logPushError('getExpoPushTokenAsync failed (all retries)', tokenError);
      await tracePush('token_fetch_failed', {
        ok: false,
        projectId,
        errorMessage: message,
      });
      return { ok: false, reason: 'token_fetch_failed', error: message };
    }

    const token = String(tokenResult.data || '').trim();
    if (!token) {
      await tracePush('token_empty', {
        ok: false,
        projectId,
        errorMessage: 'empty_expo_push_token',
      });
      return { ok: false, reason: 'token_empty' };
    }

    const phone = await getStoredPushPhone();
    if (token === lastRegisteredToken && phone === (lastBoundPhone || '')) {
      console.log('[PUSH] token unchanged, skipping Supabase write', { token: tokenPrefix(token) });
      await tracePush('token_unchanged', {
        ok: true,
        projectId,
        tokenPrefix: tokenPrefix(token),
      });
      return { ok: true, token, via: 'rpc' };
    }

    await tracePush('token_received', {
      ok: false,
      projectId,
      tokenPrefix: tokenPrefix(token),
    });

    const result = await persistPushToken(token, projectId);
    if (result.ok) {
      lastRegisteredToken = token;
    }
    return result;
  })();

  try {
    return await registrationInFlight;
  } finally {
    registrationInFlight = null;
  }
}

export function setupPushRegistration() {
  console.log('[PUSH] setupPushRegistration');

  const runRegistration = (source: string) => {
    registerPushToken(source)
      .then((result) => {
        if (!result?.ok) {
          const reason = String(result?.reason || result?.error || '');
          // Expected on simulator / Expo Go — do not raise LogBox over the UI.
          if (
            reason.includes('physical_device') ||
            reason.includes('push_requires_physical_device') ||
            reason.includes('not_physical_device')
          ) {
            console.log('[PUSH] skipped on simulator/Expo Go:', reason);
          } else {
            console.warn('[PUSH] registerPushToken finished with failure:', reason || result);
          }
        } else {
          console.log('[PUSH] registerPushToken finished successfully', {
            source,
            via: result.via ?? 'rpc',
            token: result.token ? tokenPrefix(result.token) : null,
          });
        }
      })
      .catch((error) => {
        logPushError('registerPushToken unhandled error', error);
      });
  };

  runRegistration('mount');

  const pushTokenSub = Notifications.addPushTokenListener(() => {
    console.log('[PUSH] native push token changed — re-registering');
    runRegistration('push_token_listener');
  });

  let lastAppState: AppStateStatus = AppState.currentState;
  const appStateSub = AppState.addEventListener('change', (nextState) => {
    if (lastAppState.match(/inactive|background/) && nextState === 'active') {
      console.log('[PUSH] app became active — re-registering');
      runRegistration('app_active');
    }
    lastAppState = nextState;
  });

  return () => {
    pushTokenSub.remove();
    appStateSub.remove();
  };
}
