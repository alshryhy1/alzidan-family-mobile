import type { TreeChild } from '../types';
import {
  arabicNorm,
  effectiveParentName,
  leafPersonName,
  nodePathId,
  normalizePathKey,
} from './personEncounter';
import { isPublicLineageHiddenPerson } from './personVisibility';

export type MaternalKinshipLabel = 'جدك من الأم' | 'خالك' | 'ابن خالك' | 'ابن خالتك';

export type LinkKinshipLabel = 'ابنك' | 'حفيدك من ابنتك' | 'ابن أختك';

export type EncounterKinshipLabel = MaternalKinshipLabel | LinkKinshipLabel | 'أخ من أمك';

export type MotherLinkRow = {
  childId: number;
  spouseId: number;
  motherName?: string | null;
  motherLineage?: string | null;
  motherIsFamilyMember?: boolean | null;
  motherBranchKey?: string | null;
  confidence?: string | null;
};

export type SpouseRow = {
  id: number;
  husbandId: number;
  wifeName?: string | null;
  wifeLineage?: string | null;
  wifeIsFamilyMember?: boolean | null;
  wifeBranchKey?: string | null;
  status?: string | null;
};

export type MaternalKinshipContext = {
  children: TreeChild[];
  motherLinks: MotherLinkRow[];
  spouses: SpouseRow[];
};

function isConfirmedLink(confidence: string | null | undefined) {
  const value = String(confidence || '').trim().toLowerCase();
  return !value || value === 'confirmed';
}

function isActiveSpouse(status: string | null | undefined) {
  const value = String(status || 'active').trim().toLowerCase();
  return !value || value === 'active';
}

function isFamilyMember(value: boolean | string | null | undefined) {
  if (value === true) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === 't' || v === 'yes' || v === 'y' || v === '1' || v === 'نعم';
  }
  return false;
}

function nasabTokens(value: string) {
  return arabicNorm(value)
    .replace(/(^|\s)(بنت|بن|ابن)(\s|$)/g, ' ')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parentPathOf(path: string) {
  const parts = normalizePathKey(path)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return '';
  return parts.slice(0, -1).join('/');
}

function lineagePath(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw.includes('/')) return '';
  return normalizePathKey(raw);
}

function isDirectChildPathOf(parentPath: string, childPathValue: string) {
  const parent = normalizePathKey(parentPath);
  const child = normalizePathKey(childPathValue);
  if (!parent || !child || !child.startsWith(`${parent}/`)) return false;
  const rest = child.slice(parent.length + 1);
  return Boolean(rest && !rest.includes('/'));
}

/** Aunts as family-member wives under the maternal grandfather — no public daughter row needed. */
export function auntSpouseIdsForViewer(
  viewerId: number,
  spouses: SpouseRow[],
  motherLinks: MotherLinkRow[],
): number[] {
  const link = motherLinks.find((row) => Number(row.childId) === Number(viewerId));
  if (!link) return [];
  const spouse = spouses.find((row) => Number(row.id) === Number(link.spouseId));
  const motherPath = lineagePath(spouse?.wifeLineage || link.motherLineage || '');
  const grandfather = parentPathOf(motherPath);
  if (!grandfather) return [];
  return spouses
    .filter((row) => {
      if (!isFamilyMember(row.wifeIsFamilyMember)) return false;
      if (Number(row.id) === Number(link.spouseId)) return false;
      const path = lineagePath(row.wifeLineage);
      if (!path || path === motherPath) return false;
      return isDirectChildPathOf(grandfather, path);
    })
    .map((row) => Number(row.id))
    .filter(Boolean);
}

function samePath(left: string, right: string) {
  const a = normalizePathKey(left);
  const b = normalizePathKey(right);
  return Boolean(a && b && a === b);
}

function isSonRow(row: TreeChild) {
  return !isPublicLineageHiddenPerson(row);
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

export function wifeRoleTowardViewer(
  spouse: SpouseRow,
  viewer: Pick<TreeChild, 'id' | 'name' | 'parentName'>,
): 'self' | 'daughter' | 'sister' | null {
  if (!spouse || !viewer || !isFamilyMember(spouse.wifeIsFamilyMember)) return null;
  if (!isActiveSpouse(spouse.status)) return null;
  const viewerPath = normalizePathKey(nodePathId(viewer));
  const viewerParent = normalizePathKey(effectiveParentName(viewer));
  const viewerGf = parentPathOf(viewerParent);
  const nasab = wifeNasabText(spouse);
  const lineage = lineagePath(spouse.wifeLineage) || lineagePath(nasab);
  const tokens = nasabTokens(nasab);
  const wifeLeaf = tokens[0] || '';
  const wifeFather = tokens[1] || '';
  const wifeGf = tokens[2] || '';
  const selfLeaf = arabicNorm(leafPersonName(viewerPath));
  const fatherLeaf = arabicNorm(leafPersonName(viewerParent));
  const gfLeaf = arabicNorm(leafPersonName(viewerGf));

  if (lineage && viewerPath && lineage === viewerPath) return 'self';
  if (selfLeaf && wifeLeaf === selfLeaf && wifeFather && fatherLeaf && wifeFather === fatherLeaf) {
    if (!wifeGf || !gfLeaf || wifeGf === gfLeaf) return 'self';
  }
  if (lineage && viewerPath && parentPathOf(lineage) === viewerPath) return 'daughter';
  if (wifeFather && selfLeaf && wifeFather === selfLeaf && wifeLeaf && wifeLeaf !== selfLeaf) {
    if (!wifeGf || !fatherLeaf || wifeGf === fatherLeaf) return 'daughter';
  }
  if (lineage && viewerParent && parentPathOf(lineage) === viewerParent && lineage !== viewerPath) {
    return 'sister';
  }
  if (wifeFather && fatherLeaf && wifeFather === fatherLeaf && wifeLeaf && wifeLeaf !== selfLeaf) {
    if (!wifeGf || !gfLeaf || wifeGf === gfLeaf) return 'sister';
  }
  return null;
}

function activeWifeCountByHusband(spouses: SpouseRow[]) {
  const counts: Record<number, number> = {};
  spouses.forEach((spouse) => {
    if (!spouse?.husbandId || !isActiveSpouse(spouse.status)) return;
    counts[spouse.husbandId] = (counts[spouse.husbandId] || 0) + 1;
  });
  return counts;
}

function childIdsForSpouse(spouse: SpouseRow, ctx: MaternalKinshipContext, wifeCounts: Record<number, number>) {
  const ids: number[] = [];
  const seen: Record<number, boolean> = {};
  (ctx.motherLinks || []).forEach((item) => {
    if (Number(item.spouseId) !== Number(spouse.id)) return;
    if (!isConfirmedLink(item.confidence)) return;
    const childId = Number(item.childId || 0);
    if (!childId || seen[childId]) return;
    seen[childId] = true;
    ids.push(childId);
  });
  if (ids.length) return ids;
  if ((wifeCounts[spouse.husbandId] || 0) !== 1) return [];
  const husband = (ctx.children || []).find((row) => Number(row.id) === Number(spouse.husbandId));
  if (!husband) return [];
  sonsOfParent(ctx, nodePathId(husband), husband.branchKey).forEach((son) => {
    const childId = Number(son.id || 0);
    if (!childId || seen[childId]) return;
    seen[childId] = true;
    ids.push(childId);
  });
  return ids;
}

export function linkKinshipByTargetId(
  viewer: Pick<TreeChild, 'id' | 'name' | 'parentName' | 'gender'> | null | undefined,
  ctx: MaternalKinshipContext,
): Record<number, LinkKinshipLabel> {
  const map: Record<number, LinkKinshipLabel> = {};
  if (!viewer || !ctx) return map;
  const counts = activeWifeCountByHusband(ctx.spouses);
  (ctx.spouses || []).forEach((spouse) => {
    const role = wifeRoleTowardViewer(spouse, viewer);
    if (!role) return;
    const label: LinkKinshipLabel | '' =
      role === 'self' ? 'ابنك' : role === 'daughter' ? 'حفيدك من ابنتك' : role === 'sister' ? 'ابن أختك' : '';
    if (!label) return;
    childIdsForSpouse(spouse, ctx, counts).forEach((childId) => {
      if (!childId || childId === Number(viewer.id)) return;
      const child =
        (ctx.children || []).find((row) => Number(row.id) === childId) ||
        ({ id: childId, gender: 'son' } as TreeChild);
      if (child.gender && !isSonRow(child)) return;
      if (!map[childId]) map[childId] = label;
    });
  });
  return map;
}

export const ENCOUNTER_KINSHIP_LABELS: Record<string, true> = {
  'جدك من الأم': true,
  خالك: true,
  'ابن خالك': true,
  'ابن خالتك': true,
  'أخ من أمك': true,
  ابنك: true,
  'حفيدك من ابنتك': true,
  'ابن أختك': true,
  حفيدك: true,
  'ابن أخيك': true,
  عمك: true,
  'ابن عمك': true,
  أبوك: true,
  'جدك من الأب': true,
  أخ: true,
  شقيقك: true,
  'أخ من الأب': true,
};

export function isEncounterKinshipLabel(label: string) {
  return Boolean(ENCOUNTER_KINSHIP_LABELS[String(label || '').trim()]);
}

function childPath(row: TreeChild) {
  return nodePathId(row);
}

function uniqueByNasab(
  rows: TreeChild[],
  branchKey: string,
  query: string,
): TreeChild | null {
  const tokens = nasabTokens(query);
  const wanted = tokens[0] || '';
  const father = tokens[1] || '';
  if (!wanted) return null;
  const branch = arabicNorm(branchKey);
  const inBranch = rows.filter((row) => {
    if (branch && arabicNorm(row.branchKey) !== branch) return false;
    return arabicNorm(leafPersonName(row.name)) === wanted;
  });
  if (inBranch.length === 1) return inBranch[0];
  if (inBranch.length > 1 && father) {
    const narrowed = inBranch.filter(
      (row) => arabicNorm(leafPersonName(row.parentName)) === father,
    );
    return narrowed.length === 1 ? narrowed[0] : null;
  }
  return null;
}

/** Mother's father node from nasab «فلانة بنت فلان بن …» without needing the daughter row. */
function uniqueFatherNodeFromNasab(
  rows: TreeChild[],
  branchKey: string,
  query: string,
): TreeChild | null {
  const tokens = nasabTokens(query);
  const father = tokens[1] || '';
  const grandfather = tokens[2] || '';
  if (!father) return null;
  const branch = arabicNorm(branchKey);
  const matches = rows.filter((row) => {
    if (branch && arabicNorm(row.branchKey) !== branch) return false;
    if (arabicNorm(leafPersonName(row.name)) !== father) return false;
    if (grandfather && arabicNorm(leafPersonName(row.parentName)) !== grandfather) return false;
    return true;
  });
  return matches.length === 1 ? matches[0] : null;
}

function uniqueMaleNodeByPath(
  rows: TreeChild[],
  path: string,
  branchKey: string,
): TreeChild | null {
  const wanted = normalizePathKey(path);
  const branch = normalizePathKey(branchKey);
  if (!wanted) return null;
  const matches = rows.filter((row) => {
    if (!isSonRow(row)) return false;
    if (branch && normalizePathKey(row.branchKey) !== branch) return false;
    return childPath(row) === wanted || normalizePathKey(row.name) === wanted;
  });
  return matches.length === 1 ? matches[0] : null;
}

function uniqueSpouseForSister(
  spouses: SpouseRow[],
  sister: TreeChild,
): SpouseRow | null {
  const sisterPath = childPath(sister);
  const sisterLeaf = arabicNorm(leafPersonName(sister.name));
  const branch = normalizePathKey(sister.branchKey);

  const byPath = spouses.filter((spouse) => {
    if (!isActiveSpouse(spouse.status) || !isFamilyMember(spouse.wifeIsFamilyMember)) {
      return false;
    }
    const path = lineagePath(spouse.wifeLineage);
    return Boolean(path && sisterPath && path === sisterPath);
  });
  if (byPath.length === 1) return byPath[0];
  if (byPath.length > 1) return null;

  if (!sisterLeaf) return null;
  const byLeaf = spouses.filter((spouse) => {
    if (!isActiveSpouse(spouse.status) || !isFamilyMember(spouse.wifeIsFamilyMember)) {
      return false;
    }
    if (lineagePath(spouse.wifeLineage)) return false;
    if (branch && spouse.wifeBranchKey && normalizePathKey(spouse.wifeBranchKey) !== branch) {
      return false;
    }
    const nameLeaf = nasabTokens(spouse.wifeName || '')[0] || arabicNorm(leafPersonName(spouse.wifeName || ''));
    const lineageLeaf = nasabTokens(spouse.wifeLineage || '')[0] || arabicNorm(leafPersonName(spouse.wifeLineage || ''));
    return nameLeaf === sisterLeaf || lineageLeaf === sisterLeaf;
  });
  return byLeaf.length === 1 ? byLeaf[0] : null;
}

type MotherResolution = {
  node: TreeChild | null;
  grandfatherPath: string;
  branchKey: string;
  maternalGrandfather: TreeChild | null;
};

function resolveMotherNode(
  viewerId: number,
  ctx: MaternalKinshipContext,
): MotherResolution | null {
  const link = ctx.motherLinks.find(
    (row) => Number(row.childId) === Number(viewerId) && isConfirmedLink(row.confidence),
  );
  if (!link) return null;

  const spouse = ctx.spouses.find((row) => Number(row.id) === Number(link.spouseId));
  const isMember = spouse
    ? isFamilyMember(spouse.wifeIsFamilyMember)
    : isFamilyMember(link.motherIsFamilyMember);
  if (!isMember) return null;

  const lineage = String(spouse?.wifeLineage || link.motherLineage || '').trim();
  const name = String(spouse?.wifeName || link.motherName || '').trim();
  const branchKey = String(spouse?.wifeBranchKey || link.motherBranchKey || '').trim();
  const path = lineagePath(lineage);

  let node: TreeChild | null = null;
  if (path) {
    const matches = ctx.children.filter((row) => {
      if (branchKey && normalizePathKey(row.branchKey) !== normalizePathKey(branchKey)) {
        return false;
      }
      return childPath(row) === path || normalizePathKey(row.name) === path;
    });
    if (matches.length === 1) node = matches[0];
    else if (matches.length > 1) return null;
  }
  if (!node && (name || lineage)) {
    node = uniqueByNasab(ctx.children, branchKey, name || lineage);
  }
  if (!node && (name || lineage)) {
    const fatherNode = uniqueFatherNodeFromNasab(ctx.children, branchKey, name || lineage);
    if (fatherNode) {
      const grandfatherPath = childPath(fatherNode);
      if (grandfatherPath) {
        return {
          node: null,
          grandfatherPath,
          branchKey: fatherNode.branchKey || branchKey,
          maternalGrandfather: fatherNode,
        };
      }
    }
  }
  if (!node && path) {
    const grandfatherPath = parentPathOf(path);
    if (!grandfatherPath) return null;
    return {
      node: null,
      grandfatherPath,
      branchKey,
      maternalGrandfather: uniqueMaleNodeByPath(ctx.children, grandfatherPath, branchKey),
    };
  }
  if (!node) return null;

  const grandfatherPath = normalizePathKey(node.parentName) || parentPathOf(childPath(node));
  if (!grandfatherPath) return null;
  const resolvedBranch = node.branchKey || branchKey;
  return {
    node,
    grandfatherPath,
    branchKey: resolvedBranch,
    maternalGrandfather: uniqueMaleNodeByPath(ctx.children, grandfatherPath, resolvedBranch),
  };
}

function sonsOfParent(ctx: MaternalKinshipContext, parentPath: string, branchKey: string) {
  const parent = normalizePathKey(parentPath);
  const branch = normalizePathKey(branchKey);
  if (!parent) return [];
  return ctx.children.filter((row) => {
    if (!isSonRow(row)) return false;
    if (branch && normalizePathKey(row.branchKey) !== branch) return false;
    const rowParent = normalizePathKey(row.parentName);
    return Boolean(rowParent && rowParent === parent);
  });
}

function daughtersOfParent(ctx: MaternalKinshipContext, parentPath: string, branchKey: string) {
  const parent = normalizePathKey(parentPath);
  const branch = normalizePathKey(branchKey);
  if (!parent) return [];
  return ctx.children.filter((row) => {
    if (!isPublicLineageHiddenPerson(row)) return false;
    if (branch && normalizePathKey(row.branchKey) !== branch) return false;
    return normalizePathKey(row.parentName) === parent;
  });
}

/**
 * Proven maternal relatives of the viewer.
 * Requires a confirmed mother link + family-member wife.
 * Does not invent جد/خال from leaf names or unlinked children.
 */
export function maternalRelativesForViewer(
  viewerId: number,
  ctx: MaternalKinshipContext,
): Record<MaternalKinshipLabel, number[]> {
  const empty: Record<MaternalKinshipLabel, number[]> = {
    'جدك من الأم': [],
    خالك: [],
    'ابن خالك': [],
    'ابن خالتك': [],
  };
  const mother = resolveMotherNode(viewerId, ctx);
  if (!mother) return empty;

  const motherPath = mother.node ? childPath(mother.node) : lineagePath(
    ctx.spouses.find((row) => {
      const link = ctx.motherLinks.find((item) => Number(item.childId) === Number(viewerId));
      return link && Number(row.id) === Number(link.spouseId);
    })?.wifeLineage || '',
  );

  const khals = sonsOfParent(ctx, mother.grandfatherPath, mother.branchKey).filter((row) => {
    if (mother.node && Number(row.id) === Number(mother.node.id)) return false;
    if (motherPath && (childPath(row) === motherPath || samePath(row.name, motherPath))) {
      return false;
    }
    return true;
  });

  const ibnKhal = khals.flatMap((khal) => sonsOfParent(ctx, childPath(khal), khal.branchKey));

  const sisters = daughtersOfParent(ctx, mother.grandfatherPath, mother.branchKey).filter((row) => {
    if (mother.node && Number(row.id) === Number(mother.node.id)) return false;
    if (motherPath && childPath(row) === motherPath) return false;
    return true;
  });

  const ibnKhalaIds = new Set<number>();
  sisters.forEach((sister) => {
    const spouse = uniqueSpouseForSister(ctx.spouses, sister);
    if (!spouse) return;
    ctx.motherLinks.forEach((link) => {
      if (Number(link.spouseId) !== Number(spouse.id)) return;
      if (!isConfirmedLink(link.confidence)) return;
      const child = ctx.children.find((row) => Number(row.id) === Number(link.childId));
      if (!child || !isSonRow(child)) return;
      if (Number(child.id) === Number(viewerId)) return;
      ibnKhalaIds.add(Number(child.id));
    });
  });

  auntSpouseIdsForViewer(viewerId, ctx.spouses, ctx.motherLinks).forEach((spouseId) => {
    ctx.motherLinks.forEach((link) => {
      if (Number(link.spouseId) !== Number(spouseId)) return;
      if (!isConfirmedLink(link.confidence)) return;
      const child = ctx.children.find((row) => Number(row.id) === Number(link.childId));
      if (!child || !isSonRow(child)) return;
      if (Number(child.id) === Number(viewerId)) return;
      ibnKhalaIds.add(Number(child.id));
    });
  });

  return {
    'جدك من الأم': mother.maternalGrandfather
      ? [Number(mother.maternalGrandfather.id)]
      : [],
    خالك: khals.map((row) => Number(row.id)),
    'ابن خالك': ibnKhal.map((row) => Number(row.id)),
    'ابن خالتك': Array.from(ibnKhalaIds),
  };
}

export function resolveMaternalKinshipLabel(
  viewerId: number,
  targetId: number,
  ctx: MaternalKinshipContext,
): MaternalKinshipLabel | null {
  if (!viewerId || !targetId || Number(viewerId) === Number(targetId)) return null;
  const relatives = maternalRelativesForViewer(viewerId, ctx);
  if (relatives['جدك من الأم'].includes(Number(targetId))) return 'جدك من الأم';
  if (relatives.خالك.includes(Number(targetId))) return 'خالك';
  if (relatives['ابن خالك'].includes(Number(targetId))) return 'ابن خالك';
  if (relatives['ابن خالتك'].includes(Number(targetId))) return 'ابن خالتك';
  return null;
}

export function mapFromRelativeSets(
  relatives: Record<MaternalKinshipLabel, number[]>,
): Record<number, MaternalKinshipLabel> {
  const map: Record<number, MaternalKinshipLabel> = {};
  relatives['جدك من الأم'].forEach((id) => {
    map[id] = 'جدك من الأم';
  });
  relatives.خالك.forEach((id) => {
    if (!map[id]) map[id] = 'خالك';
  });
  relatives['ابن خالك'].forEach((id) => {
    if (!map[id]) map[id] = 'ابن خالك';
  });
  relatives['ابن خالتك'].forEach((id) => {
    if (!map[id]) map[id] = 'ابن خالتك';
  });
  return map;
}

/** Match web: look up by tree_child id, then by the same path if ids differ. */
export function kinshipLabelForPerson(
  map: Record<number, string> | undefined,
  person: TreeChild | null | undefined,
  people: TreeChild[] = [],
): string | null {
  if (!map || !person) return null;
  const byId = String(map[Number(person.id)] || '').trim();
  if (byId) return byId;
  const path = nodePathId(person);
  if (!path) return null;
  for (const row of people) {
    const label = String(map[Number(row.id)] || '').trim();
    if (!label) continue;
    if (nodePathId(row) === path) return label;
  }
  return null;
}
