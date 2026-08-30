import type { PropsWithChildren } from 'react';
import type { RefObject } from 'react';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';

type ScreenProps = PropsWithChildren<{
  title: string;
  description?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
}>;

function screenStyles(p: ThemePalette) {
  return StyleSheet.create({
    content: {
      gap: spacing.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    heading: {
      gap: spacing.xs,
    },
    title: {
      color: p.text,
      fontSize: typography.heading,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    description: {
      color: p.textMuted,
      fontSize: typography.body,
      lineHeight: 23,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}

export function Screen({
  children,
  title,
  description,
  onRefresh,
  refreshing = false,
  scrollRef,
}: ScreenProps) {
  const p = useThemePalette();
  const styles = useMemo(() => screenStyles(p), [p]);
  return (
    <ScrollView
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.content}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            colors={[p.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={p.primary}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      {title || description ? (
        <View style={styles.heading}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}
