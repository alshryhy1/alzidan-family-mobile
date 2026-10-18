import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DataState } from '../components/DataState';
import { SceneShell } from '../components/scene';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import type { Branch, BranchEducationDegreeCounts, BranchWorkStatusCounts } from '../types';
import {
  emptyEducationDegreeCounts,
  emptyWorkStatusCounts,
  workStatusPercent,
} from '../utils/treeStats';

type BranchesScreenProps = {
  branches: Branch[];
  error: string | null;
  loading: boolean;
  onOpenTree: (branchKey: string) => void;
  onRetry: () => void;
};

type WorkTile = {
  key: keyof Pick<BranchWorkStatusCounts, 'employed' | 'retired' | 'unemployed'>;
  label: string;
};

type EducationTile = {
  key: keyof Pick<
    BranchEducationDegreeCounts,
    'intermediate' | 'secondary' | 'diploma' | 'bachelor' | 'master' | 'doctorate'
  >;
  label: string;
};

const WORK_TILES: WorkTile[] = [
  { key: 'employed', label: 'موظفون' },
  { key: 'retired', label: 'متقاعدون' },
  { key: 'unemployed', label: 'عاطلون' },
];

const EDUCATION_TILES: EducationTile[] = [
  { key: 'intermediate', label: 'متوسط' },
  { key: 'secondary', label: 'ثانوي' },
  { key: 'diploma', label: 'دبلوم' },
  { key: 'bachelor', label: 'بكالوريوس' },
  { key: 'master', label: 'ماجستير' },
  { key: 'doctorate', label: 'دكتوراه' },
];

function branchStyles(p: ThemePalette) {
  return StyleSheet.create({
    heroBlock: {
      alignItems: 'flex-end',
      gap: 4,
    },
    heroTotal: {
      color: p.goldSoft,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 36,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    heroMeta: {
      color: p.goldSoft,
      fontSize: 13,
      fontWeight: '700',
      opacity: 0.9,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    heroStatsBlock: {
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 8,
      width: '100%',
    },
    heroStatTitle: {
      color: p.goldSoft,
      fontSize: 12,
      fontWeight: '800',
      opacity: 0.85,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    heroPctRow: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'flex-end',
    },
    heroPctChip: {
      backgroundColor: 'rgba(196,163,90,0.14)',
      borderColor: 'rgba(196,163,90,0.4)',
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    heroPctText: {
      color: p.goldSoft,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
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
    sectionLabel: {
      color: p.greenMid,
      fontSize: 11,
      fontWeight: '800',
      marginTop: 2,
      opacity: 0.85,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    workRow: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    workTile: {
      alignItems: 'center',
      backgroundColor: 'rgba(196,163,90,0.1)',
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 14,
      borderWidth: 1,
      flexGrow: 1,
      flexBasis: '28%',
      gap: 2,
      minWidth: 84,
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
    eduTile: {
      alignItems: 'center',
      backgroundColor: 'rgba(27,94,64,0.06)',
      borderColor: 'rgba(27,94,64,0.22)',
      borderRadius: 14,
      borderWidth: 1,
      flexGrow: 1,
      flexBasis: '28%',
      gap: 2,
      minWidth: 84,
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
    workLabel: {
      color: p.greenMid,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    workValue: {
      color: p.green,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 26,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    workPct: {
      color: p.gold,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      writingDirection: 'rtl',
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

function WorkStatusTiles({
  living,
  workStatus,
  styles,
}: {
  living: number;
  workStatus?: BranchWorkStatusCounts;
  styles: ReturnType<typeof branchStyles>;
}) {
  const counts = workStatus || emptyWorkStatusCounts();
  const known = counts.employed + counts.retired + counts.unemployed;
  if (!living || known <= 0) return null;

  return (
    <View>
      <Text style={styles.sectionLabel}>الحالة الوظيفية</Text>
      <View style={styles.workRow}>
        {WORK_TILES.map((tile) => {
          const count = counts[tile.key];
          return (
            <View key={tile.key} style={styles.workTile}>
              <Text style={styles.workLabel}>{tile.label}</Text>
              <Text style={styles.workValue}>{count}</Text>
              <Text style={styles.workPct}>{workStatusPercent(count, living)}٪</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function sumEducation(branches: Branch[]): BranchEducationDegreeCounts {
  return branches.reduce((acc, branch) => {
    const c = branch.educationDegree || emptyEducationDegreeCounts();
    return {
      intermediate: acc.intermediate + c.intermediate,
      secondary: acc.secondary + c.secondary,
      diploma: acc.diploma + c.diploma,
      bachelor: acc.bachelor + c.bachelor,
      master: acc.master + c.master,
      doctorate: acc.doctorate + c.doctorate,
      unset: acc.unset + c.unset,
    };
  }, emptyEducationDegreeCounts());
}

function sumWorkStatus(branches: Branch[]): BranchWorkStatusCounts {
  return branches.reduce((acc, branch) => {
    const c = branch.workStatus || emptyWorkStatusCounts();
    return {
      employed: acc.employed + c.employed,
      retired: acc.retired + c.retired,
      unemployed: acc.unemployed + c.unemployed,
      unset: acc.unset + c.unset,
    };
  }, emptyWorkStatusCounts());
}

function EducationDegreeTiles({
  living,
  educationDegree,
  styles,
}: {
  living: number;
  educationDegree?: BranchEducationDegreeCounts;
  styles: ReturnType<typeof branchStyles>;
}) {
  const counts = educationDegree || emptyEducationDegreeCounts();
  const known =
    counts.intermediate +
    counts.secondary +
    counts.diploma +
    counts.bachelor +
    counts.master +
    counts.doctorate;
  if (!living || known <= 0) return null;

  return (
    <View>
      <Text style={styles.sectionLabel}>الدرجات العلمية</Text>
      <View style={styles.workRow}>
        {EDUCATION_TILES.map((tile) => {
          const count = counts[tile.key];
          return (
            <View key={tile.key} style={styles.eduTile}>
              <Text style={styles.workLabel}>{tile.label}</Text>
              <Text style={styles.workValue}>{count}</Text>
              <Text style={styles.workPct}>{workStatusPercent(count, living)}٪</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FamilyHeroPercents({
  living,
  workStatus,
  educationDegree,
  styles,
}: {
  living: number;
  workStatus: BranchWorkStatusCounts;
  educationDegree: BranchEducationDegreeCounts;
  styles: ReturnType<typeof branchStyles>;
}) {
  const workKnown = workStatus.employed + workStatus.retired + workStatus.unemployed;
  const eduKnown =
    educationDegree.intermediate +
    educationDegree.secondary +
    educationDegree.diploma +
    educationDegree.bachelor +
    educationDegree.master +
    educationDegree.doctorate;
  if (!living || (workKnown <= 0 && eduKnown <= 0)) return null;

  return (
    <View style={styles.heroStatsBlock}>
      {workKnown > 0 ? (
        <View style={{ alignItems: 'flex-end', gap: 6, width: '100%' }}>
          <Text style={styles.heroStatTitle}>الحالة الوظيفية · نسب من الأحياء</Text>
          <View style={styles.heroPctRow}>
            {WORK_TILES.map((tile) => (
              <View key={tile.key} style={styles.heroPctChip}>
                <Text style={styles.heroPctText}>
                  {tile.label} {workStatusPercent(workStatus[tile.key], living)}٪
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {eduKnown > 0 ? (
        <View style={{ alignItems: 'flex-end', gap: 6, width: '100%' }}>
          <Text style={styles.heroStatTitle}>الشهادات · نسب من الأحياء</Text>
          <View style={styles.heroPctRow}>
            {EDUCATION_TILES.map((tile) => (
              <View key={tile.key} style={styles.heroPctChip}>
                <Text style={styles.heroPctText}>
                  {tile.label} {workStatusPercent(educationDegree[tile.key], living)}٪
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
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
  const totalLiving = useMemo(
    () => branches.reduce((sum, branch) => sum + (branch.membersCount || 0), 0),
    [branches],
  );
  const familyWork = useMemo(() => sumWorkStatus(branches), [branches]);
  const familyEducation = useMemo(() => sumEducation(branches), [branches]);

  return (
    <SceneShell
      english="FAMILY HOUSES"
      eyebrow="بيوت العائلة"
      heroExtra={
        !loading && branches.length ? (
          <View style={styles.heroBlock}>
            <Text style={styles.heroTotal}>{totalLiving} في الشجرة</Text>
            <Text style={styles.heroMeta}>
              عائلة مطلق الزيدان · {branches.length} فروع
            </Text>
            <FamilyHeroPercents
              educationDegree={familyEducation}
              living={totalLiving}
              styles={styles}
              workStatus={familyWork}
            />
          </View>
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
              <WorkStatusTiles
                living={branch.membersCount}
                styles={styles}
                workStatus={branch.workStatus}
              />
              <EducationDegreeTiles
                educationDegree={branch.educationDegree}
                living={branch.membersCount}
                styles={styles}
              />
              <Text style={styles.enter}>عرض شجرة فرع {branch.name}</Text>
            </Pressable>
          ))
        : null}
    </SceneShell>
  );
}
