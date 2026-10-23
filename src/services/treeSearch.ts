import { matchesSearchQuery } from '../utils/searchText';
import type { Branch, TreeChild, TreeParent, TreePerson } from '../types';

export type TreeSearchResult = {
  branchKey: string;
  branchName: string;
  path: TreePerson[];
  person: TreePerson;
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

export function personDisplayName(person: Pick<TreePerson, 'name' | 'fullName' | 'isDeceased'>) {
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

export function buildBranchTree(
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

function collectSearchResults(tree: TreePerson | null, branchKey: string, branchName: string) {
  const results: TreeSearchResult[] = [];

  const visit = (person: TreePerson, path: TreePerson[]) => {
    const nextPath = [...path, person];
    results.push({ branchKey, branchName, path: nextPath, person });
    person.children?.forEach((child) => visit(child, nextPath));
  };

  if (tree) visit(tree, []);
  return results;
}

export function searchAllBranches(
  branches: Branch[],
  parents: TreeParent[],
  childrenRows: TreeChild[],
  query: string,
  limit = 40,
): TreeSearchResult[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  return branches
    .map((branch) => ({
      branch,
      tree: buildBranchTree(branch, parents, childrenRows),
    }))
    .filter((item): item is { branch: Branch; tree: TreePerson } => Boolean(item.tree))
    .flatMap((item) => collectSearchResults(item.tree, item.branch.id, item.branch.name))
    .filter((result) => {
      if (result.path.length <= 1) return false;
      return matchesSearchQuery(
        [
          result.branchName,
          result.person.name,
          result.person.fullName,
          result.person.meta,
          result.person.city,
          result.person.area,
          result.path.map((item) => item.name).join(' '),
        ],
        normalizedQuery,
      );
    })
    .slice(0, limit);
}
