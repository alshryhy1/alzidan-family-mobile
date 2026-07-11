import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchApprovedMemoryItems, type MemoryItem } from '../services/memory';
import { personDisplayName, searchAllBranches } from '../services/treeSearch';
import { colors, spacing, typography } from '../theme';
import { matchesSearchQuery } from '../utils/searchText';
import type { Branch, FamilyEvent, TreeChild, TreeParent } from '../types';

type GlobalSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  branches: Branch[];
  childrenRows: TreeChild[];
  parents: TreeParent[];
  events: FamilyEvent[];
  onOpenTree: (branchKey: string, treeChildId: number) => void;
  onOpenEvents: () => void;
  onOpenMemory: () => void;
};

function eventCategoryLabel(category: FamilyEvent['category']) {
  if (category === 'happy') return 'أفراح';
  if (category === 'health') return 'مرضى';
  return 'تعازي';
}

export function GlobalSearchModal({
  visible,
  onClose,
  branches,
  childrenRows,
  parents,
  events,
  onOpenTree,
  onOpenEvents,
  onOpenMemory,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }

    let alive = true;
    setMemoryLoading(true);

    fetchApprovedMemoryItems()
      .then((rows) => {
        if (alive) setMemoryItems(rows);
      })
      .catch(() => {
        if (alive) setMemoryItems([]);
      })
      .finally(() => {
        if (alive) setMemoryLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [visible]);

  const treeResults = useMemo(
    () => searchAllBranches(branches, parents, childrenRows, query, 20),
    [branches, childrenRows, parents, query],
  );

  const eventResults = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    return events
      .filter((event) =>
        matchesSearchQuery(
          [event.title, event.person, event.details, event.branch, event.categoryLabel, event.hospitalName],
          trimmed,
        ),
      )
      .slice(0, 12);
  }, [events, query]);

  const memoryResults = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    return memoryItems
      .filter((item) =>
        matchesSearchQuery(
          [item.personName, item.title, item.description, item.storyText, item.personLineage, item.branchKey],
          trimmed,
        ),
      )
      .slice(0, 12);
  }, [memoryItems, query]);

  const hasQuery = query.trim().length >= 2;
  const hasResults = treeResults.length > 0 || eventResults.length > 0 || memoryResults.length > 0;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>بحث في التطبيق</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>إغلاق</Text>
            </Pressable>
          </View>

          <TextInput
            autoCorrect={false}
            autoFocus
            onChangeText={setQuery}
            placeholder="ابحث عن شخص، مناسبة، أو ذكرى"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.input}
            textAlign="right"
            value={query}
          />

          <ScrollView
            contentContainerStyle={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!hasQuery ? (
              <Text style={styles.hint}>اكتب حرفين على الأقل للبحث في الشجرة والمناسبات ومن الذاكرة.</Text>
            ) : null}

            {hasQuery && !hasResults && !memoryLoading ? (
              <Text style={styles.empty}>لا توجد نتائج مطابقة.</Text>
            ) : null}

            {treeResults.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>الشجرة</Text>
                {treeResults.map((result) => (
                  <Pressable
                    key={`tree-${result.person.id}-${result.path.map((item) => item.id).join('-')}`}
                    onPress={() => {
                      onOpenTree(result.branchKey, Number(result.person.id));
                      onClose();
                    }}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.resultTitle}>{personDisplayName(result.person)}</Text>
                    <Text numberOfLines={2} style={styles.resultMeta}>
                      {`${result.branchName} · ${result.path.map(personDisplayName).join(' ‹ ')}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {eventResults.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>المناسبات</Text>
                {eventResults.map((event) => (
                  <Pressable
                    key={`event-${event.id}`}
                    onPress={() => {
                      onOpenEvents();
                      onClose();
                    }}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.resultTitle}>{event.title || event.person}</Text>
                    <Text numberOfLines={2} style={styles.resultMeta}>
                      {[eventCategoryLabel(event.category), event.branch, event.person, event.date]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {memoryResults.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>من الذاكرة</Text>
                {memoryResults.map((item) => (
                  <Pressable
                    key={`memory-${item.id}`}
                    onPress={() => {
                      onOpenMemory();
                      onClose();
                    }}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.resultTitle}>{item.title || item.personName}</Text>
                    <Text numberOfLines={2} style={styles.resultMeta}>
                      {[item.personName, item.branchKey].filter(Boolean).join(' · ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {hasQuery && memoryLoading && !memoryResults.length ? (
              <Text style={styles.hint}>جاري تحميل نتائج من الذاكرة...</Text>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 41, 37, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  closeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
  results: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  empty: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  resultRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
  resultTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
