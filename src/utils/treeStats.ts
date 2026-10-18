import type { TreeChild } from '../types';
import {
  getBranchRootName,
  groupChildrenRows,
  normalizePersonName,
} from './groupChildrenRows';

export type BranchWorkStatusCounts = {
  employed: number;
  retired: number;
  unemployed: number;
  unset: number;
};

export type BranchTreeStats = {
  deceased: number;
  living: number;
  total: number;
  workStatus: BranchWorkStatusCounts;
};

export function normalizeWorkStatus(value: unknown): 'employed' | 'retired' | 'unemployed' | '' {
  const g = String(value || '')
    .trim()
    .toLowerCase();
  if (!g) return '';
  if (
    g === 'employed' ||
    g === 'employee' ||
    g === 'working' ||
    g === 'job' ||
    g === 'موظف' ||
    g === 'موظفين' ||
    g === 'يعمل' ||
    g === 'على رأس العمل'
  ) {
    return 'employed';
  }
  if (
    g === 'retired' ||
    g === 'retiree' ||
    g === 'pension' ||
    g === 'متقاعد' ||
    g === 'متقاعدين' ||
    g === 'تقاعد'
  ) {
    return 'retired';
  }
  if (
    g === 'unemployed' ||
    g === 'jobless' ||
    g === 'without_work' ||
    g === 'عاطل' ||
    g === 'عاطلين' ||
    g === 'بدون عمل' ||
    g === 'بدون_عمل'
  ) {
    return 'unemployed';
  }
  return '';
}

export function emptyWorkStatusCounts(): BranchWorkStatusCounts {
  return { employed: 0, retired: 0, unemployed: 0, unset: 0 };
}

export function workStatusPercent(count: number, living: number) {
  if (!living || count <= 0) return 0;
  return Math.round((count / living) * 100);
}

export function parseExplicitBoolValue(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (value == null) return null;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text === 'true' || text === 't' || text === '1' || text === 'yes' || text === 'y' || text === 'on') {
    return true;
  }
  if (text === 'false' || text === 'f' || text === '0' || text === 'no' || text === 'n' || text === 'off') {
    return false;
  }
  if (text === 'نعم' || text === 'متوفي' || text === 'متوفى' || text === 'متوفاة' || text === 'متوفاه') {
    return true;
  }
  if (text === 'لا' || text === 'حي' || text === 'حية' || text === 'غير متوفي' || text === 'غير متوفى') {
    return false;
  }
  return null;
}

/** True if any source marks the person deceased. One true flag wins. */
export function isTreePersonDeceased(...values: unknown[]) {
  return values.some((value) => parseExplicitBoolValue(value) === true);
}

function mergeTreeMeta(prev: TreeChild, next: TreeChild): TreeChild {
  return {
    ...prev,
    ...next,
    name: next.name || prev.name,
    isDeceased: isTreePersonDeceased(prev.isDeceased, next.isDeceased) ? true : next.isDeceased ?? prev.isDeceased,
    workStatus: normalizeWorkStatus(next.workStatus) || normalizeWorkStatus(prev.workStatus) || null,
  };
}

/**
 * Same count as web `collectBranchStats` + `loadFamilyStats`:
 * unique people after grouping, excluding the branch root.
 * Living drops when a person is marked متوفى, and rises when a living child is added.
 */
export function collectBranchTreeStats(
  rows: TreeChild[],
  branchKey: string,
  opts?: { includePubliclyHidden?: boolean },
): BranchTreeStats {
  const key = normalizePersonName(branchKey);
  const root = getBranchRootName(key);
  const grouped = groupChildrenRows(rows, key, opts);
  const metaById = new Map<string, TreeChild>();
  const nodes = new Set<string>();

  grouped.forEach((children, parent) => {
    const parentId = normalizePersonName(parent);
    if (parentId) nodes.add(parentId);
    children.forEach((child) => {
      const childId = normalizePersonName(child.name);
      if (!childId) return;
      nodes.add(childId);
      const prev = metaById.get(childId);
      metaById.set(childId, prev ? mergeTreeMeta(prev, { ...child, name: childId }) : { ...child, name: childId });
    });
  });

  if (root) nodes.add(root);

  let deceasedCount = 0;
  const workStatus = emptyWorkStatusCounts();
  nodes.forEach((nodeId) => {
    const id = normalizePersonName(nodeId);
    if (!id || id === root) return;
    const meta = metaById.get(id);
    if (isTreePersonDeceased(meta?.isDeceased)) {
      deceasedCount += 1;
      return;
    }
    const status = normalizeWorkStatus(meta?.workStatus);
    if (status === 'employed') workStatus.employed += 1;
    else if (status === 'retired') workStatus.retired += 1;
    else if (status === 'unemployed') workStatus.unemployed += 1;
    else workStatus.unset += 1;
  });

  const total = Math.max(0, nodes.size - (root ? 1 : 0));
  return {
    total,
    deceased: deceasedCount,
    living: Math.max(0, total - deceasedCount),
    workStatus,
  };
}
