import { NativeModules, Platform } from 'react-native';

import type { ThemeId } from '../theme';

type Bridge = {
  setThemeId: (themeId: string) => Promise<boolean>;
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
