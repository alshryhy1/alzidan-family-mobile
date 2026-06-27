import type { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';

type ScreenProps = PropsWithChildren<{
  title: string;
  description?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}>;

export function Screen({
  children,
  title,
  description,
  onRefresh,
  refreshing = false,
}: ScreenProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heading: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
