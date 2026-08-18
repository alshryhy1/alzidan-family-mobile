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

function pathSegments(person) {
  const id = nodePathId(person);
  if (!id) return [];
  return id.split('/').map((part) => part.trim()).filter(Boolean);
}

function commonPrefixLength(left, right) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && normalizePathKey(left[index] || '') === normalizePathKey(right[index] || '')) {
    index += 1;
  }
  return index;
}

function resolveSharedAncestorBadge(viewer, target) {
  if (Number(viewer.id) === Number(target.id)) return null;
  const viewerPath = pathSegments(viewer);
  const targetPath = pathSegments(target);
  const shared = commonPrefixLength(viewerPath, targetPath);
  if (!shared) return null;
  const viewerUp = viewerPath.length - shared;
  const targetUp = targetPath.length - shared;
  if (viewerUp < 1 || targetUp < 1) return null;
  const meetAt = Math.max(viewerUp, targetUp);
  const ancestorName = leafPersonName(viewerPath[shared - 1] || '');
  if (meetAt === 2) return `يجمعكما الجد: ${ancestorName}`;
  if (meetAt === 3) return `يجمعكما الجد الثاني: ${ancestorName}`;
  if (meetAt === 4) return `لا يجمعكما إلا الجد الرابع: ${ancestorName}`;
  if (meetAt === 5) return `لا يجمعكما إلا الجد الخامس: ${ancestorName}`;
  return null;
}

const hasan = {
  id: 20,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان/دليميك/خميس',
  name: 'مزيد بن مطلق بن زيدان/دليميك/خميس/حسن',
};
const cousin = {
  id: 21,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان/دليميك/منصور',
  name: 'مزيد بن مطلق بن زيدان/دليميك/منصور/فلان',
};
const distant = {
  id: 30,
  branchKey: 'لاحم',
  parentName: 'زيدان/مطلق/لاحم/عيد/عبدالمحسن',
  name: 'زيدان/مطلق/لاحم/عيد/عبدالمحسن/عبيدالله',
};
const farViewer = {
  id: 31,
  branchKey: 'مزيد',
  parentName: 'زيدان/مطلق/مزيد/دليميك/خميس',
  name: 'زيدان/مطلق/مزيد/دليميك/خميس/حسن',
};

assert.equal(
  resolveSharedAncestorBadge(hasan, mansour),
  null,
  'أبناء الأب نفسه: لا شارة جد — هذه أخوة',
);
assert.equal(
  resolveSharedAncestorBadge(hasan, cousin),
  'يجمعكما الجد: دليميك',
);
assert.equal(
  resolveSharedAncestorBadge(farViewer, distant),
  'لا يجمعكما إلا الجد الرابع: مطلق',
);
assert.equal(
  resolveSharedAncestorBadge(hasan, {
    id: 40,
    branchKey: 'لاحم',
    parentName: 'زيدان/عيد/عبدالمحسن',
    name: 'زيدان/عيد/عبدالمحسن/عبيدالله',
  }),
  null,
  'لا مسار مشترك مثبت → لا شارة قرابة',
);

function parentPathKey(path) {
  const parts = normalizePathKey(path)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return '';
  return parts.slice(0, -1).join('/');
}

function effectiveParentName(person) {
  const explicit = String(person.parentName || '').trim();
  if (explicit) return explicit;
  const path = nodePathId(person);
  if (!path) return '';
  return parentPathKey(path);
}

function resolveProvenKinshipLabel(viewer, target, maternalLabel) {
  const maternal = String(maternalLabel || '').trim();
  if (!target) return maternal || null;
  if (!viewer) return maternal || null;
  if (Number(viewer.id) && Number(target.id) && Number(viewer.id) === Number(target.id)) return null;
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
  const viewerPath = pathSegments(viewer);
  const targetPath = pathSegments(target);
  const shared = commonPrefixLength(viewerPath, targetPath);
  if (!shared) return maternal || null;
  const viewerUp = viewerPath.length - shared;
  const targetUp = targetPath.length - shared;
  if (targetUp === 0 && viewerUp === 2) return 'جدك من الأب';
  if (viewerUp === 0 && targetUp === 2) return maternal === 'حفيدك من ابنتك' ? 'حفيدك من ابنتك' : 'حفيدك';
  if (viewerUp === 1 && targetUp === 2) return maternal === 'ابن أختك' ? 'ابن أختك' : 'ابن أخيك';
  if (viewerUp === 2 && targetUp === 1) return maternal === 'خالك' ? 'خالك' : 'عمك';
  if (viewerUp === 2 && targetUp === 2) {
    if (maternal === 'أخ من أمك' || maternal === 'ابن خالك' || maternal === 'ابن خالتك') return maternal;
    return 'ابن عمك';
  }
  return maternal || null;
}

const dlymik = {
  id: 50,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان',
  name: 'مزيد بن مطلق بن زيدان/دليميك',
};

assert.equal(resolveProvenKinshipLabel(hasan, khamisLast), 'أبوك');
assert.equal(resolveProvenKinshipLabel(hasan, dlymik), 'جدك من الأب');
assert.equal(resolveProvenKinshipLabel(dlymik, hasan), 'حفيدك');
assert.equal(
  resolveProvenKinshipLabel(hasan, {
    id: 859,
    branchKey: 'زيدان',
    parentName: 'زيدان بن مطلق بن زيدان/قرينيس/مشعان/ملقاط/خزيم',
    name: 'زيدان بن مطلق بن زيدان/قرينيس/مشعان/ملقاط/خزيم/سالم',
  }),
  null,
  'لا جد من الأب بلا مسار أبوي',
);
assert.equal(
  resolveProvenKinshipLabel(
    hasan,
    {
      id: 850,
      branchKey: 'زيدان',
      parentName: 'زيدان بن مطلق بن زيدان/قرينيس/مشعان/ملقاط',
      name: 'زيدان بن مطلق بن زيدان/قرينيس/مشعان/ملقاط/خزيم',
    },
    'جدك من الأم',
  ),
  'جدك من الأم',
);
assert.equal(
  resolveProvenKinshipLabel(
    hasan,
    {
      id: 31,
      branchKey: 'زايد',
      parentName: 'زايد بن مطلق بن زيدان/عتيق/زياد',
      name: 'زايد بن مطلق بن زيدان/عتيق/زياد/عبدالحميد',
    },
    'ابن خالتك',
  ),
  'ابن خالتك',
  'ابن خالة من فرع آخر يبقى ظاهرًا',
);

assert.equal(resolveProvenKinshipLabel(hasan, mansour), 'أخ');
const uncle = {
  id: 8,
  branchKey: 'مزيد',
  parentName: 'مزيد بن مطلق بن زيدان/دليميك',
  name: 'مزيد بن مطلق بن زيدان/دليميك/سعد',
};
assert.equal(resolveProvenKinshipLabel(hasan, uncle), 'عمك');
const paternalCousin = {
  id: 81,
  branchKey: 'مزيد',
  parentName: uncle.name,
  name: uncle.name + '/فهد',
};
assert.equal(resolveProvenKinshipLabel(hasan, paternalCousin), 'ابن عمك');
const nephew = {
  id: 17,
  branchKey: 'مزيد',
  parentName: mansour.name,
  name: mansour.name + '/يوسف',
};
assert.equal(resolveProvenKinshipLabel(hasan, nephew), 'ابن أخيك');
assert.equal(
  resolveProvenKinshipLabel(hasan, nephew, 'ابن أختك'),
  'ابن أختك',
);
assert.equal(
  resolveProvenKinshipLabel(null, nephew, 'ابن أختك'),
  'ابن أختك',
  'تسمية الـRPC تظهر حتى لو صف البنت غير ظاهر في الشجرة العامة',
);

console.log('verify-person-encounter-identity: ok');
