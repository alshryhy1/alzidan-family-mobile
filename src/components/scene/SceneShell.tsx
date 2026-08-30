import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { spacing, typography, type ThemePalette } from '../../theme';
import { useThemePalette } from '../../theme/ThemeContext';
import { formatHeaderToday, formatHeaderTodayNumeric } from '../../utils/headerToday';
import { BrandMark, GoldDivider, OrnamentField } from './Ornament';

export type SceneVariant = 'pulse' | 'identity' | 'lineage' | 'occasion' | 'archive' | 'houses';

type SceneShellProps = PropsWithChildren<{
  variant: SceneVariant;
  eyebrow?: string;
  title: string;
  english?: string;
  subtitle?: string;
  heroLead?: ReactNode;
  heroExtra?: ReactNode;
  /** Replaces the date stamp in the brand row (e.g. donate). */
  brandAccessory?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}>;

const HERO_HERITAGE: Record<SceneVariant, readonly [string, string, string]> = {
  pulse: ['#0F2A24', '#173F35', '#24584C'],
  identity: ['#0F2A24', '#173F35', '#1F4F44'],
  lineage: ['#0C231E', '#0F2A24', '#173F35'],
  occasion: ['#0F2A24', '#1A463C', '#3A5A3A'],
  archive: ['#1A3328', '#173F35', '#4A3B22'],
  houses: ['#0F2A24', '#1F4F44', '#2A5A4C'],
};

function heroColors(p: ThemePalette, variant: SceneVariant): readonly [string, string, string] {
  if (p.themeId === 'heritage') return HERO_HERITAGE[variant];
  return [p.heroDeep, p.heroMid, p.heroLift];
}

function shellStyles(p: ThemePalette) {
  return StyleSheet.create({
    root: {
      backgroundColor: p.cream,
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
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    brandLockup: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      flexShrink: 0,
      gap: 10,
    },
    dateStamp: {
      flexShrink: 1,
      maxWidth: '52%',
    },
    dateStampMeta: {
      width: '100%',
    },
    dateWeekdayCompact: {
      fontSize: 13,
      textAlign: 'left',
    },
    dateHijriCompact: {
      fontSize: 11,
      marginTop: 4,
      textAlign: 'left',
    },
    dateWeekday: {
      color: p.goldSoft,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    dateHijri: {
      color: p.creamLift,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 1,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    dateGregorian: {
      color: p.gold,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 1,
      opacity: 0.88,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    dateSalawat: {
      color: p.goldSoft,
      fontSize: 11,
      fontWeight: '800',
      marginTop: 4,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    brandAr: {
      color: p.goldSoft,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    brandEn: {
      color: p.gold,
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
      color: p.gold,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      marginBottom: 4,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    title: {
      color: p.creamLift,
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
      color: p.gold,
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
      backgroundColor: p.cream,
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
      backgroundColor: p.gold,
      borderRadius: 2,
      height: 3,
      marginTop: 8,
      opacity: 0.7,
      width: 56,
    },
    body: {
      flexGrow: 1,
      gap: spacing.xl,
      overflow: 'hidden',
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      color: p.green,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}

export function DateStamp({ compact = false }: { compact?: boolean }) {
  const p = useThemePalette();
  const styles = useMemo(() => shellStyles(p), [p]);
  const [today, setToday] = useState(() =>
    compact ? formatHeaderTodayNumeric() : formatHeaderToday(),
  );

  useEffect(() => {
    const tick = () => setToday(compact ? formatHeaderTodayNumeric() : formatHeaderToday());
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [compact]);

  return (
    <View
      accessibilityLabel={[today.weekday, today.hijri, today.gregorian, today.salawat]
        .filter(Boolean)
        .join(' ')}
      style={compact ? styles.dateStampMeta : styles.dateStamp}
    >
      {compact ? (
        <>
          <Text style={[styles.dateWeekday, styles.dateWeekdayCompact]} numberOfLines={1}>
            {today.weekday}
          </Text>
          <Text style={[styles.dateHijri, styles.dateHijriCompact]} numberOfLines={1}>
            {today.hijri}  {today.gregorian}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.dateWeekday}>{today.weekday}</Text>
          <Text style={styles.dateHijri}>{today.hijri}</Text>
          <Text style={styles.dateGregorian}>{today.gregorian}</Text>
          {today.salawat ? <Text style={styles.dateSalawat}>{today.salawat}</Text> : null}
        </>
      )}
    </View>
  );
}

export function SceneShell({
  variant,
  eyebrow,
  title,
  english,
  subtitle,
  heroLead,
  heroExtra,
  brandAccessory,
  children,
  onRefresh,
  refreshing = false,
}: SceneShellProps) {
  const p = useThemePalette();
  const styles = useMemo(() => shellStyles(p), [p]);
  const insets = useSafeAreaInsets();
  const gradient = heroColors(p, variant);

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
              colors={[p.gold]}
              onRefresh={onRefresh}
              refreshing={refreshing}
              tintColor={p.gold}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[...gradient]}
          end={{ x: 0.92, y: 1 }}
          start={{ x: 0.08, y: 0 }}
          style={[styles.hero, { paddingTop: Math.max(insets.top, 12) + 8 }]}
        >
          <OrnamentField count={variant === 'pulse' ? 20 : 16} />
          <View style={styles.brand}>
            <View style={styles.brandLockup}>
              <BrandMark />
              <View>
                <Text style={styles.brandAr}>عائلة الزيدان</Text>
                <Text style={styles.brandEn}>AL-ZIDAN</Text>
              </View>
            </View>
            {brandAccessory ?? <DateStamp />}
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
  const p = useThemePalette();
  const styles = useMemo(() => shellStyles(p), [p]);
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
