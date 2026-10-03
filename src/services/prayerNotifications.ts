import { NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { upcomingPrayerSlots, type PrayerSlot } from './prayerTimes';

const WARN_BEFORE_MS = 5 * 60 * 1000;
const ID_PREFIX = 'prayer-';

type Coordinate = { latitude: number; longitude: number };

type Bridge = {
  readPrayerCoordinate?: () => Promise<Coordinate | null>;
};

async function readCoordinate(): Promise<Coordinate | null> {
  if (Platform.OS !== 'ios') return null;
  const bridge = NativeModules.AlzidanThemeBridge as Bridge | undefined;
  if (!bridge?.readPrayerCoordinate) return null;
  try {
    const value = await bridge.readPrayerCoordinate();
    const latitude = Number(value?.latitude);
    const longitude = Number(value?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}

async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.status === 'denied') return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return requested.status === 'granted';
}

async function clearPrayerNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => String(item.identifier).startsWith(ID_PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

async function scheduleOne(slot: PrayerSlot, phase: 'soon' | 'time', when: Date) {
  const soon = phase === 'soon';
  await Notifications.scheduleNotificationAsync({
    identifier: `${ID_PREFIX}${slot.key}-${dayKey(slot.time)}-${phase}`,
    content: {
      title: slot.name,
      body: soon ? 'باقي على الأذان خمس دقائق' : 'دخل وقت الصلاة',
      sound: 'default',
      data: { kind: 'prayer', prayer: slot.key, phase },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
}

/** Asks for notification permission, then arms the five daily adhans. */
export async function syncPrayerNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('prayer-times', {
        name: 'أوقات الصلاة',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    const allowed = await ensurePermission();
    if (!allowed) return;

    const now = Date.now();
    const coordinate = await readCoordinate();
    const slots = upcomingPrayerSlots(new Date(), 6, coordinate);
    await clearPrayerNotifications();
    for (const slot of slots) {
      const warnAt = slot.time.getTime() - WARN_BEFORE_MS;
      if (warnAt > now + 5000) await scheduleOne(slot, 'soon', new Date(warnAt));
      if (slot.time.getTime() > now + 5000) await scheduleOne(slot, 'time', slot.time);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[prayer] schedule', error instanceof Error ? error.message : error);
    }
  }
}
