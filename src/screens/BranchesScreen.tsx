import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DataState } from '../components/DataState';
import { SceneShell } from '../components/scene';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import type { Branch } from '../types';

type BranchesScreenProps = {
  branches: Branch[];
  error: string | null;
  loading: boolean;
  onOpenTree: (branchKey: string) => void;
  onRetry: () => void;
};

function branchStyles(p: ThemePalette) {
  return StyleSheet.create({
    heroCount: {
      color: p.goldSoft,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    house: {
      backgroundColor: p.creamLift,
      borderColor: 'rgba(196,163,90,0.45)',
      borderRadius: 28,
      borderWidth: 1,
      gap: spacing.sm,
      overflow: 'hidden',
      padding: spacing.lg,
    },
    houseHead: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
    },
    houseIndex: {
      color: p.gold,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },
    houseMark: {
      color: p.gold,
      fontSize: 16,
    },
    houseName: {
      color: p.green,
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 34,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    houseSummary: {
      color: p.ink,
      fontSize: typography.body,
      lineHeight: 24,
      opacity: 0.78,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    houseMetrics: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: spacing.xs,
    },
    metric: {
      color: p.greenMid,
      fontSize: typography.caption,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    dot: {
      color: p.gold,
    },
    enter: {
      color: p.gold,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    pressed: {
      opacity: 0.78,
    },
  });
}

export function BranchesScreen({
  branches,
  error,
  loading,
  onOpenTree,
  onRetry,
}: BranchesScreenProps) {
  const p = useThemePalette();
  const styles = useMemo(() => branchStyles(p), [p]);
  return (
    <SceneShell
      english="FAMILY HOUSES"
      eyebrow="بيوت العائلة"
      heroExtra={
        !loading && branches.length ? (
          <Text style={styles.heroCount}>{branches.length} فروع مسجّلة في الشجرة</Text>
        ) : null
      }
      onRefresh={onRetry}
      refreshing={loading}
      subtitle="كل فرع مكان قائم بذاته — ادخل شجرته من هنا."
      title="الفروع"
      variant="houses"
    >
      <DataState
        empty={!branches.length}
        emptyText="لا توجد فروع مسجلة حاليًا."
        error={error}
        loading={loading}
        onRetry={onRetry}
      />

      {!loading && !error
        ? branches.map((branch, index) => (
            <Pressable
              key={branch.id}
              onPress={() => onOpenTree(branch.id)}
              style={({ pressed }) => [styles.house, pressed && styles.pressed]}
            >
              <View style={styles.houseHead}>
                <Text style={styles.houseIndex}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.houseMark}>❖</Text>
              </View>
              <Text style={styles.houseName}>{branch.fullName || branch.name}</Text>
              {branch.summary ? <Text style={styles.houseSummary}>{branch.summary}</Text> : null}
              <View style={styles.houseMetrics}>
                <Text style={styles.metric}>{branch.familiesCount} بيوت</Text>
                <Text style={styles.dot}>✦</Text>
                <Text style={styles.metric}>{branch.membersCount} في الشجرة</Text>
              </View>
              <Text style={styles.enter}>عرض شجرة فرع {branch.name}</Text>
            </Pressable>
          ))
        : null}
    </SceneShell>
  );
}
