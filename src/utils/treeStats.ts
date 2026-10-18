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

export type EducationDegreeKey =
  | 'intermediate'
  | 'secondary'
  | 'diploma'
  | 'bachelor'
  | 'master'
  | 'doctorate';

export type BranchEducationDegreeCounts = {
  intermediate: number;
  secondary: number;
  diploma: number;
  bachelor: number;
  master: number;
  doctorate: number;
  unset: number;
};

export type BranchTreeStats = {
  deceased: number;
  living: number;
  total: number;
  workStatus: BranchWorkStatusCounts;
  educationDegree: BranchEducationDegreeCounts;
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

export function emptyEducationDegreeCounts(): BranchEducationDegreeCounts {
  return {
    intermediate: 0,
    secondary: 0,
    diploma: 0,
    bachelor: 0,
    master: 0,
    doctorate: 0,
    unset: 0,
  };
}

export function workStatusPercent(count: number, living: number) {
  if (!living || count <= 0) return 0;
  return Math.round((count / living) * 100);
}

export function normalizeWorkplace(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeEducationDegree(value: unknown): EducationDegreeKey | '' {
  const g = String(value || '')
    .trim()
    .toLowerCase();
  if (!g) return '';
  if (
    g === 'intermediate' ||
    g === 'middle' ||
    g === 'middle_school' ||
    g === 'متوسط' ||
    g === 'متوسطة' ||
    g === 'المتوسط' ||
    g === 'المتوسطة'
  ) {
    return 'intermediate';
  }
  if (
    g === 'secondary' ||
    g === 'high_school' ||
    g === 'highschool' ||
    g === 'hs' ||
    g === 'ثانوي' ||
    g === 'ثانوية' ||
    g === 'الثانوية' ||
    g === 'الثانوي'
  ) {
    return 'secondary';
  }
  if (g === 'diploma' || g === 'dip' || g === 'دبلوم' || g === 'الدبلوم') {
    return 'diploma';
  }
  if (
    g === 'bachelor' ||
    g === 'bachelors' ||
    g === 'ba' ||
    g === 'bsc' ||
    g === 'bs' ||
    g === 'بكالوريوس' ||
    g === 'بكالوريس' ||
    g === 'جامعي' ||
    g === 'جامعة'
  ) {
    return 'bachelor';
  }
  if (
    g === 'master' ||
    g === 'masters' ||
    g === 'msc' ||
    g === 'ma' ||
    g === 'ms' ||
    g === 'ماجستير' ||
    g === 'الماجستير'
  ) {
    return 'master';
  }
  if (
    g === 'doctorate' ||
    g === 'doctoral' ||
    g === 'phd' ||
    g === 'ph.d' ||
    g === 'ph.d.' ||
    g === 'dr' ||
    g === 'دكتوراه' ||
    g === 'الدكتوراه'
  ) {
    return 'doctorate';
  }
  return '';
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
    workplace: normalizeWorkplace(next.workplace) || normalizeWorkplace(prev.workplace) || null,
    educationDegree:
      normalizeEducationDegree(next.educationDegree) ||
      normalizeEducationDegree(prev.educationDegree) ||
      null,
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
  const educationDegree = emptyEducationDegreeCounts();
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

    const degree = normalizeEducationDegree(meta?.educationDegree);
    if (degree === 'intermediate') educationDegree.intermediate += 1;
    else if (degree === 'secondary') educationDegree.secondary += 1;
    else if (degree === 'diploma') educationDegree.diploma += 1;
    else if (degree === 'bachelor') educationDegree.bachelor += 1;
    else if (degree === 'master') educationDegree.master += 1;
    else if (degree === 'doctorate') educationDegree.doctorate += 1;
    else educationDegree.unset += 1;
  });

  const total = Math.max(0, nodes.size - (root ? 1 : 0));
  return {
    total,
    deceased: deceasedCount,
    living: Math.max(0, total - deceasedCount),
    workStatus,
    educationDegree,
  };
}
