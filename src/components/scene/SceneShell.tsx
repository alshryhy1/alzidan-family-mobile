import type { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { scene, spacing, typography } from '../../theme';
import { GoldDivider, OrnamentField } from './Ornament';

export type SceneVariant = 'pulse' | 'identity' | 'lineage' | 'occasion' | 'archive' | 'houses';

type SceneShellProps = PropsWithChildren<{
  variant: SceneVariant;
  eyebrow?: string;
  title: string;
  english?: string;
  subtitle?: string;
  heroLead?: ReactNode;
  heroExtra?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}>;

const HERO: Record<SceneVariant, readonly [string, string, string]> = {
  pulse: [scene.greenDeep, scene.green, '#24584C'],
  identity: [scene.greenDeep, scene.green, scene.greenMid],
  lineage: ['#0C231E', scene.greenDeep, scene.green],
  occasion: [scene.greenDeep, '#1A463C', '#3A5A3A'],
  archive: ['#1A3328', scene.green, '#4A3B22'],
  houses: [scene.greenDeep, scene.greenMid, '#2A5A4C'],
};

export function SceneShell({
  variant,
  eyebrow,
  title,
  english,
  subtitle,
  heroLead,
  heroExtra,
  children,
  onRefresh,
  refreshing = false,
}: SceneShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        bounces
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              colors={[scene.gold]}
              onRefresh={onRefresh}
              refreshing={refreshing}
              tintColor={scene.gold}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[...HERO[variant]]}
          end={{ x: 0.92, y: 1 }}
          start={{ x: 0.08, y: 0 }}
          style={[styles.hero, { paddingTop: Math.max(insets.top, 12) + 8 }]}
        >
          <OrnamentField count={variant === 'pulse' ? 20 : 16} />
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markLetter}>ز</Text>
            </View>
            <View>
              <Text style={styles.brandAr}>عائلة الزيدان</Text>
              <Text style={styles.brandEn}>AL-ZIDAN</Text>
            </View>
          </View>
          {heroLead ? <View style={styles.heroLead}>{heroLead}</View> : null}
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text
            style={[
              styles.title,
              variant === 'pulse' && styles.titlePulse,
              variant === 'identity' && styles.titleIdentity,
            ]}
          >
            {title}
          </Text>
          {variant === 'identity' && heroExtra ? <View style={styles.heroExtraIdentity}>{heroExtra}</View> : null}
          {english ? <Text style={styles.english}>{english}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {variant !== 'identity' && heroExtra ? <View style={styles.heroExtra}>{heroExtra}</View> : null}
          <View style={styles.curve}>
            <View style={styles.curveGold} />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <OrnamentField count={10} tone="cream" />
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function SceneSection({
  title,
  children,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={styles.section}>
      {title ? (
        <>
          <Text style={styles.sectionTitle}>{title}</Text>
          <GoldDivider />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: scene.cream,
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  hero: {
    overflow: 'hidden',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: spacing.md,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,163,90,0.18)',
    borderColor: scene.gold,
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  markLetter: {
    color: scene.goldSoft,
    fontSize: 22,
    fontWeight: '800',
  },
  brandAr: {
    color: scene.goldSoft,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  brandEn: {
    color: scene.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.85,
    textAlign: 'right',
  },
  heroLead: {
    marginBottom: spacing.sm,
  },
  eyebrow: {
    color: scene.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  title: {
    color: scene.creamLift,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 44,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  titlePulse: {
    fontSize: 28,
    lineHeight: 38,
  },
  english: {
    color: scene.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginTop: 2,
    opacity: 0.8,
    textAlign: 'right',
  },
  subtitle: {
    color: 'rgba(232,213,168,0.82)',
    fontSize: typography.body,
    lineHeight: 24,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  titleIdentity: {
    fontSize: 28,
    lineHeight: 38,
  },
  heroExtra: {
    marginTop: spacing.md,
  },
  heroExtraIdentity: {
    marginTop: spacing.md,
  },
  curve: {
    backgroundColor: scene.cream,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    bottom: -1,
    height: 22,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  curveGold: {
    alignSelf: 'center',
    backgroundColor: scene.gold,
    borderRadius: 2,
    height: 3,
    marginTop: 8,
    opacity: 0.7,
    width: 56,
  },
  body: {
    gap: spacing.xl,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: scene.green,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
