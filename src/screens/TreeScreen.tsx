import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DataState } from '../components/DataState';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';
import type { Branch, TreeChild, TreeParent, TreePerson } from '../types';

type TreeScreenProps = {
  branchKey: string | null;
  branches: Branch[];
  childrenRows: TreeChild[];
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  onSelectBranch: (branchKey: string) => void;
  parents: TreeParent[];
  focusedTreeChildId?: number | null;
};


function parseYear(value?: string | null) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{3,4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function isApproximateDate(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  return /تقريب|تقريبا|تقريبًا|حوالي/.test(raw);
}

function currentHijriYear() {
  return Number(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' }).format(new Date()).replace(/\D/g, ''));
}

function ageFromYears(startYear: number | null, endYear: number | null) {
  if (!startYear || !endYear) return null;
  const age = endYear - startYear;
  if (!Number.isFinite(age) || age < 0 || age > 130) return null;
  return age;
}

function calculatePersonAge(person: {
  birthDateGregorian?: string | null;
  birthDateHijri?: string | null;
  birthYear?: number | null;
  deathDateGregorian?: string | null;
  deathDateHijri?: string | null;
  isDeceased?: boolean | null;
}) {
  const isDeceased = person.isDeceased === true;

  const birthG = parseYear(person.birthDateGregorian);
  const deathG = parseYear(person.deathDateGregorian);
  if (birthG) {
    const end = isDeceased && deathG ? deathG : new Date().getFullYear();
    const age = ageFromYears(birthG, end);
    if (age != null) return { label: isDeceased ? 'العمر عند الوفاة' : 'العمر', value: `${age} سنة` };
  }

  const birthH = parseYear(person.birthDateHijri) || person.birthYear || null;
  const deathH = parseYear(person.deathDateHijri);
  if (birthH) {
    const end = isDeceased && deathH ? deathH : currentHijriYear();
    const age = ageFromYears(birthH, end);
    if (age != null) {
      const approximate = isApproximateDate(person.birthDateHijri) || !person.birthDateHijri;
      if (isDeceased) {
        return { label: approximate ? 'العمر التقريبي عند الوفاة' : 'العمر عند الوفاة', value: `${age} سنة` };
      }
      return { label: approximate ? 'العمر التقريبي' : 'العمر', value: `${age} سنة` };
    }
  }

  return null;
}

function personMeta(row: TreeChild) {
  const parts = [row.city, row.area].filter(Boolean);
  if (row.isDeceased === true) parts.push('رحمه الله');
  return parts.join(' · ');
}

function displayPersonName(value: string) {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || value;
}

function cleanNameSuffix(value: string) {
  return value.replace(/\s*رحمه الله\s*/g, '').replace(/\s*\(رحمه الله\)\s*/g, '').trim();
}

function compactLineageName(value: string) {
  const parts = value
    .split('/')
    .map((part) => cleanNameSuffix(part.trim()))
    .filter(Boolean)
    .slice(-3)
    .reverse();

  const uniqueOrdered = parts.filter((part, index) => {
    if (index === 0) return true;
    return part !== parts[index - 1];
  });

  return uniqueOrdered.length ? uniqueOrdered.join(' بن ') : cleanNameSuffix(value);
}

function personDisplayName(person: Pick<TreePerson, 'name' | 'fullName' | 'isDeceased'>) {
  const base = compactLineageName(person.fullName || person.name);
  return person.isDeceased === true ? `${base} رحمه الله` : base;
}

const curatedChildOrders: Record<string, string[]> = {
  'مزيد بن مطلق بن زيدان/صلف/دوخي/سالم': [
    'دوخي',
    'حضيري',
    'عبدالله',
    'عبيد',
    'زيد',
    'مبارك',
  ],
};

function sortChildren(parentName: string, children: TreeChild[]) {
  const order = curatedChildOrders[parentName];
  const position = new Map((order ?? []).map((name, index) => [name, index]));
  return [...children].sort((left, right) => {
    if (left.birthOrder != null || right.birthOrder != null) {
      if (left.birthOrder == null) return 1;
      if (right.birthOrder == null) return -1;
      if (left.birthOrder !== right.birthOrder) return left.birthOrder - right.birthOrder;
    }

    const leftBirthDate = left.birthDateGregorian ?? left.birthDateHijri;
    const rightBirthDate = right.birthDateGregorian ?? right.birthDateHijri;
    if (leftBirthDate || rightBirthDate) {
      if (!leftBirthDate) return 1;
      if (!rightBirthDate) return -1;
      const dateComparison = leftBirthDate.localeCompare(rightBirthDate);
      if (dateComparison !== 0) return dateComparison;
    }

    const leftName = displayPersonName(left.name).replace(' وزيد', '');
    const rightName = displayPersonName(right.name).replace(' وزيد', '');
    const leftPosition = position.get(leftName) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = position.get(rightName) ?? Number.MAX_SAFE_INTEGER;
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;
    return left.id - right.id;
  });
}

function buildBranchTree(
  branch: Branch | undefined,
  parents: TreeParent[],
  childrenRows: TreeChild[],
): TreePerson | null {
  if (!branch) return null;

  const branchParents = parents.filter((parent) => parent.branchKey === branch.id);
  const branchChildren = childrenRows.filter((child) => child.branchKey === branch.id);
  const byParent = new Map<string, TreeChild[]>();

  branchChildren.forEach((child) => {
    const current = byParent.get(child.parentName) ?? [];
    current.push(child);
    byParent.set(child.parentName, current);
  });

  const knownChildren = new Set(branchChildren.map((child) => child.name));
  const rootCandidates = branchParents.length
    ? branchParents.map((parent) => parent.name)
    : Array.from(byParent.keys()).filter((name) => !knownChildren.has(name));

  const rootName = rootCandidates
    .map((name) => ({
      name,
      score: branchChildren.filter(
        (child) => child.parentName === name || child.name.startsWith(`${name}/`),
      ).length,
    }))
    .sort((left, right) => right.score - left.score)[0]?.name;

  const buildChildren = (parentName: string, visited: Set<string>): TreePerson[] => {
    if (visited.has(parentName)) return [];
    const nextVisited = new Set(visited).add(parentName);
    return sortChildren(parentName, byParent.get(parentName) ?? []).map((child) => ({
      id: String(child.id),
      name: displayPersonName(child.name),
      fullName: child.name,
      birthOrder: child.birthOrder,
      birthDateGregorian: child.birthDateGregorian,
      birthDateHijri: child.birthDateHijri,
      birthYear: child.birthYear,
      deathDateGregorian: child.deathDateGregorian,
      deathDateHijri: child.deathDateHijri,
      city: child.city,
      area: child.area,
      isDeceased: child.isDeceased,
      meta: personMeta(child),
      children: buildChildren(child.name, nextVisited),
    }));
  };

  if (!rootName) return null;

  return {
    id: `root-${branch.id}`,
    name: displayPersonName(rootName),
    fullName: rootName,
    meta: `${branch.membersCount} سجلًا`,
    children: buildChildren(rootName, new Set()),
  };
}

type SearchResult = {
  branchKey: string;
  branchName: string;
  path: TreePerson[];
  person: TreePerson;
};

function collectSearchResults(tree: TreePerson | null, branchKey: string, branchName: string) {
  const results: SearchResult[] = [];

  const visit = (person: TreePerson, path: TreePerson[]) => {
    const nextPath = [...path, person];
    results.push({ branchKey, branchName, path: nextPath, person });
    person.children?.forEach((child) => visit(child, nextPath));
  };

  if (tree) visit(tree, []);
  return results;
}

export function TreeScreen({
  branchKey,
  branches,
  childrenRows,
  error,
  loading,
  onRetry,
  onSelectBranch,
  parents,
  focusedTreeChildId,
}: TreeScreenProps) {
  const branch = branches.find((item) => item.id === branchKey);
  const tree = useMemo(
    () => buildBranchTree(branch, parents, childrenRows),
    [branch, childrenRows, parents],
  );
  const allBranchTrees = useMemo(
    () =>
      branches
        .map((item) => ({
          branch: item,
          tree: buildBranchTree(item, parents, childrenRows),
        }))
        .filter((item): item is { branch: Branch; tree: TreePerson } => Boolean(item.tree)),
    [branches, childrenRows, parents],
  );
  const [trail, setTrail] = useState<TreePerson[]>([]);
  const [pendingTrail, setPendingTrail] = useState<TreePerson[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (pendingTrail && tree && pendingTrail[0]?.id === tree.id) {
      setTrail(pendingTrail);
      setPendingTrail(null);
      setSearchQuery('');
      return;
    }

    if (focusedTreeChildId && tree) {
      const match = collectSearchResults(tree, branch?.id ?? '', branch?.name ?? '').find(
        (result) => Number(result.person.id) === Number(focusedTreeChildId),
      );
      if (match) {
        setTrail(match.path);
        setSearchQuery('');
        return;
      }
    }

    setTrail(tree ? [tree] : []);
    setSearchQuery('');
  }, [branch?.id, branch?.name, focusedTreeChildId, pendingTrail, tree]);

  const currentPerson = trail.at(-1) ?? null;
  const directChildren = currentPerson?.children ?? [];
  const canGoBack = trail.length > 1;
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query || query.length < 2) return [];

    return allBranchTrees
      .flatMap((item) => collectSearchResults(item.tree, item.branch.id, item.branch.name))
      .filter((result) => {
        if (result.path.length <= 1) return false;
        const haystack = [
          result.branchName,
          result.person.name,
          result.person.fullName,
          result.person.meta,
          result.path.map((item) => item.name).join(' '),
        ]
          .filter(Boolean)
          .join(' ');
        return haystack.includes(query);
      })
      .slice(0, 40);
  }, [allBranchTrees, searchQuery]);

  const openPerson = (person: TreePerson) => {
    setTrail((current) => [...current, person]);
  };

  const goBack = () => {
    setTrail((current) => (current.length > 1 ? current.slice(0, -1) : current));
  };

  const openSearchResult = (result: SearchResult) => {
    if (result.branchKey !== branchKey) {
      setPendingTrail(result.path);
      onSelectBranch(result.branchKey);
      return;
    }

    setTrail(result.path);
    setSearchQuery('');
  };

  const lineage = trail.map((person) => person.name);
  const lineageDisplay = trail
    .map(personDisplayName)
    .filter((item, index, arr) => (index === 0 ? true : item !== arr[index - 1]))
    .join(' ‹ ');
  const parentPerson = trail.length > 1 ? trail[trail.length - 2] : null;
  const detailRows = currentPerson
    ? [
        currentPerson.birthOrder
          ? { label: 'ترتيب الميلاد', value: String(currentPerson.birthOrder) }
          : null,
        currentPerson.birthDateHijri
          ? { label: 'الميلاد الهجري', value: currentPerson.birthDateHijri }
          : null,
        currentPerson.birthDateGregorian
          ? { label: 'الميلاد الميلادي', value: currentPerson.birthDateGregorian }
          : null,
        calculatePersonAge(currentPerson),
        currentPerson.deathDateHijri
          ? { label: 'الوفاة الهجرية', value: currentPerson.deathDateHijri }
          : null,
        currentPerson.deathDateGregorian
          ? { label: 'الوفاة الميلادية', value: currentPerson.deathDateGregorian }
          : null,
        !currentPerson.birthDateGregorian && !currentPerson.birthDateHijri && currentPerson.birthYear
          ? { label: 'سنة الميلاد التقريبية', value: String(currentPerson.birthYear) }
          : null,
        currentPerson.city ? { label: 'المدينة', value: currentPerson.city } : null,
        currentPerson.area ? { label: 'الحي / القرية', value: currentPerson.area } : null,
        currentPerson.isDeceased === true
          ? { label: 'الحالة', value: 'متوفى، رحمه الله' }
          : null,
        { label: 'عدد الأبناء', value: String(directChildren.length) },
      ].filter((row): row is { label: string; value: string } => Boolean(row))
    : [];

  return (
    <Screen
      title="شجرة العائلة"
      description="شجرة للقراءة فقط من قاعدة البيانات المعتمدة. اختر فرعًا لعرضه."
      onRefresh={onRetry}
      refreshing={loading}
    >
      <View style={styles.branchPicker}>
        {branches.map((item) => {
          const active = item.id === branchKey;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelectBranch(item.id)}
              style={[styles.branchChip, active && styles.activeBranchChip]}
            >
              <Text style={[styles.branchChipText, active && styles.activeBranchChipText]}>
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!loading && !error && tree ? (
        <View style={styles.searchBox}>
          <TextInput
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder="ابحث في جميع الفروع"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
            textAlign="right"
            value={searchQuery}
          />
          {searchQuery.trim().length >= 2 ? (
            <View style={styles.searchResults}>
              {searchResults.length ? (
                searchResults.map((result) => (
                  <Pressable
                    key={`${result.person.id}-${result.path.map((item) => item.id).join('-')}`}
                    onPress={() => openSearchResult(result)}
                    style={({ pressed }) => [
                      styles.searchResult,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.searchResultName}>{personDisplayName(result.person)}</Text>
                    <Text numberOfLines={2} style={styles.searchResultPath}>
                      {`${result.branchName} · ${result.path.map(personDisplayName).join(' ‹ ')}`}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.searchEmpty}>لا يوجد اسم مطابق في هذا الفرع.</Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <DataState
        empty={!tree || !tree.children?.length}
        emptyText="لا توجد بيانات شجرة مسجلة لهذا الفرع."
        error={error}
        loading={loading}
        onRetry={onRetry}
      />

      {!loading && !error && currentPerson ? (
        <View style={styles.level}>
          {canGoBack ? (
            <Pressable onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backButtonText}>الرجوع إلى {personDisplayName(trail[trail.length - 2])}</Text>
              <Text style={styles.backArrow}>‹</Text>
            </Pressable>
          ) : null}

          <View style={styles.currentPerson}>
            <Text style={styles.currentEyebrow}>{canGoBack ? 'الجيل الحالي' : 'الفرع الحالي'}</Text>
            <Text style={styles.currentName}>{personDisplayName(currentPerson)}</Text>
            {currentPerson.meta ? <Text style={styles.currentMeta}>{currentPerson.meta}</Text> : null}
            <Text style={styles.childrenCount}>
              {directChildren.length ? `${directChildren.length} من الأبناء` : 'لا يوجد أبناء مسجلون'}
            </Text>
          </View>

          {canGoBack ? (
            <View style={styles.detailsCard}>
              <Text style={styles.detailsEyebrow}>تفاصيل الشخص</Text>
              <Text style={styles.lineageLabel}>مسار النسب</Text>
              <Text style={styles.lineageText}>{lineageDisplay}</Text>

              <View style={styles.detailRows}>
                {detailRows.map((row) => (
                  <View key={row.label} style={styles.detailRow}>
                    <Text style={styles.detailValue}>{row.value}</Text>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                  </View>
                ))}
              </View>

              {parentPerson ? (
                <Pressable
                  onPress={goBack}
                  style={({ pressed }) => [
                    styles.parentButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.parentButtonText}>العودة إلى الأب: {personDisplayName(parentPerson)}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {directChildren.length ? (
            <View style={styles.directChildren}>
              <Text style={styles.sectionTitle}>الأبناء المباشرون</Text>
              {directChildren.map((child) => {
                const hasDescendants = Boolean(child.children?.length);
                return (
                  <Pressable
                    key={child.id}
                    onPress={() => openPerson(child)}
                    style={({ pressed }) => [styles.childCard, pressed && styles.pressed]}
                  >
                    <View style={styles.nodeText}>
                      <Text style={styles.nodeName}>{personDisplayName(child)}</Text>
                      {child.meta ? <Text style={styles.nodeMeta}>{child.meta}</Text> : null}
                      <Text style={styles.descendantsText}>
                        {hasDescendants
                          ? `${child.children?.length ?? 0} من الأبناء · اضغط للعرض`
                          : 'اضغط لعرض التفاصيل'}
                      </Text>
                    </View>
                    <Text style={styles.nodeControl}>‹</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  branchPicker: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  branchChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeBranchChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  branchChipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  activeBranchChipText: {
    color: colors.white,
  },
  searchBox: {
    gap: spacing.xs,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
  searchResults: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResult: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchResultName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  searchResultPath: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  searchEmpty: {
    color: colors.textMuted,
    fontSize: typography.caption,
    padding: spacing.md,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  level: {
    gap: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  backArrow: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  currentPerson: {
    backgroundColor: colors.primaryDark,
    borderRadius: 24,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  currentEyebrow: {
    color: '#DABF8A',
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentName: {
    color: colors.white,
    fontSize: typography.heading,
    fontWeight: '900',
    lineHeight: 32,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentMeta: {
    color: '#DCE8E3',
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  childrenCount: {
    color: '#DABF8A',
    fontSize: typography.caption,
    fontWeight: '800',
    marginTop: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  detailsEyebrow: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  lineageLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  lineageText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailRows: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  parentButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  parentButtonText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  directChildren: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  childCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderRightColor: colors.accent,
    borderRightWidth: 4,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    minWidth: 0,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  nodeText: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
    minWidth: 0,
  },
  nodeName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  nodeMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  descendantsText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  nodeControl: {
    color: colors.primary,
    flexShrink: 0,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    width: 24,
  },
});
