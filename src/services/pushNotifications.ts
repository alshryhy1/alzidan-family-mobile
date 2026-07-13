import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { callPublicRpc, isSupabaseConfigured, upsertPublicRow } from './supabase';

/** EAS project UUID — required in bare/TestFlight when Constants omit projectId. */
const EAS_PROJECT_ID = '8a6659eb-ef85-49b5-a8db-7b7be96b8c1f';

export const PUSH_DEBUG_STORAGE_KEY = 'push_debug_v1';

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
  const fallbackTitle = normalizeText(input.fallbackTitle) || 'إشعار جديد';
  const fallbackBody = normalizeText(input.fallbackBody) || 'ورد إشعار جديد في تطبيق عائلة الزيدان.';

  if (type === 'birth') {
    const subject = person ? `صدور إشعار مولود جديد يخص: ${person}` : 'صدور إشعار مولود جديد';
    const body = person
      ? `تم اعتماد خبر مولود جديد في تطبيق عائلة الزيدان لصاحب الاسم: ${person}.`
      : 'تم اعتماد خبر مولود جديد في تطبيق عائلة الزيدان.';
    return { typeLabel: 'إشعار مولود جديد', subject, body, title: `إشعار مولود جديد — ${subject}` };
  }

  if (type === 'death') {
    const subject = person ? `صدور إشعار وفاة يخص: ${person}` : 'صدور إشعار وفاة';
    const body = person
      ? `تم تسجيل خبر وفاة في تطبيق عائلة الزيدان للاسم: ${person}.`
      : 'تم تسجيل خبر وفاة في تطبيق عائلة الزيدان.';
    return { typeLabel: 'إشعار وفاة', subject, body, title: `إشعار وفاة — ${subject}` };
  }

  if (type === 'sick' || type === 'operation' || type === 'discharge') {
    const subject = person ? `صدور إشعار حالة صحية يخص: ${person}` : 'صدور إشعار حالة صحية';
    const body = person
      ? `تم تسجيل حالة صحية في تطبيق عائلة الزيدان للاسم: ${person}.`
      : 'تم تسجيل حالة صحية جديدة في تطبيق عائلة الزيدان.';
    return { typeLabel: 'إشعار حالة صحية', subject, body, title: `إشعار حالة صحية — ${subject}` };
  }

  if (type === 'general' || type === 'news') {
    const subject = person ? `صدور خبر جديد يخص: ${person}` : 'صدور خبر جديد';
    const body = fallbackBody || 'تم نشر خبر جديد في تطبيق عائلة الزيدان.';
    return { typeLabel: 'إشعار خبر جديد', subject, body, title: `إشعار خبر جديد — ${subject}` };
  }

  if (type === 'update' || type === 'updated' || type === 'edit' || type === 'edited') {
    const subject = person ? `تم تحديث خبر يخص: ${person}` : 'تم تحديث خبر';
    const body = person
      ? `تم تحديث خبر في تطبيق عائلة الزيدان للاسم: ${person}.`
      : 'تم تحديث خبر في تطبيق عائلة الزيدان.';
    return { typeLabel: 'إشعار تحديث', subject, body, title: `إشعار تحديث — ${subject}` };
  }

  if (type === 'new' || type === 'new_item' || type === 'added') {
    const subject = person ? `تمت إضافة خبر جديد يخص: ${person}` : 'تمت إضافة خبر جديد';
    const body = person
      ? `تمت إضافة خبر جديد في تطبيق عائلة الزيدان للاسم: ${person}.`
      : 'تمت إضافة خبر جديد في تطبيق عائلة الزيدان.';
    return { typeLabel: 'إشعار إضافة جديدة', subject, body, title: `إشعار إضافة جديدة — ${subject}` };
  }

  const defaultSubject = person ? `صدور إشعار مناسبة يخص: ${person}` : 'صدور إشعار مناسبة';
  const defaultBody = fallbackBody || 'تم نشر مناسبة جديدة في تطبيق عائلة الزيدان.';
  const defaultTitle = fallbackTitle === 'إشعار جديد' ? `إشعار مناسبة — ${defaultSubject}` : fallbackTitle;

  return {
    typeLabel: 'إشعار مناسبة',
    subject: defaultSubject,
    body: defaultBody,
    title: defaultTitle,
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
    data.type,
    data.event_type,
    data.kind,
    data.notification_type,
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

  const now = new Date().toISOString();
  const tokenRow = {
    token,
    platform: Platform.OS,
    device_name: Device.deviceName || null,
    app_version: Constants.expoConfig?.version || null,
    enabled: true,
    updated_at: now,
  };

  const rpcArgs = {
    p_token: tokenRow.token,
    p_platform: tokenRow.platform,
    p_device_name: tokenRow.device_name,
    p_app_version: tokenRow.app_version,
  };

  console.log('[PUSH] RPC called? yes — register_push_token_v1', {
    ...rpcArgs,
    p_token: tokenPrefix(tokenRow.token),
  });

  try {
    const rpcResult = await callPublicRpc<{ ok?: boolean; error?: string }>(
      'register_push_token_v1',
      rpcArgs,
    );
    console.log('[PUSH] RPC result:', rpcResult);

    if (rpcResult?.ok === false) {
      throw new Error(rpcResult.error || 'register_push_token_v1_failed');
    }

    await tracePush('rpc_success', {
      ok: true,
      projectId,
      tokenPrefix: tokenPrefix(token),
      detail: 'register_push_token_v1',
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
      token: tokenPrefix(tokenRow.token),
    });

    try {
      await upsertPublicRow('push_tokens', tokenRow, 'token');
      console.log('[PUSH] Fallback upsert push_tokens: success');
      await tracePush('fallback_upsert_success', {
        ok: true,
        projectId,
        tokenPrefix: tokenPrefix(token),
        detail: 'push_tokens',
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

    if (token === lastRegisteredToken) {
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
          console.warn('[PUSH] registerPushToken finished with failure:', result?.reason || result);
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
