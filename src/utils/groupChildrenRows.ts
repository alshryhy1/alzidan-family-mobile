/**
 * Mobile port of web `groupChildrenRows` / path normalization
 * (alzidan-family assets/js — admin-family-mgmt.js / app.js / delegate.js).
 *
 * Goal: same parent keys and child node ids as web so short vs full paths
 * (e.g. `صالح` vs `لاحم بن مطلق بن زيدان/صالح`) merge into one node.
 */

import type { TreeChild } from '../types';

const PARENTS_BY_BRANCH: Record<string, string[]> = {
  زيدان: ['خميس بن زيدان بن مطلق', 'عبدالله بن زيدان بن مطلق'],
  مزيد: ['خميس', 'صلف', 'صلال'],
  زايد: [],
  لاحم: [],
  ملحم: [],
};

export function normalizePersonName(value?: string | null): string {
  const s = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  const parts = s
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
  if (
    parts.length >= 3 &&
    parts.every((part) => part.length === 1 && /^[\u0600-\u06FF]$/.test(part))
  ) {
    return parts.join('');
  }
  return s;
}

export function getBranchRootName(branchKey: string): string {
  const key = normalizePersonName(branchKey);
  if (!key) return '';
  return `${key} بن مطلق بن زيدان`;
}

export function normalizeParentName(value: string, branchKey: string): string {
  const raw = normalizePersonName(value || '');
  const cleaned = raw.replace(/^أصل الفرع:\s*/i, '').trim();
  if (!cleaned) return '';
  if (/بن\s+مطلق\s+بن\s+زيدان/.test(cleaned)) return cleaned;
  if (Object.prototype.hasOwnProperty.call(PARENTS_BY_BRANCH, cleaned)) {
    return `${cleaned} بن مطلق بن زيدان`;
  }
  if (branchKey && normalizePersonName(branchKey) === cleaned) {
    return `${cleaned} بن مطلق بن زيدان`;
  }
  return cleaned;
}

export function normalizePersonBaseName(value?: string | null): string {
  const n = normalizePersonName(value || '');
  if (!n) return '';
  const match = n.match(/^(.*)\s*\((?:ابن|مواليد)\s+[^)]+\)\s*$/);
  const core = match?.[1] ? normalizePersonName(match[1]) : n;
  const parts = core
    .split('/')
    .map((part) => normalizePersonName(part))
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : core;
}

function tokenizeLineageInput(value: string): string[] {
  const s = normalizePersonName(value || '');
  if (!s) return [];
  const hasConnector = /(^|\s)(?:بن|ابن|بنت)(\s|$)/.test(s);
  if (!hasConnector) return [s];
  return s
    .split(/\s+/g)
    .map((word) => normalizePersonName(word))
    .filter(Boolean)
    .filter((word) => !['بن', 'ابن', 'بنت'].includes(word));
}

function buildChildId(parentId: string, baseName: string): string {
  const parent = normalizePersonName(parentId || '');
  const base = normalizePersonName(baseName || '');
  if (!parent || !base) return '';
  return `${parent}/${base}`;
}

function preferChild(left: TreeChild, right: TreeChild): TreeChild {
  const leftPath = normalizePersonName(left.name).includes('/');
  const rightPath = normalizePersonName(right.name).includes('/');
  if (leftPath !== rightPath) return rightPath ? right : left;

  const leftScore =
    (left.birthOrder != null ? 1 : 0) +
    (left.birthDateGregorian ? 1 : 0) +
    (left.birthDateHijri ? 1 : 0) +
    (left.city ? 1 : 0) +
    (left.area ? 1 : 0);
  const rightScore =
    (right.birthOrder != null ? 1 : 0) +
    (right.birthDateGregorian ? 1 : 0) +
    (right.birthDateHijri ? 1 : 0) +
    (right.city ? 1 : 0) +
    (right.area ? 1 : 0);
  if (rightScore !== leftScore) return rightScore > leftScore ? right : left;
  return right.id >= left.id ? right : left;
}

function mergeChildMeta(prev: TreeChild, next: TreeChild): TreeChild {
  const preferred = preferChild(prev, next);
  const other = preferred === prev ? next : prev;
  return {
    ...preferred,
    birthOrder: preferred.birthOrder ?? other.birthOrder,
    birthDateGregorian: preferred.birthDateGregorian ?? other.birthDateGregorian,
    birthDateHijri: preferred.birthDateHijri ?? other.birthDateHijri,
    birthYear: preferred.birthYear ?? other.birthYear,
    deathDateGregorian: preferred.deathDateGregorian ?? other.deathDateGregorian,
    deathDateHijri: preferred.deathDateHijri ?? other.deathDateHijri,
    city: preferred.city ?? other.city,
    area: preferred.area ?? other.area,
    isDeceased: preferred.isDeceased === true || other.isDeceased === true ? true : preferred.isDeceased ?? other.isDeceased,
  };
}

/**
 * Groups branch child rows under canonical parent path keys, matching web merge behavior.
 */
export function groupChildrenRows(rows: TreeChild[], branchKey: string): Map<string, TreeChild[]> {
  const key = normalizePersonName(branchKey || '');
  const branchRoot = key ? getBranchRootName(key) : '';
  const byParent = new Map<string, TreeChild[]>();
  const idsByBase = new Map<string, Set<string>>();
  let syntheticId = -1;

  const indexKnownId = (nodeId: string) => {
    const id = normalizePersonName(nodeId || '');
    if (!id) return;
    const parts = id
      .split('/')
      .map((part) => normalizePersonName(part))
      .filter(Boolean);
    const base = parts.length ? parts[parts.length - 1] : id;
    if (!base) return;
    const existing = idsByBase.get(base);
    if (existing) {
      existing.add(id);
      return;
    }
    idsByBase.set(base, new Set([id]));
  };

  const addOrMergeChildById = (parentId: string, child: TreeChild) => {
    const parent = normalizePersonName(parentId || '');
    const name = normalizePersonName(child.name || '');
    if (!parent || !name) return;

    const list = byParent.get(parent) ?? [];
    if (!byParent.has(parent)) byParent.set(parent, list);

    const idx = list.findIndex((item) => normalizePersonName(item.name) === name);
    const mergedChild: TreeChild = { ...child, parentName: parent, name };
    if (idx < 0) {
      list.push(mergedChild);
      return;
    }
    list[idx] = mergeChildMeta(list[idx], mergedChild);
  };

  const addOrMergeChildAndIndex = (parentId: string, child: TreeChild) => {
    addOrMergeChildById(parentId, child);
    const parent = normalizePersonName(parentId || '');
    if (parent) indexKnownId(parent);
    const name = normalizePersonName(child.name || '');
    if (name) indexKnownId(name);
  };

  const ensureParentId = (rawParent: string, childRaw: string): string => {
    const raw = normalizePersonName(rawParent || '');
    if (!raw) return '';
    if (raw.includes('/')) return raw;
    if (branchRoot && (raw === branchRoot || raw === key)) return branchRoot;

    const childFull = normalizePersonName(childRaw || '');
    if (childFull.includes('/')) {
      const parts = childFull
        .split('/')
        .map((part) => normalizePersonName(part))
        .filter(Boolean);
      if (parts.length >= 2) {
        const derivedParent = parts.slice(0, -1).join('/');
        const derivedLeaf = parts[parts.length - 2] || '';
        if (
          derivedLeaf === raw ||
          normalizePersonBaseName(derivedParent) === raw ||
          derivedParent.endsWith(`/${raw}`)
        ) {
          return derivedParent;
        }
      }
    }

    const candidates = idsByBase.get(raw);
    if (candidates && candidates.size === 1) return Array.from(candidates)[0];
    if (candidates && candidates.size > 1) return raw;

    if (branchRoot) {
      const parentId = buildChildId(branchRoot, raw);
      if (parentId) {
        addOrMergeChildAndIndex(branchRoot, {
          id: syntheticId--,
          branchKey: key,
          parentName: branchRoot,
          name: parentId,
          birthOrder: null,
          birthDateGregorian: null,
          birthDateHijri: null,
          birthYear: null,
          city: null,
          area: null,
          isDeceased: null,
        });
      }
      return parentId;
    }
    return raw;
  };

  const stripBranchSuffix = (tokens: string[]): string[] => {
    const t = tokens.map((item) => normalizePersonName(item)).filter(Boolean);
    if (!key) return t;
    if (t.length >= 3) {
      const a = normalizePersonName(t[t.length - 3] || '');
      const b = normalizePersonName(t[t.length - 2] || '');
      const c = normalizePersonName(t[t.length - 1] || '');
      if (a === key && b === 'مطلق' && c === 'زيدان') return t.slice(0, -3);
    }
    if (t.length >= 2) {
      const b = normalizePersonName(t[t.length - 2] || '');
      const c = normalizePersonName(t[t.length - 1] || '');
      if (b === key && c === 'مطلق') return t.slice(0, -2);
    }
    if (t.length >= 1 && normalizePersonName(t[t.length - 1] || '') === key) {
      return t.slice(0, -1);
    }
    return t;
  };

  const normalizeChildId = (rawChildId: string, parentId: string): string => {
    const child = normalizePersonName(rawChildId || '');
    if (!child || !child.includes('/')) return child;
    const parent = normalizePersonName(parentId || '');
    if (!parent) return child;
    if (child === parent || child.startsWith(`${parent}/`)) return child;
    if (branchRoot && (child === branchRoot || child.startsWith(`${branchRoot}/`))) return child;
    const base =
      parent
        .split('/')
        .map((part) => normalizePersonName(part))
        .filter(Boolean)
        .slice(-1)[0] || '';
    if (base && child.startsWith(`${base}/`)) {
      return `${parent}/${child.slice((`${base}/`).length)}`;
    }
    return child;
  };

  const addChain = (anchorParentId: string, basesOldestToYoungest: string[], leaf: TreeChild) => {
    const anchor = normalizePersonName(anchorParentId || '');
    const chain = basesOldestToYoungest.map((item) => normalizePersonName(item)).filter(Boolean);
    if (!anchor || !chain.length) return;

    let current = anchor;
    indexKnownId(current);
    for (let i = 0; i < chain.length; i += 1) {
      const base = chain[i];
      const childId = buildChildId(current, base);
      if (!childId) return;
      const isLeaf = i === chain.length - 1;
      if (isLeaf) {
        addOrMergeChildAndIndex(current, { ...leaf, parentName: current, name: childId });
      } else {
        addOrMergeChildAndIndex(current, {
          id: syntheticId--,
          branchKey: leaf.branchKey,
          parentName: current,
          name: childId,
          birthOrder: null,
          birthDateGregorian: null,
          birthDateHijri: null,
          birthYear: null,
          city: null,
          area: null,
          isDeceased: null,
        });
      }
      current = childId;
    }
  };

  // Pass 1: index path-bearing ids so short parents can resolve when unique.
  for (const row of rows) {
    const parentRaw = normalizeParentName(row.parentName || '', key);
    const childRaw = normalizePersonName(row.name || '');
    if (parentRaw.includes('/')) indexKnownId(parentRaw);
    if (childRaw.includes('/')) indexKnownId(childRaw);
    if (parentRaw) indexKnownId(parentRaw);
  }

  for (const row of rows) {
    const parentRaw = normalizeParentName(row.parentName || '', key);
    const childRaw = normalizePersonName(row.name || '');
    if (!parentRaw || !childRaw) continue;

    const parentId = ensureParentId(parentRaw, childRaw);
    if (!parentId) continue;

    if (childRaw.includes('/')) {
      addOrMergeChildAndIndex(parentId, {
        ...row,
        parentName: parentId,
        name: normalizeChildId(childRaw, parentId),
      });
      continue;
    }

    const rawTokens = tokenizeLineageInput(normalizePersonBaseName(childRaw));
    const tokens = stripBranchSuffix(rawTokens);
    if (!tokens.length) continue;

    const hadBranchSuffix = tokens.length !== rawTokens.length;
    if (hadBranchSuffix && branchRoot) {
      addChain(branchRoot, [...tokens].reverse(), row);
      continue;
    }

    if (tokens.length > 1) {
      const chainOldest = [...tokens].reverse();
      const parentBase = normalizePersonBaseName(parentId);
      if (chainOldest.length && parentBase && chainOldest[0] === parentBase) {
        chainOldest.shift();
      }
      addChain(parentId, chainOldest, row);
      continue;
    }

    addChain(parentId, [tokens[0]], row);
  }

  // Final sibling merge by leaf base (covers residual short/full duplicates).
  for (const [parent, list] of byParent.entries()) {
    const byLeaf = new Map<string, TreeChild>();
    for (const child of list) {
      const leaf = normalizePersonBaseName(child.name);
      if (!leaf) continue;
      const prev = byLeaf.get(leaf);
      if (!prev) {
        byLeaf.set(leaf, child);
        continue;
      }
      byLeaf.set(leaf, mergeChildMeta(prev, child));
    }
    byParent.set(parent, Array.from(byLeaf.values()));
  }

  return byParent;
}
