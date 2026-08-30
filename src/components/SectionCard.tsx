import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { shadows, spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';

type SectionCardProps = PropsWithChildren<{
  title?: string;
  eyebrow?: string;
}>;

function cardStyles(p: ThemePalette) {
  return StyleSheet.create({
    card: {
      ...shadows.card,
      backgroundColor: p.surface,
      borderColor: 'rgba(196,163,90,0.38)',
      borderRadius: 22,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    eyebrow: {
      color: p.accent,
      fontSize: typography.caption,
      fontWeight: '800',
      letterSpacing: 0.4,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    title: {
      color: p.text,
      fontSize: typography.title,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}

export function SectionCard({ children, eyebrow, title }: SectionCardProps) {
  const p = useThemePalette();
  const styles = useMemo(() => cardStyles(p), [p]);
  return (
    <View style={styles.card}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}
