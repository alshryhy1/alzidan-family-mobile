import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { DataState } from '../components/DataState';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing, typography } from '../theme';
import type { Branch } from '../types';

type BranchesScreenProps = {
  branches: Branch[];
  error: string | null;
  loading: boolean;
  onOpenTree: (branchKey: string) => void;
  onRetry: () => void;
};

export function BranchesScreen({
  branches,
  error,
  loading,
  onOpenTree,
  onRetry,
}: BranchesScreenProps) {
  return (
    <Screen
      title="فروع العائلة"
      description="الفروع الرئيسية المسجلة في قاعدة العائلة."
      onRefresh={onRetry}
      refreshing={loading}
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
            <SectionCard key={branch.id} eyebrow={`الفرع ${index + 1}`} title={branch.fullName}>
              <Text style={styles.summary}>{branch.summary}</Text>
              <View style={styles.metrics}>
                <Text style={styles.metric}>{branch.familiesCount} بيوت</Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.metric}>{branch.membersCount} اسمًا</Text>
              </View>
              <ActionButton
                label={`عرض شجرة فرع ${branch.name}`}
                onPress={() => onOpenTree(branch.id)}
                variant="secondary"
              />
            </SectionCard>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metrics: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.xs,
    justifyContent: 'flex-start',
  },
  metric: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  dot: {
    color: colors.accent,
  },
});
