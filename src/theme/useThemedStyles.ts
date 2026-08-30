import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { ThemePalette } from '../theme';
import { useThemePalette } from './ThemeContext';

/**
 * Rebuild styles when the palette changes. Factories return plain style objects;
 * StyleSheet.create runs here so frozen module-level palettes cannot leak.
 */
export function useThemedStyles(factory: (p: ThemePalette) => Record<string, unknown>) {
  const p = useThemePalette();
  return useMemo(
    () => StyleSheet.create(factory(p) as StyleSheet.NamedStyles<any>) as Record<string, any>,
    [p],
  );
}
