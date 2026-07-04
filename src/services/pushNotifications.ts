import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { upsertPublicRow } from './supabase';

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
  if (!Device.isDevice) {
    return { ok: false, reason: 'push_requires_physical_device' };
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return { ok: false, reason: 'permission_denied' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('family-events', {
      name: 'أخبار العائلة',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#047857',
    });
  }

  const projectId = getProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  const now = new Date().toISOString();

  await upsertPublicRow(
    'push_tokens',
    {
      token: tokenResult.data,
      platform: Platform.OS,
      device_name: Device.deviceName || null,
      app_version: Constants.expoConfig?.version || null,
      enabled: true,
      updated_at: now,
    },
    'token',
  );

  return { ok: true, token: tokenResult.data };
}
