import type { FamilyEvent, TreeChild } from '../types';

export type EncounterMode = 'visitor' | 'member' | 'self';

export function leafPersonName(value: string) {
  const parts = String(value || '')
    .split('/')
    .map((part) => part.trim().replace(/\s*رحمه الله\s*/g, '').replace(/\s*\(رحمه الله\)\s*/g, ''))
    .filter(Boolean);
  return parts.at(-1) || String(value || '').trim();
}

/** Full path / label normalized — never use as sole kinship key when leaf-only. */
export function normalizePathKey(value: string) {
  return String(value || '')
    .replace(/\s*رحمه الله\s*/g, '')
    .replace(/\s*\(رحمه الله\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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

/**
 * Proven kinship from node-path identity only.
 * Never invent labels like «ابن خالك». Never match on leaf name alone.
 */
export function resolveProvenKinshipLabel(
  viewer: TreeChild | null | undefined,
  target: TreeChild | null | undefined,
): string | null {
  if (!viewer || !target) return null;
  if (Number(viewer.id) === Number(target.id)) return null;

  const viewerNode = nodePathId(viewer);
  const targetNode = nodePathId(target);
  if (!viewerNode || !targetNode) return null;

  const viewerParent = normalizePathKey(viewer.parentName);
  const targetParent = normalizePathKey(target.parentName);

  if (viewerParent && viewerParent === targetNode) return 'أبوك';
  if (targetParent && targetParent === viewerNode) return 'ابنك';
  if (viewerParent && targetParent && viewerParent === targetParent) {
    if (!viewerParent.includes('/')) return null;
    return 'أخوك';
  }

  return null;
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
