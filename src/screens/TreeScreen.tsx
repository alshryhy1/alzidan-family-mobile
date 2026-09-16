import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DataState } from '../components/DataState';
import { PersonPhoto } from '../components/PersonPhoto';
import { SceneShell } from '../components/scene';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Branch, TreeChild, TreeParent, TreePerson } from '../types';
import {
  getBranchRootName,
  groupChildrenRows,
  normalizePersonName,
} from '../utils/groupChildrenRows';
import { isPublicLineageHiddenPerson } from '../utils/personVisibility';

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
  onOpenEncounter?: (branchKey: string, treeChildId: number) => void;
  onBackToHouses?: () => void;
  includePubliclyHiddenPeople?: boolean;
};

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

function leafName(person: TreePerson) {
  return displayPersonName(person.fullName || person.name);
}

function outlineName(person: TreePerson, parent?: TreePerson | null) {
  const leaf = leafName(person);
  const father = parent ? leafName(parent) : '';
  const nasab = father ? `${leaf} بن ${father}` : leaf;
  return person.isDeceased === true ? `${nasab} رحمه الله` : nasab;
}

function brotherLine(person: TreePerson, parent: TreePerson | null) {
  const names = (parent?.children ?? [])
    .filter((child) => child.id !== person.id)
    .map((child) => leafName(child));
  if (!names.length) return '';
  if (names.length === 1) return `أخو ${names[0]}`;
  if (names.length === 2) return `أخو ${names[0]} و${names[1]}`;
  return `أخو ${names[0]} و${names[1]} و${names.length - 2} آخرين`;
}

function descendantCount(person: TreePerson): number {
  return (person.children ?? []).reduce((sum, child) => sum + 1 + descendantCount(child), 0);
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
  includePubliclyHidden?: boolean,
): TreePerson | null {
  if (!branch) return null;

  const branchParents = parents.filter((parent) => parent.branchKey === branch.id);
  const branchChildren = childrenRows.filter(
    (child) =>
      child.branchKey === branch.id &&
      (includePubliclyHidden || !isPublicLineageHiddenPerson(child)),
  );
  const byParent = groupChildrenRows(branchChildren, branch.id, { includePubliclyHidden });

  const branchRoot = getBranchRootName(branch.id);
  const knownChildren = new Set(
    Array.from(byParent.values())
      .flat()
      .map((child) => normalizePersonName(child.name)),
  );

  const rootCandidates = [
    ...(branchRoot ? [branchRoot] : []),
    ...branchParents.map((parent) => normalizePersonName(parent.name)),
    ...Array.from(byParent.keys()).filter((name) => !knownChildren.has(name)),
  ].filter(Boolean);

  const uniqueRoots = Array.from(new Set(rootCandidates.map((name) => normalizePersonName(name))));

  const rootName = uniqueRoots
    .map((name) => ({
      name,
      score: (byParent.get(name) ?? []).length,
    }))
    .sort((left, right) => right.score - left.score)[0]?.name;

  const buildChildren = (parentName: string, visited: Set<string>): TreePerson[] => {
    const parentKey = normalizePersonName(parentName);
    if (!parentKey || visited.has(parentKey)) return [];
    const nextVisited = new Set(visited).add(parentKey);

    return sortChildren(parentKey, byParent.get(parentKey) ?? []).filter((child) => {
      const childPath = normalizePersonName(child.name);
      if (!childPath.includes('/') || !parentKey.includes('/')) return true;
      const prefix = `${parentKey}/`;
      if (!childPath.startsWith(prefix)) return false;
      return !childPath.slice(prefix.length).includes('/');
    }).map((child) => ({
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
      photoUrl: child.photoUrl || null,
      meta: personMeta(child),
      children: buildChildren(child.name, nextVisited),
    }));
  };

  if (!rootName) return null;

  return {
    id: `root-${branch.id}`,
    name: displayPersonName(rootName),
    fullName: rootName,
    meta: `${branch.membersCount} في الشجرة`,
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

function OutlineNode({
  person,
  parent,
  depth,
  highlightedId,
  onOpenPerson,
  styles,
}: {
  person: TreePerson;
  parent: TreePerson | null;
  depth: number;
  highlightedId: string | null;
  onOpenPerson: (person: TreePerson) => void;
  styles: Record<string, object>;
}) {
  const kids = person.children ?? [];
  const inLineage = descendantCount(person);
  const brothers = brotherLine(person, parent);
  const highlighted = String(person.id) === String(highlightedId);
  const canOpen = Number.isFinite(Number(person.id));

  return (
    <View>
      <Pressable
        accessibilityRole={canOpen ? 'button' : undefined}
        onPress={canOpen ? () => onOpenPerson(person) : undefined}
        style={({ pressed }) => [
          styles.outlineRow,
          depth === 0 && styles.outlineRoot,
          highlighted && styles.outlineHighlight,
          pressed && canOpen && styles.pressed,
        ]}
      >
        <View style={styles.nodeText}>
          <View style={styles.nodeNameRow}>
            <PersonPhoto name={person.name} size="sm" uri={person.photoUrl} />
            <Text style={[styles.nodeName, depth === 0 && styles.nodeNameRoot]}>
              {outlineName(person, parent)}
            </Text>
          </View>
          {parent ? (
            <Text style={styles.kinLine}>
              {`ابن ${leafName(parent)}`}
              {brothers ? ` · ${brothers}` : ''}
            </Text>
          ) : null}
          {inLineage ? (
            <Text style={styles.descendantsText}>
              {kids.length} أبناء
              {inLineage > kids.length ? ` · ${inLineage} في السلالة` : ''}
            </Text>
          ) : person.meta && depth === 0 ? (
            <Text style={styles.nodeMeta}>{person.meta}</Text>
          ) : null}
        </View>
      </Pressable>
      {kids.length ? (
        <View style={styles.childrenBlock}>
          <Text style={styles.childrenHeading}>أبناء {leafName(person)}</Text>
          {kids.map((child) => (
            <OutlineNode
              key={child.id}
              depth={depth + 1}
              highlightedId={highlightedId}
              onOpenPerson={onOpenPerson}
              parent={person}
              person={child}
              styles={styles}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
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
  onOpenEncounter,
  onBackToHouses,
  includePubliclyHiddenPeople = false,
}: TreeScreenProps) {
  const p = useThemePalette();
  const styles = useThemedStyles(treeStyles);
  const branch = branches.find((item) => item.id === branchKey);
  const tree = useMemo(
    () => buildBranchTree(branch, parents, childrenRows, includePubliclyHiddenPeople),
    [branch, childrenRows, parents, includePubliclyHiddenPeople],
  );
  const allBranchTrees = useMemo(
    () =>
      branches
        .map((item) => ({
          branch: item,
          tree: buildBranchTree(item, parents, childrenRows, includePubliclyHiddenPeople),
        }))
        .filter((item): item is { branch: Branch; tree: TreePerson } => Boolean(item.tree)),
    [branches, childrenRows, parents, includePubliclyHiddenPeople],
  );
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (focusedTreeChildId != null) {
      setHighlightedId(String(focusedTreeChildId));
      setSearchQuery('');
    }
  }, [branch?.id, focusedTreeChildId]);

  const peopleInBranch = tree ? descendantCount(tree) : 0;

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

  const openSearchResult = (result: SearchResult) => {
    setSearchQuery('');
    setHighlightedId(String(result.person.id));
    if (result.branchKey !== branchKey) {
      onSelectBranch(result.branchKey);
    }
  };

  const openPersonCard = (person: TreePerson) => {
    const id = Number(person.id);
    if (!onOpenEncounter || !branchKey || !Number.isFinite(id)) return;
    onOpenEncounter(branchKey, id);
  };

  return (
    <SceneShell
      english="FAMILY TREE"
      eyebrow="تسلسل العائلة"
      heroExtra={
        branch && tree ? (
          <View style={styles.heroPerson}>
            <Text style={styles.heroEyebrow}>أصل الفرع</Text>
            <Text style={styles.heroName}>{branch.fullName || branch.name}</Text>
            <Text style={styles.heroCount}>
              {peopleInBranch ? `${peopleInBranch} في الشجرة · الكل في هذه الصفحة` : 'لا يوجد أبناء مسجلون'}
            </Text>
          </View>
        ) : (
          <Text style={styles.heroInvite}>اختر فرعًا لتفتح تسلسله.</Text>
        )
      }
      onRefresh={onRetry}
      refreshing={loading}
      subtitle="الفرع كامل أمامك. التمرير يكفي، والضغط يفتح اللقاء."
      title="الشجرة"
      variant="lineage"
    >
      {onBackToHouses ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBackToHouses}
          style={({ pressed }) => [styles.housesBack, pressed && styles.pressed]}
        >
          <Text style={styles.housesBackText}>رجوع إلى الفروع</Text>
        </Pressable>
      ) : null}

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
            placeholderTextColor={p.textMuted}
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
                    style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}
                  >
                    <View style={styles.searchResultRow}>
                      <PersonPhoto name={result.person.name} size="sm" uri={result.person.photoUrl} />
                      <Text style={styles.searchResultName}>{personDisplayName(result.person)}</Text>
                    </View>
                    <Text numberOfLines={2} style={styles.searchResultPath}>
                      {`${result.branchName} · ${result.path.map(outlineName).join(' ‹ ')}`}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.searchEmpty}>لا يوجد اسم مطابق.</Text>
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

      {!loading && !error && tree ? (
        <View style={styles.outline}>
          <OutlineNode
            depth={0}
            highlightedId={highlightedId}
            onOpenPerson={openPersonCard}
            parent={null}
            person={tree}
            styles={styles}
          />
        </View>
      ) : null}
    </SceneShell>
  );
}

function treeStyles(p: ThemePalette) {
  return {
    housesBack: {
      alignSelf: 'flex-end',
      paddingBottom: 4,
      paddingVertical: 4,
    },
    housesBackText: {
      color: p.textMuted,
      fontSize: typography.caption,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    branchPicker: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    branchChip: {
      backgroundColor: 'transparent',
      borderColor: p.gold,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    activeBranchChip: {
      backgroundColor: p.green,
      borderColor: p.green,
    },
    branchChipText: {
      color: p.textMuted,
      fontSize: typography.caption,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    activeBranchChipText: {
      color: p.white,
    },
    searchBox: {
      gap: spacing.xs,
    },
    searchInput: {
      backgroundColor: p.creamLift,
      borderColor: p.gold,
      borderRadius: 18,
      borderWidth: 1,
      color: p.text,
      fontSize: typography.body,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      writingDirection: 'rtl',
    },
    searchResults: {
      backgroundColor: p.surface,
      borderColor: p.border,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
    },
    searchResult: {
      borderBottomColor: p.border,
      borderBottomWidth: 1,
      gap: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    searchResultRow: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: spacing.sm,
    },
    searchResultName: {
      color: p.text,
      fontSize: typography.body,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    searchResultPath: {
      color: p.textMuted,
      fontSize: 11,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    searchEmpty: {
      color: p.textMuted,
      fontSize: typography.caption,
      padding: spacing.md,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    outline: {
      gap: 6,
    },
    childrenBlock: {
      backgroundColor: 'rgba(23, 63, 53, 0.07)',
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 18,
      borderStartColor: p.gold,
      borderStartWidth: 4,
      borderWidth: 1,
      gap: 8,
      marginBottom: 10,
      marginTop: 6,
      padding: 10,
      paddingStart: 12,
    },
    childrenHeading: {
      color: p.green,
      fontSize: 12,
      fontWeight: '800',
      paddingBottom: 2,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    outlineRow: {
      backgroundColor: p.creamLift,
      borderColor: 'rgba(196,163,90,0.4)',
      borderRadius: 16,
      borderRightColor: p.gold,
      borderRightWidth: 4,
      borderWidth: 1,
      marginBottom: 6,
      minWidth: 0,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    outlineRoot: {
      backgroundColor: p.primarySoft,
      borderRightWidth: 5,
      paddingVertical: spacing.md,
    },
    outlineHighlight: {
      borderColor: p.gold,
      borderWidth: 2,
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
    nodeNameRow: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: spacing.sm,
    },
    nodeName: {
      color: p.text,
      flex: 1,
      fontSize: typography.body,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    nodeNameRoot: {
      color: p.green,
      fontSize: 18,
    },
    kinLine: {
      color: p.green,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    nodeMeta: {
      color: p.textMuted,
      fontSize: typography.caption,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    descendantsText: {
      color: p.primary,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    heroPerson: {
      gap: 6,
      paddingBottom: spacing.sm,
    },
    heroEyebrow: {
      color: p.gold,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    heroName: {
      color: p.creamLift,
      fontSize: 30,
      fontWeight: '800',
      lineHeight: 40,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    heroCount: {
      color: p.gold,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    heroInvite: {
      color: p.goldSoft,
      fontSize: 15,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  };
}
