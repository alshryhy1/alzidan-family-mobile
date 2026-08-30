import type { TreeChild } from '../types';
import type { SpouseRow } from './maternalKinship';
import {
  arabicNorm,
  effectiveParentName,
  leafPersonName,
  nodePathId,
  normalizePathKey,
} from './personEncounter';

export type SelfPathRing = {
  key: string;
  ring: string;
  detail: string;
};

export type SelfPathFacts = {
  motherName?: string | null;
  spousePartnerName?: string | null;
  /** Viewer's role on the spouse row, not a gender experience. */
  spouseRole?: 'husband' | 'wife' | null;
  siblingNames: string[];
  sisterNames?: string[];
  childNames: string[];
  daughterNames?: string[];
  externalOffspringNames?: string[];
  branchLabel: string;
};

function pathParts(person: Pick<TreeChild, 'name' | 'parentName'>): string[] {
  const id = nodePathId(person);
  if (id) {
    return id
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return String(person.name || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function siblingsInGraph(self: TreeChild, childrenRows: TreeChild[]): TreeChild[] {
  const parent = normalizePathKey(effectiveParentName(self));
  if (!parent) return [];
  return childrenRows.filter((row) => {
    if (Number(row.id) === Number(self.id)) return false;
    if (String(row.branchKey || '') !== String(self.branchKey || '')) return false;
    return normalizePathKey(effectiveParentName(row)) === parent;
  });
}

export function childrenOfPersonInGraph(parent: TreeChild, childrenRows: TreeChild[]): TreeChild[] {
  const parentNode = nodePathId(parent);
  const nameKey = normalizePathKey(parent.name);
  const aliases = new Set<string>();
  if (parentNode) aliases.add(parentNode);
  if (nameKey) aliases.add(nameKey);
  if (!aliases.size) return [];
  return childrenRows.filter((row) => {
    if (Number(row.id) === Number(parent.id)) return false;
    if (String(row.branchKey || '') !== String(parent.branchKey || '')) return false;
    const childParent = normalizePathKey(row.parentName);
    return Boolean(childParent && aliases.has(childParent));
  });
}

function sameParent(left: TreeChild, right: TreeChild): boolean {
  if (Number(left.id) === Number(right.id)) return false;
  if (String(left.branchKey || '') !== String(right.branchKey || '')) return false;
  const a = normalizePathKey(effectiveParentName(left));
  const b = normalizePathKey(effectiveParentName(right));
  return Boolean(a && b && a === b);
}

function nasabTokens(value: string) {
  return arabicNorm(value)
    .replace(/(^|\s)(بنت|بن|ابن)(\s|$)/g, ' ')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function wifeNasabText(spouse: SpouseRow) {
  const name = String(spouse.wifeName || '').trim();
  const lineage = String(spouse.wifeLineage || '').trim();
  const nameCount = nasabTokens(name).length;
  const lineageCount = nasabTokens(lineage).length;
  if (lineageCount > nameCount) return lineage;
  if (nameCount > lineageCount) return name;
  if (lineage.includes('/')) return lineage;
  return lineage || name;
}

/** هذه هي الزوجة: اسمها = ورقة الحساب وأب النسب = أب الحساب. ليست أختًا (اسم مختلف). */
function nasabViewerIsTheWife(spouse: SpouseRow, viewer: TreeChild): boolean {
  const selfLeaf = arabicNorm(leafPersonName(viewer.name));
  const fatherLeaf = arabicNorm(leafPersonName(effectiveParentName(viewer)));
  const tokens = nasabTokens(wifeNasabText(spouse));
  const wifeLeaf = tokens[0] || '';
  const wifeFather = tokens[1] || '';
  return Boolean(selfLeaf && fatherLeaf && wifeLeaf === selfLeaf && wifeFather === fatherLeaf);
}

function resolveWifePerson(spouse: SpouseRow, childrenRows: TreeChild[]): TreeChild | null {
  const lineage = normalizePathKey(String(spouse.wifeLineage || '').replace(/\s+/g, '/'));
  if (!lineage) return null;
  const hits = childrenRows.filter((row) => normalizePathKey(nodePathId(row)) === lineage);
  return hits.length === 1 ? hits[0] : null;
}

/** أخت فقط إن مسار الزوجة يطابق صف شقيق. صف الزوج نفسه لا يُلغى لأن النسب يذكر الأب. */
export function spouseIsSiblingMarriage(
  spouse: SpouseRow,
  viewer: TreeChild,
  childrenRows: TreeChild[],
): boolean {
  if (nasabViewerIsTheWife(spouse, viewer)) return false;
  const wife = resolveWifePerson(spouse, childrenRows);
  if (wife && Number(wife.id) === Number(viewer.id)) return false;
  if (wife && siblingsInGraph(viewer, childrenRows).some((row) => Number(row.id) === Number(wife.id))) {
    return true;
  }
  if (Number(spouse.husbandId) === Number(viewer.id)) return false;
  const husband =
    childrenRows.find((row) => Number(row.id) === Number(spouse.husbandId)) || null;
  if (husband && sameParent(viewer, husband)) return true;
  return false;
}

export function viewerIsWifeOnSpouse(spouse: SpouseRow, viewer: TreeChild): boolean {
  if (Number(spouse.husbandId) === Number(viewer.id)) return false;
  const viewerPath = normalizePathKey(nodePathId(viewer));
  const lineageRaw = String(spouse.wifeLineage || '').trim();
  const lineage = normalizePathKey(lineageRaw);
  const lineageAsPath = normalizePathKey(lineageRaw.replace(/\s+/g, '/'));
  if (viewerPath && lineage && lineage === viewerPath) return true;
  if (viewerPath && lineageAsPath && lineageAsPath === viewerPath) return true;
  if (
    viewerPath &&
    lineage &&
    lineage.replace(/\//g, ' ') === viewerPath.replace(/\//g, ' ')
  ) {
    return true;
  }
  return nasabViewerIsTheWife(spouse, viewer);
}

export function partnerNameForMarriage(
  viewer: TreeChild,
  spouse: SpouseRow,
  childrenRows: TreeChild[],
): { role: 'husband' | 'wife'; name: string; husband?: TreeChild | null; husbandId: number } | null {
  if (Number(spouse.husbandId) === Number(viewer.id)) {
    const wife = resolveWifePerson(spouse, childrenRows);
    if (wife && siblingsInGraph(viewer, childrenRows).some((row) => Number(row.id) === Number(wife.id))) {
      return null;
    }
    const name =
      leafPersonName(String(spouse.wifeName || '')) ||
      leafPersonName(String(spouse.wifeLineage || ''));
    if (!name) return null;
    if (arabicNorm(name) === arabicNorm(leafPersonName(viewer.name))) return null;
    return { role: 'husband', name, husband: viewer, husbandId: Number(viewer.id) };
  }

  if (spouseIsSiblingMarriage(spouse, viewer, childrenRows)) return null;
  if (!viewerIsWifeOnSpouse(spouse, viewer)) return null;
  const husband =
    childrenRows.find((row) => Number(row.id) === Number(spouse.husbandId)) || null;
  const name = husband ? leafPersonName(husband.name) : '';
  if (name && arabicNorm(name) === arabicNorm(leafPersonName(viewer.name))) return null;
  if (!name && !Number(spouse.husbandId || 0)) return null;
  return {
    role: 'wife',
    name,
    husband,
    husbandId: Number(spouse.husbandId || 0),
  };
}

export function buildSelfPathRings(self: TreeChild, facts: SelfPathFacts): SelfPathRing[] {
  const parts = pathParts(self);
  const leaf = leafPersonName(self.name) || parts.at(-1) || '';
  const fatherPath = effectiveParentName(self);
  const fatherLeaf = leafPersonName(fatherPath) || parts.at(-2) || '';
  const grandfatherLeaf = parts.length >= 3 ? parts[parts.length - 3] : '';
  const rings: SelfPathRing[] = [];

  if (leaf) rings.push({ key: 'self', ring: 'أنا', detail: leaf });
  if (fatherLeaf) rings.push({ key: 'father', ring: 'أبي', detail: fatherLeaf });

  const lineageBits = [
    grandfatherLeaf,
    facts.branchLabel ? `فرع ${facts.branchLabel}` : '',
  ].filter(Boolean);
  if (lineageBits.length) {
    rings.push({ key: 'lineage', ring: 'جدي / فرعي', detail: lineageBits.join(' · ') });
  }

  if (facts.motherName) {
    rings.push({ key: 'mother', ring: 'أمي', detail: facts.motherName });
  }
  if (facts.siblingNames.length) {
    rings.push({
      key: 'siblings',
      ring: 'إخوتي',
      detail: facts.siblingNames.join(' · '),
    });
  }
  if (facts.sisterNames?.length) {
    rings.push({
      key: 'sisters',
      ring: 'أخواتي',
      detail: facts.sisterNames.join(' · '),
    });
  }
  if (facts.spousePartnerName) {
    rings.push({
      key: 'marriage',
      ring: facts.spouseRole === 'wife' ? 'زوجي' : 'زوجتي',
      detail: facts.spousePartnerName,
    });
  }
  if (facts.childNames.length) {
    rings.push({
      key: 'children',
      ring: 'أبنائي',
      detail: facts.childNames.join(' · '),
    });
  }
  if (facts.daughterNames?.length) {
    rings.push({
      key: 'daughters',
      ring: 'بناتي',
      detail: facts.daughterNames.join(' · '),
    });
  }
  if (facts.externalOffspringNames?.length) {
    rings.push({
      key: 'externalOffspring',
      ring: 'أبناء من خارج نطاق العائلة',
      detail: facts.externalOffspringNames.join(' · '),
    });
  }

  return rings;
}
