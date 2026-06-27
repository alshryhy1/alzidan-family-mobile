import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { upsertPublicRow } from './supabase';

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
