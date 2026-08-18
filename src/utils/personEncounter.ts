import type { FamilyEvent, TreeChild } from '../types';
import { isPublicLineageHiddenPerson } from './personVisibility';

export type EncounterMode = 'visitor' | 'member' | 'self';

export function leafPersonName(value: string) {
  const parts = String(value || '')
    .split('/')
    .map((part) => part.trim().replace(/\s*رحمه الله\s*/g, '').replace(/\s*\(رحمه الله\)\s*/g, ''))
    .filter(Boolean);
  return parts.at(-1) || String(value || '').trim();
}

export function arabicNorm(value: string) {
  return String(value || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Full path / label normalized — never use as sole kinship key when leaf-only. */
export function normalizePathKey(value: string) {
  return arabicNorm(
    String(value || '')
      .replace(/\s*رحمه الله\s*/g, '')
      .replace(/\s*\(رحمه الله\)\s*/g, ''),
  );
}

/**
 * Canonical node identity for relationship joins.
 * Prefer full path (`child_name` / name). If DB has leaf-only name, build
 * `parent_name/leaf` so two people named «خميس» never collapse.
 */
export function nodePathId(person: Pick<TreeChild, 'name' | 'parentName'>): string {
  const rawName = String(person.name || '').trim();
  const nameKey = normalizePathKey(rawName);
  if (!nameKey) return '';
  if (rawName.includes('/')) return nameKey;

  const parentKey = normalizePathKey(person.parentName);
  const leaf = normalizePathKey(leafPersonName(rawName));
  if (parentKey && leaf) {
    if (parentKey.endsWith(`/${leaf}`) || parentKey === leaf) return parentKey;
    return `${parentKey}/${leaf}`;
  }
  return nameKey;
}

/** Public lineage chain from this node's path — not a personal kinship claim. */
export function publicLineageChain(personName: string, limit = 3): string[] {
  const parts = String(personName || '')
    .split('/')
    .map((part) => part.trim().replace(/\s*رحمه الله\s*/g, '').replace(/\s*\(رحمه الله\)\s*/g, ''))
    .filter(Boolean);
  if (!parts.length) return [];
  return parts.slice(-limit);
}

export function resolveEncounterMode(input: {
  hasMemberSession: boolean;
  viewerTreeChildId: number | null | undefined;
  targetTreeChildId: number;
}): EncounterMode {
  if (
    input.hasMemberSession &&
    input.viewerTreeChildId != null &&
    Number(input.viewerTreeChildId) === Number(input.targetTreeChildId)
  ) {
    return 'self';
  }
  if (input.hasMemberSession && input.viewerTreeChildId != null) {
    return 'member';
  }
  return 'visitor';
}

function pathSegments(person: Pick<TreeChild, 'name' | 'parentName'>): string[] {
  const id = nodePathId(person);
  if (!id) return [];
  return id.split('/').map((part) => part.trim()).filter(Boolean);
}

function commonPrefixLength(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (
    index < limit &&
    normalizePathKey(left[index] || '') === normalizePathKey(right[index] || '')
  ) {
    index += 1;
  }
  return index;
}

function grandfatherOrdinalLabel(generationsUp: number): string | null {
  if (generationsUp === 2) return 'الجد';
  if (generationsUp === 3) return 'الجد الثاني';
  if (generationsUp === 4) return 'الجد الرابع';
  if (generationsUp === 5) return 'الجد الخامس';
  return null;
}

function parentPathKey(path: string) {
  const parts = normalizePathKey(path)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return '';
  return parts.slice(0, -1).join('/');
}

/** Derive parent path from full child path when parent_name is missing. */
export function effectiveParentName(person: Pick<TreeChild, 'name' | 'parentName'>): string {
  const explicit = String(person.parentName || '').trim();
  if (explicit) return explicit;
  const path = nodePathId(person);
  if (!path) return '';
  return parentPathKey(path);
}

/**
 * Proven kinship for the member encounter.
 * Path labels: أبوك / ابنك / أخ / عمك / ابن عمك / ابن أخيك / جدك / حفيدك
 * Link labels (wife + mother_links): ابنك / ابن أختك / حفيدك من ابنتك
 */
export function resolveProvenKinshipLabel(
  viewer: TreeChild | null | undefined,
  target: TreeChild | null | undefined,
  maternalLabel?: string | null,
): string | null {
  const maternal = String(maternalLabel || '').trim();
  if (!target) return maternal || null;
  if (!viewer) return maternal || null;
  if (Number(viewer.id) && Number(target.id) && Number(viewer.id) === Number(target.id)) {
    return null;
  }
  const viewerNode = nodePathId(viewer);
  const targetNode = nodePathId(target);
  if (!viewerNode || !targetNode) return maternal || null;

  const viewerParent = normalizePathKey(effectiveParentName(viewer));
  const targetParent = normalizePathKey(effectiveParentName(target));

  if (viewerParent && viewerParent === targetNode) return 'أبوك';
  if (targetParent && targetParent === viewerNode) return 'ابنك';
  if (maternal === 'ابنك') return 'ابنك';
  if (viewerParent && targetParent && viewerParent === targetParent) {
    if (!viewerParent.includes('/')) return maternal || null;
    if (maternal === 'أخ من أمك') return 'شقيقك';
    return 'أخ';
  }

  const paternalGrandfather = parentPathKey(effectiveParentName(viewer) || viewer.parentName);
  if (paternalGrandfather && paternalGrandfather === targetNode) return 'جدك من الأب';
  const targetPaternalGrandfather = parentPathKey(effectiveParentName(target) || target.parentName);
  if (targetPaternalGrandfather && targetPaternalGrandfather === viewerNode) return 'حفيدك';

  if (maternal === 'حفيدك من ابنتك') return 'حفيدك من ابنتك';
  if (maternal === 'ابن أختك') return 'ابن أختك';
  if (maternal === 'أخ من أمك') return 'أخ من أمك';
  if (maternal === 'حفيدك') return 'حفيدك';

  const viewerPath = pathSegments(viewer);
  const targetPath = pathSegments(target);
  const shared = commonPrefixLength(viewerPath, targetPath);
  if (!shared) return maternal || null;

  const viewerUp = viewerPath.length - shared;
  const targetUp = targetPath.length - shared;

  if (targetUp === 0 && viewerUp === 2) return 'جدك من الأب';
  if (viewerUp === 0 && targetUp === 2) {
    if (maternal === 'حفيدك من ابنتك') return 'حفيدك من ابنتك';
    return 'حفيدك';
  }
  if (viewerUp === 1 && targetUp === 2) {
    if (maternal === 'ابن أختك') return 'ابن أختك';
    return 'ابن أخيك';
  }
  if (viewerUp === 2 && targetUp === 1) {
    if (maternal === 'خالك') return 'خالك';
    return 'عمك';
  }
  if (viewerUp === 2 && targetUp === 2) {
    if (
      maternal === 'أخ من أمك' ||
      maternal === 'ابن خالك' ||
      maternal === 'ابن خالتك'
    ) {
      return maternal;
    }
    return 'ابن عمك';
  }

  return maternal || null;
}

/**
 * Shared-ancestor badge for member encounter.
 * Close kinship (أب / أخ / جد من الأب أو الأم) is handled by resolveProvenKinshipLabel.
 * 4th/5th grandfather is stated explicitly. Farther or unproven → hide.
 */
export function resolveSharedAncestorBadge(
  viewer: TreeChild | null | undefined,
  target: TreeChild | null | undefined,
): string | null {
  if (!viewer || !target) return null;
  if (Number(viewer.id) === Number(target.id)) return null;
  if (resolveProvenKinshipLabel(viewer, target)) return null;

  const viewerPath = pathSegments(viewer);
  const targetPath = pathSegments(target);
  if (viewerPath.length < 2 || targetPath.length < 2) return null;

  const shared = commonPrefixLength(viewerPath, targetPath);
  if (!shared) return null;

  const viewerUp = viewerPath.length - shared;
  const targetUp = targetPath.length - shared;
  if (viewerUp < 1 || targetUp < 1) return null;

  const meetAt = Math.max(viewerUp, targetUp);
  const ancestorName = leafPersonName(viewerPath[shared - 1] || '');
  if (!ancestorName) return null;

  const ordinal = grandfatherOrdinalLabel(meetAt);
  if (!ordinal) return null;
  if (meetAt >= 4) return `لا يجمعكما إلا ${ordinal}: ${ancestorName}`;
  return `يجمعكما ${ordinal}: ${ancestorName}`;
}

function isDirectChildPath(parentNode: string, childName: string): boolean {
  const parent = normalizePathKey(parentNode);
  const child = normalizePathKey(childName);
  if (!parent || !child) return false;
  if (!child.startsWith(`${parent}/`)) return false;
  const rest = child.slice(parent.length + 1);
  return Boolean(rest) && !rest.includes('/');
}

/**
 * Direct children of THIS tree_child row only.
 * Identity join — never `name leaf === خميس`.
 */
export function findDirectSons(
  childrenRows: TreeChild[],
  person: TreeChild,
): TreeChild[] {
  const parentNode = nodePathId(person);
  if (!parentNode) return [];

  const parentNameKey = normalizePathKey(person.name);
  const parentAliases = new Set<string>([parentNode]);
  if (parentNameKey.includes('/')) parentAliases.add(parentNameKey);

  return childrenRows
    .filter((row) => {
      if (String(row.branchKey) !== String(person.branchKey)) return false;
      if (Number(row.id) === Number(person.id)) return false;

      const childParent = normalizePathKey(row.parentName);
      const childPath = nodePathId(row);

      // 1) parent_name equals this node's full path identity
      if (childParent && parentAliases.has(childParent)) return true;

      // 2) child's path is exactly parentNode/OneSegment (graph path under this node)
      if (isDirectChildPath(parentNode, row.name) || isDirectChildPath(parentNode, childPath)) {
        return true;
      }

      // 3) leaf-only parent_name: accept ONLY if that leaf uniquely resolves to this person.id
      if (childParent && !childParent.includes('/')) {
        const parentsWithLeaf = childrenRows.filter(
          (candidate) =>
            String(candidate.branchKey) === String(person.branchKey) &&
            normalizePathKey(leafPersonName(candidate.name)) === childParent,
        );
        if (parentsWithLeaf.length === 1 && Number(parentsWithLeaf[0].id) === Number(person.id)) {
          return true;
        }
      }

      return false;
    })
    .filter((row) => !isPublicLineageHiddenPerson(row))
    .slice(0, 24);
}

/**
 * Resolve which tree_child owns an event.person label.
 * Returns null when ambiguous or unmatched — never guess.
 */
export function resolveEventOwnerTreeChildId(
  event: FamilyEvent,
  childrenRows: TreeChild[],
  branchKey?: string | null,
): number | null {
  const raw = String(event.person || '').trim();
  if (!raw) return null;
  const key = normalizePathKey(raw);
  const scoped = branchKey
    ? childrenRows.filter((row) => String(row.branchKey) === String(branchKey))
    : childrenRows;

  const byPath = scoped.filter(
    (row) => nodePathId(row) === key || normalizePathKey(row.name) === key,
  );
  if (byPath.length === 1) return byPath[0].id;
  if (byPath.length > 1) return null;

  // "مزيد خميس" → prefer first token as given name when unique
  const tokens = raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  const given = normalizePathKey(tokens[0] || '');
  if (given) {
    const byGiven = scoped.filter(
      (row) => normalizePathKey(leafPersonName(row.name)) === given,
    );
    if (byGiven.length === 1) return byGiven[0].id;
  }

  // Exact full-string equals unique leaf (event.person === «مزيد» only)
  const byLeaf = scoped.filter(
    (row) => normalizePathKey(leafPersonName(row.name)) === key,
  );
  if (byLeaf.length === 1) return byLeaf[0].id;

  return null;
}

function eventBelongsToPerson(
  event: FamilyEvent,
  person: TreeChild,
  childrenRows: TreeChild[],
): boolean {
  const ownerId = resolveEventOwnerTreeChildId(event, childrenRows, person.branchKey);
  if (ownerId == null) return false;
  return Number(ownerId) === Number(person.id);
}

/** Occasions owned by this person identity — not sibling/namesake occasions. */
export function findPersonOccasions(
  events: FamilyEvent[],
  person: TreeChild,
  childrenRows: TreeChild[] = [],
): FamilyEvent[] {
  return events
    .filter((event) => eventBelongsToPerson(event, person, childrenRows))
    .slice(0, 3);
}

/** Display name for occasion CTA — always the occasion owner, never the opened page person. */
export function occasionOwnerDisplayName(event: FamilyEvent): string {
  const raw = String(event.person || '').trim();
  if (!raw) return '';
  // Prefer given name token for CTA («مزيد» from «مزيد خميس»)
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length >= 1) return tokens[0];
  return leafPersonName(raw);
}

/** @deprecated leaf-only key — do not use for relationships */
export function normalizePersonKey(value: string) {
  return leafPersonName(value)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
