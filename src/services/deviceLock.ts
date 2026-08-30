import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const LOCK_ENABLED_KEY = 'alzidan_device_lock_enabled_v1';

const secureOpts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

let unlockInflight: Promise<boolean> | null = null;
const lockListeners = new Set<() => void>();

type LocalAuth = typeof import('expo-local-authentication');

function getLocalAuth(): LocalAuth | null {
  try {
    return require('expo-local-authentication') as LocalAuth;
  } catch {
    return null;
  }
}

function notifyLocked() {
  lockListeners.forEach((cb) => cb());
}

export function subscribeDeviceLock(cb: () => void) {
  lockListeners.add(cb);
  return () => lockListeners.delete(cb);
}

export function clearLocalUnlockCache() {
  unlockInflight = null;
}

export async function isDeviceLockEnabled() {
  const raw = String((await SecureStore.getItemAsync(LOCK_ENABLED_KEY, secureOpts)) || '').trim();
  return raw === '1';
}

export async function canUseDeviceLock() {
  const LocalAuthentication = getLocalAuth();
  if (!LocalAuthentication) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return Boolean(hasHardware && enrolled);
  } catch {
    return false;
  }
}

export async function enableDeviceLock(): Promise<{ ok: boolean; error?: string }> {
  const available = await canUseDeviceLock();
  if (!available) return { ok: false, error: 'unavailable' };
  const unlocked = await authenticateLocal('فعّل الدخول ببصمة الوجه');
  if (!unlocked) return { ok: false, error: 'cancelled' };
  await SecureStore.setItemAsync(LOCK_ENABLED_KEY, '1', secureOpts);
  return { ok: true };
}

export async function disableDeviceLock() {
  await SecureStore.deleteItemAsync(LOCK_ENABLED_KEY, secureOpts).catch(() => {});
  clearLocalUnlockCache();
}

async function authenticateLocal(promptMessage: string) {
  const LocalAuthentication = getLocalAuth();
  if (!LocalAuthentication) return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'إلغاء',
      fallbackLabel: 'رمز الجهاز',
      disableDeviceFallback: false,
    });
    return Boolean(result.success);
  } catch {
    return false;
  }
}

export async function ensureLocalUnlock(): Promise<boolean> {
  if (!(await isDeviceLockEnabled())) return true;
  if (!(await canUseDeviceLock())) return true;
  if (unlockInflight) return unlockInflight;
  unlockInflight = authenticateLocal('افتح حسابك').then((ok) => {
    if (!ok) unlockInflight = null;
    return ok;
  });
  return unlockInflight;
}

AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    clearLocalUnlockCache();
    notifyLocked();
  }
});
