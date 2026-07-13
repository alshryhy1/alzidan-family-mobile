import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { callPublicRpc, upsertPublicRow } from './supabase';

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
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined
  );
}

export async function registerPushToken() {
  await tracePush('register_start', { ok: false, detail: Platform.OS });

  if (!Device.isDevice) {
    await tracePush('not_physical_device', {
      ok: false,
      errorMessage: 'push_requires_physical_device',
    });
    return { ok: false, reason: 'push_requires_physical_device' };
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

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
  console.log('[PUSH] projectId:', projectId ?? '(missing)');
  await tracePush('project_id', {
    ok: false,
    projectId: projectId ?? null,
    detail: projectId ? 'project_id_present' : 'project_id_missing',
  });

  let tokenResult: Notifications.ExpoPushToken;
  try {
    tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
  } catch (tokenError) {
    const message = errorMessage(tokenError);
    console.error('[PUSH] getExpoPushTokenAsync failed:', message);
    await tracePush('token_fetch_failed', {
      ok: false,
      projectId: projectId ?? null,
      errorMessage: message,
    });
    return { ok: false, reason: 'token_fetch_failed', error: message };
  }

  console.log('[PUSH] token:', tokenResult.data);
  await tracePush('token_received', {
    ok: false,
    projectId: projectId ?? null,
    tokenPrefix: tokenPrefix(tokenResult.data),
  });

  const now = new Date().toISOString();
  const tokenRow = {
    token: tokenResult.data,
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

  console.log('[PUSH] RPC register_push_token_v1 call:', {
    ...rpcArgs,
    p_token: tokenPrefix(tokenRow.token),
  });

  try {
    const rpcResult = await callPublicRpc<{ ok?: boolean; error?: string }>(
      'register_push_token_v1',
      rpcArgs,
    );
    console.log('[PUSH] RPC register_push_token_v1 result:', rpcResult);

    if (rpcResult?.ok === false) {
      throw new Error(rpcResult.error || 'register_push_token_v1_failed');
    }

    await tracePush('rpc_success', {
      ok: true,
      projectId: projectId ?? null,
      tokenPrefix: tokenPrefix(tokenResult.data),
      detail: 'register_push_token_v1',
    });
    return { ok: true, token: tokenResult.data };
  } catch (rpcError) {
    const message = errorMessage(rpcError);
    console.warn('[PUSH] RPC register_push_token_v1 failed, falling back to push_tokens upsert:', message);
    await tracePush('rpc_failed', {
      ok: false,
      projectId: projectId ?? null,
      tokenPrefix: tokenPrefix(tokenResult.data),
      errorMessage: message,
      detail: 'register_push_token_v1',
    });

    try {
      console.log('[PUSH] fallback upsert push_tokens:', {
        ...tokenRow,
        token: tokenPrefix(tokenRow.token),
      });
      await upsertPublicRow('push_tokens', tokenRow, 'token');
      console.log('[PUSH] fallback upsert push_tokens: success');
      await tracePush('fallback_upsert_success', {
        ok: true,
        projectId: projectId ?? null,
        tokenPrefix: tokenPrefix(tokenResult.data),
        detail: 'push_tokens',
      });
      return { ok: true, token: tokenResult.data, via: 'fallback_upsert' as const };
    } catch (upsertError) {
      const upsertMessage = errorMessage(upsertError);
      console.error('[PUSH] fallback upsert push_tokens failed:', upsertMessage);
      await tracePush('fallback_upsert_failed', {
        ok: false,
        projectId: projectId ?? null,
        tokenPrefix: tokenPrefix(tokenResult.data),
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
