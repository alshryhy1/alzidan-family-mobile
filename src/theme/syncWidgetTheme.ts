import { NativeModules, Platform } from 'react-native';

import type { ThemeId } from '../theme';

type Bridge = {
  setThemeId: (themeId: string) => Promise<boolean>;
  refreshPrayerLocation?: () => Promise<boolean>;
  setPulseOnline?: (count: number) => Promise<boolean>;
};

export async function syncWidgetTheme(themeId: ThemeId): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const bridge = NativeModules.AlzidanThemeBridge as Bridge | undefined;
  if (!bridge?.setThemeId) return;
  try {
    await bridge.setThemeId(themeId);
  } catch {
    /* Native not in this binary yet — widget stays on last written / heritage. */
  }
}

/** Saves the phone's place so the widget prayer clock follows it, not a fixed city. */
export async function syncWidgetPrayerLocation(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const bridge = NativeModules.AlzidanThemeBridge as Bridge | undefined;
  if (!bridge?.refreshPrayerLocation) return;
  try {
    await bridge.refreshPrayerLocation();
  } catch {
    /* Permission declined or location unavailable. */
  }
}

/** Writes the live presence count so every widget size shows the same number. */
export async function syncWidgetOnlineCount(count: number | null): Promise<void> {
  if (Platform.OS !== 'ios' || count == null) return;
  const bridge = NativeModules.AlzidanThemeBridge as Bridge | undefined;
  if (!bridge?.setPulseOnline) return;
  try {
    await bridge.setPulseOnline(count);
  } catch {
    /* Native bridge not in this binary yet. */
  }
}
