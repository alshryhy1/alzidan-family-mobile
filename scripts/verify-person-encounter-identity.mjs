/**
 * Smoke: Person Encounter identity binding (sons + occasions).
 * Run: node scripts/verify-person-encounter-identity.mjs
 */
import assert from 'node:assert/strict';

function leafPersonName(value) {
  const parts = String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || String(value || '').trim();
}

function normalizePathKey(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function nodePathId(person) {
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

function isDirectChildPath(parentNode, childName) {
  const parent = normalizePathKey(parentNode);
  const child = normalizePathKey(childName);
  if (!parent || !child) return false;
  if (!child.startsWith(`${parent}/`)) return false;
  const rest = child.slice(parent.length + 1);
  return Boolean(rest) && !rest.includes('/');
}

function findDirectSons(childrenRows, person) {
  const parentNode = nodePathId(person);
  if (!parentNode) return [];
  const parentNameKey = normalizePathKey(person.name);
  const parentAliases = new Set([parentNode]);
  if (parentNameKey.includes('/')) parentAliases.add(parentNameKey);

  return childrenRows.filter((row) => {
    if (String(row.branchKey) !== String(person.branchKey)) return false;
    if (Number(row.id) === Number(person.id)) return false;
    const childParent = normalizePathKey(row.parentName);
    const childPath = nodePathId(row);
    if (childParent && parentAliases.has(childParent)) return true;
    if (isDirectChildPath(parentNode, row.name) || isDirectChildPath(parentNode, childPath)) {
      return true;
    }
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
  });
}

function resolveEventOwnerTreeChildId(event, childrenRows, branchKey) {
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

  const tokens = raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  const given = normalizePathKey(tokens[0] || '');
  if (given) {
    const byGiven = scoped.filter(
      (row) => normalizePathKey(leafPersonName(row.name)) === given,
    );
    if (byGiven.length === 1) return byGiven[0].id;
  }

  const byLeaf = scoped.filter(
    (row) => normalizePathKey(leafPersonName(row.name)) === key,
  );
  if (byLeaf.length === 1) return byLeaf[0].id;
  return null;
}

function findPersonOccasions(events, person, childrenRows) {
  return events.filter((event) => {
    const ownerId = resolveEventOwnerTreeChildId(event, childrenRows, person.branchKey);
    return ownerId != null && Number(ownerId) === Number(person.id);
  });
}

function occasionOwnerDisplayName(event) {
  const raw = String(event.person || '').trim();
  if (!raw) return '';
  const tokens = raw.split(/\s+/).filter(Boolean);
  return tokens[0] || leafPersonName(raw);
}

// —— Fixture ——
const khamisFirst = {
  id: 1,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان',
  name: 'مزيد بن مطلق بن زيدان/خميس',
};
const khamisLast = {
  id: 2,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان/دليميك',
  name: 'مزيد بن مطلق بن زيدان/دليميك/خميس',
};
const mazeed = {
  id: 3,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان/دليميك/خميس',
  name: 'مزيد بن مطلق بن زيدان/دليميك/خميس/مزيد',
};
const arfaj = {
  id: 10,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان/خميس',
  name: 'مزيد بن مطلق بن زيدان/خميس/عرفج',
};
const mansour = {
  id: 11,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان/دليميك/خميس',
  name: 'مزيد بن مطلق بن زيدان/دليميك/خميس/منصور',
};

const rows = [khamisFirst, khamisLast, mazeed, arfaj, mansour];

const sonsFirst = findDirectSons(rows, khamisFirst).map((r) => r.id);
const sonsLast = findDirectSons(rows, khamisLast).map((r) => r.id);

assert.deepEqual(sonsFirst, [10], 'عرفج فقط تحت خميس الأول');
assert.ok(sonsLast.includes(11), 'منصور تحت خميس الأخير');
assert.ok(sonsLast.includes(3), 'مزيد تحت خميس الأخير');
assert.ok(!sonsLast.includes(10), 'عرفج لا يظهر تحت خميس الأخير');

const promotion = {
  id: 'e1',
  person: 'مزيد خميس',
  title: 'ترقية',
  type: 'promotion',
  category: 'happy',
  date: '',
  details: '',
  branch: 'فرع مزيد',
  categoryLabel: '',
};

assert.equal(
  resolveEventOwnerTreeChildId(promotion, rows, 'مزيد'),
  3,
  'ترقية مزيد → owner = مزيد',
);
assert.deepEqual(
  findPersonOccasions([promotion], khamisLast, rows),
  [],
  'ترقية مزيد لا تظهر في لقاء خميس',
);
assert.equal(
  findPersonOccasions([promotion], mazeed, rows).length,
  1,
  'ترقية مزيد تظهر لمزيد فقط',
);
assert.equal(occasionOwnerDisplayName(promotion), 'مزيد');
assert.notEqual(occasionOwnerDisplayName(promotion), 'خميس');

console.log('verify-person-encounter-identity: ok');
