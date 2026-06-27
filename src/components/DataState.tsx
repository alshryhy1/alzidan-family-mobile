import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { colors, spacing, typography } from '../theme';

type DataStateProps = {
  empty?: boolean;
  emptyText?: string;
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
};

export function DataState({
  empty,
  emptyText = 'لا توجد بيانات متاحة حاليًا.',
  error,
  loading,
  onRetry,
}: DataStateProps) {
  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.primary} />
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

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  error: {
    color: colors.condolence,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  text: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
