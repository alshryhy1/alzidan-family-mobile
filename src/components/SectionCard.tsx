import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, shadows, spacing, typography } from '../theme';

type SectionCardProps = PropsWithChildren<{
  title?: string;
  eyebrow?: string;
}>;

export function SectionCard({ children, eyebrow, title }: SectionCardProps) {
  return (
    <View style={styles.card}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
