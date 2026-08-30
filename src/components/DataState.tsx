import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';

import { ActionButton } from './ActionButton';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';

type DataStateProps = {
  empty?: boolean;
  emptyText?: string;
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
};

function dataStyles(p: ThemePalette) {
  return StyleSheet.create({
    box: {
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
    error: {
      color: p.condolence,
      fontSize: typography.body,
      fontWeight: '800',
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    text: {
      color: p.textMuted,
      fontSize: typography.body,
      lineHeight: 23,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
  });
}

export function DataState({
  empty,
  emptyText = 'لا توجد بيانات متاحة حاليًا.',
  error,
  loading,
  onRetry,
}: DataStateProps) {
  const p = useThemePalette();
  const styles = useMemo(() => dataStyles(p), [p]);
  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={p.primary} />
        <Text style={styles.text}>جاري تحميل البيانات…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.box}>
        <Text style={styles.error}>تعذر تحميل البيانات.</Text>
        <Text style={styles.text}>{error}</Text>
        {onRetry ? <ActionButton label="إعادة المحاولة" onPress={onRetry} variant="secondary" /> : null}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.box}>
        <Text style={styles.text}>{emptyText}</Text>
      </View>
    );
  }

  return null;
}
