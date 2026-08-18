/**
 * Proven maternal kinship: خال / ابن خال / ابن خالة.
 * Run: node scripts/verify-maternal-kinship.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

function leafPersonName(value) {
  const parts = String(value || '')
    .split('/')
    .map((part) => part.trim().replace(/\s*رحمه الله\s*/g, '').replace(/\s*\(رحمه الله\)\s*/g, ''))
    .filter(Boolean);
  return parts.at(-1) || String(value || '').trim();
}

function normalizePathKey(value) {
  return String(value || '')
    .replace(/\s*رحمه الله\s*/g, '')
    .replace(/\s*\(رحمه الله\)\s*/g, '')
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

function isPublicLineageHiddenPerson(person) {
  const gender = String(person?.gender || '').trim().toLowerCase();
  return (
    gender === 'daughter' ||
    gender === 'female' ||
    gender === 'f' ||
    gender === 'أنثى' ||
    gender === 'انثى' ||
    gender === 'ابنة' ||
    gender === 'بنت'
  );
}

function isConfirmedLink(confidence) {
  const value = String(confidence || '').trim().toLowerCase();
  return !value || value === 'confirmed';
}

function isActiveSpouse(status) {
  const value = String(status || 'active').trim().toLowerCase();
  return !value || value === 'active';
}

function isFamilyMember(value) {
  return value === true;
}

function parentPathOf(path) {
  const parts = normalizePathKey(path).split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  return parts.slice(0, -1).join('/');
}

function lineagePath(value) {
  const raw = String(value || '').trim();
  if (!raw.includes('/')) return '';
  return normalizePathKey(raw);
}

function isSonRow(row) {
  return !isPublicLineageHiddenPerson(row);
}

function arabicNorm(value) {
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

function nasabTokens(value) {
  return arabicNorm(value)
    .replace(/(^|\s)(بنت|بن|ابن)(\s|$)/g, ' ')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueFatherNodeFromNasab(rows, branchKey, query) {
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

function uniqueByNasab(rows, branchKey, query) {
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
    const narrowed = inBranch.filter((row) => arabicNorm(leafPersonName(row.parentName)) === father);
    return narrowed.length === 1 ? narrowed[0] : null;
  }
  return null;
}

function uniqueMaleNodeByPath(rows, path, branchKey) {
  const wanted = normalizePathKey(path);
  const branch = normalizePathKey(branchKey);
  if (!wanted) return null;
  const matches = rows.filter((row) => {
    if (!isSonRow(row)) return false;
    if (branch && normalizePathKey(row.branchKey) !== branch) return false;
    return nodePathId(row) === wanted || normalizePathKey(row.name) === wanted;
  });
  return matches.length === 1 ? matches[0] : null;
}

function uniqueSpouseForSister(spouses, sister) {
  const sisterPath = nodePathId(sister);
  const sisterLeaf = normalizePathKey(leafPersonName(sister.name));
  const branch = normalizePathKey(sister.branchKey);
  const byPath = spouses.filter((spouse) => {
    if (!isActiveSpouse(spouse.status) || !isFamilyMember(spouse.wifeIsFamilyMember)) return false;
    const path = lineagePath(spouse.wifeLineage);
    return Boolean(path && sisterPath && path === sisterPath);
  });
  if (byPath.length === 1) return byPath[0];
  if (byPath.length > 1) return null;
  if (!sisterLeaf) return null;
  const byLeaf = spouses.filter((spouse) => {
    if (!isActiveSpouse(spouse.status) || !isFamilyMember(spouse.wifeIsFamilyMember)) return false;
    if (lineagePath(spouse.wifeLineage)) return false;
    if (branch && spouse.wifeBranchKey && normalizePathKey(spouse.wifeBranchKey) !== branch) return false;
    const nameLeaf = normalizePathKey(leafPersonName(spouse.wifeName || ''));
    const lineageLeaf = normalizePathKey(leafPersonName(spouse.wifeLineage || ''));
    return nameLeaf === sisterLeaf || lineageLeaf === sisterLeaf;
  });
  return byLeaf.length === 1 ? byLeaf[0] : null;
}

function resolveMotherNode(viewerId, ctx) {
  const link = ctx.motherLinks.find(
    (row) => Number(row.childId) === Number(viewerId) && isConfirmedLink(row.confidence),
  );
  if (!link) return null;
  const spouse = ctx.spouses.find((row) => Number(row.id) === Number(link.spouseId));
  if (spouse && !isActiveSpouse(spouse.status)) return null;
  const isMember = spouse ? isFamilyMember(spouse.wifeIsFamilyMember) : isFamilyMember(link.motherIsFamilyMember);
  if (!isMember) return null;
  const lineage = String(spouse?.wifeLineage || link.motherLineage || '').trim();
  const name = String(spouse?.wifeName || link.motherName || '').trim();
  const branchKey = String(spouse?.wifeBranchKey || link.motherBranchKey || '').trim();
  const path = lineagePath(lineage);
  let node = null;
  if (path) {
    const matches = ctx.children.filter((row) => {
      if (branchKey && normalizePathKey(row.branchKey) !== normalizePathKey(branchKey)) return false;
      return nodePathId(row) === path || normalizePathKey(row.name) === path;
    });
    if (matches.length === 1) node = matches[0];
    else if (matches.length > 1) return null;
  }
  if (!node && (name || lineage)) node = uniqueByNasab(ctx.children, branchKey, name || lineage);
  if (!node && (name || lineage)) {
    const fatherNode = uniqueFatherNodeFromNasab(ctx.children, branchKey, name || lineage);
    if (fatherNode) {
      const grandfatherPath = nodePathId(fatherNode);
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
  const grandfatherPath = normalizePathKey(node.parentName) || parentPathOf(nodePathId(node));
  if (!grandfatherPath) return null;
  const resolvedBranch = node.branchKey || branchKey;
  return {
    node,
    grandfatherPath,
    branchKey: resolvedBranch,
    maternalGrandfather: uniqueMaleNodeByPath(ctx.children, grandfatherPath, resolvedBranch),
  };
}

function sonsOfParent(ctx, parentPath, branchKey) {
  const parent = normalizePathKey(parentPath);
  const branch = normalizePathKey(branchKey);
  if (!parent) return [];
  return ctx.children.filter((row) => {
    if (!isSonRow(row)) return false;
    if (branch && normalizePathKey(row.branchKey) !== branch) return false;
    return normalizePathKey(row.parentName) === parent;
  });
}

function daughtersOfParent(ctx, parentPath, branchKey) {
  const parent = normalizePathKey(parentPath);
  const branch = normalizePathKey(branchKey);
  if (!parent) return [];
  return ctx.children.filter((row) => {
    if (!isPublicLineageHiddenPerson(row)) return false;
    if (branch && normalizePathKey(row.branchKey) !== branch) return false;
    return normalizePathKey(row.parentName) === parent;
  });
}

function maternalRelativesForViewer(viewerId, ctx) {
  const empty = { 'جدك من الأم': [], خالك: [], 'ابن خالك': [], 'ابن خالتك': [] };
  const mother = resolveMotherNode(viewerId, ctx);
  if (!mother) return empty;
  const link = ctx.motherLinks.find((item) => Number(item.childId) === Number(viewerId));
  const spouse = ctx.spouses.find((row) => link && Number(row.id) === Number(link.spouseId));
  const motherPath = mother.node ? nodePathId(mother.node) : lineagePath(spouse?.wifeLineage || '');
  const khals = sonsOfParent(ctx, mother.grandfatherPath, mother.branchKey).filter((row) => {
    if (mother.node && Number(row.id) === Number(mother.node.id)) return false;
    if (motherPath && (nodePathId(row) === motherPath || normalizePathKey(row.name) === motherPath)) return false;
    return true;
  });
  const ibnKhal = khals.flatMap((khal) => sonsOfParent(ctx, nodePathId(khal), khal.branchKey));
  const sisters = daughtersOfParent(ctx, mother.grandfatherPath, mother.branchKey).filter((row) => {
    if (mother.node && Number(row.id) === Number(mother.node.id)) return false;
    if (motherPath && nodePathId(row) === motherPath) return false;
    return true;
  });
  const ibnKhalaIds = new Set();
  sisters.forEach((sister) => {
    const sisterSpouse = uniqueSpouseForSister(ctx.spouses, sister);
    if (!sisterSpouse) return;
    ctx.motherLinks.forEach((item) => {
      if (Number(item.spouseId) !== Number(sisterSpouse.id)) return;
      if (!isConfirmedLink(item.confidence)) return;
      const child = ctx.children.find((row) => Number(row.id) === Number(item.childId));
      if (!child || !isSonRow(child)) return;
      if (Number(child.id) === Number(viewerId)) return;
      ibnKhalaIds.add(Number(child.id));
    });
  });
  return {
    'جدك من الأم': mother.maternalGrandfather ? [Number(mother.maternalGrandfather.id)] : [],
    خالك: khals.map((row) => Number(row.id)),
    'ابن خالك': ibnKhal.map((row) => Number(row.id)),
    'ابن خالتك': Array.from(ibnKhalaIds),
  };
}

function resolveMaternalKinshipLabel(viewerId, targetId, ctx) {
  if (!viewerId || !targetId || Number(viewerId) === Number(targetId)) return null;
  const relatives = maternalRelativesForViewer(viewerId, ctx);
  if (relatives['جدك من الأم'].includes(Number(targetId))) return 'جدك من الأم';
  if (relatives.خالك.includes(Number(targetId))) return 'خالك';
  if (relatives['ابن خالك'].includes(Number(targetId))) return 'ابن خالك';
  if (relatives['ابن خالتك'].includes(Number(targetId))) return 'ابن خالتك';
  return null;
}

const grandfather = {
  id: 1,
  branchKey: 'خزيم',
  parentName: 'ملقاط',
  name: 'ملقاط/خزيم',
  gender: 'son',
};
const mother = {
  id: 2,
  branchKey: 'خزيم',
  parentName: 'ملقاط/خزيم',
  name: 'ملقاط/خزيم/عقيله',
  gender: 'daughter',
};
const khal = {
  id: 3,
  branchKey: 'خزيم',
  parentName: 'ملقاط/خزيم',
  name: 'ملقاط/خزيم/سعد',
  gender: 'son',
};
const aunt = {
  id: 4,
  branchKey: 'خزيم',
  parentName: 'ملقاط/خزيم',
  name: 'ملقاط/خزيم/نوره',
  gender: 'daughter',
};
const father = {
  id: 10,
  branchKey: 'مزيد',
  parentName: 'مزيد/خميس',
  name: 'مزيد/خميس/عيد',
  gender: 'son',
};
const viewer = {
  id: 11,
  branchKey: 'مزيد',
  parentName: 'مزيد/خميس/عيد',
  name: 'مزيد/خميس/عيد/حسن',
  gender: 'son',
};
const ibnKhal = {
  id: 20,
  branchKey: 'خزيم',
  parentName: 'ملقاط/خزيم/سعد',
  name: 'ملقاط/خزيم/سعد/فهد',
  gender: 'son',
};
const auntHusband = {
  id: 30,
  branchKey: 'لاحم',
  parentName: 'لاحم/عيد',
  name: 'لاحم/عيد/محمد',
  gender: 'son',
};
const ibnKhala = {
  id: 31,
  branchKey: 'لاحم',
  parentName: 'لاحم/عيد/محمد',
  name: 'لاحم/عيد/محمد/ناصر',
  gender: 'son',
};
const stranger = {
  id: 99,
  branchKey: 'زيدان',
  parentName: 'زيدان/مطلق',
  name: 'زيدان/مطلق/فلان',
  gender: 'son',
};

const ctx = {
  children: [grandfather, mother, khal, aunt, father, viewer, ibnKhal, auntHusband, ibnKhala, stranger],
  spouses: [
    {
      id: 100,
      husbandId: 10,
      wifeName: 'عقيله',
      wifeLineage: 'ملقاط/خزيم/عقيله',
      wifeIsFamilyMember: true,
      wifeBranchKey: 'خزيم',
      status: 'active',
    },
    {
      id: 200,
      husbandId: 30,
      wifeName: 'نوره',
      wifeLineage: 'ملقاط/خزيم/نوره',
      wifeIsFamilyMember: true,
      wifeBranchKey: 'خزيم',
      status: 'active',
    },
  ],
  motherLinks: [
    { childId: 11, spouseId: 100, confidence: 'confirmed' },
    { childId: 31, spouseId: 200, confidence: 'confirmed' },
  ],
};

assert.equal(resolveMaternalKinshipLabel(11, 1, ctx), 'جدك من الأم');
assert.equal(resolveMaternalKinshipLabel(11, 3, ctx), 'خالك');
assert.equal(resolveMaternalKinshipLabel(11, 20, ctx), 'ابن خالك');
assert.equal(resolveMaternalKinshipLabel(11, 31, ctx), 'ابن خالتك');
assert.equal(resolveMaternalKinshipLabel(11, 10, ctx), null, 'الأب ليس خالاً');
assert.equal(resolveMaternalKinshipLabel(11, 99, ctx), null, 'لا اختراع بلا رابط');
assert.equal(resolveMaternalKinshipLabel(11, 2, ctx), null, 'الأم نفسها لا تُعلَّم كخال');

const noLink = { ...ctx, motherLinks: [] };
assert.equal(resolveMaternalKinshipLabel(11, 3, noLink), null, 'بدون ربط أم لا خال');

const outside = {
  ...ctx,
  spouses: ctx.spouses.map((row) =>
    row.id === 100 ? { ...row, wifeIsFamilyMember: false } : row,
  ),
};
assert.equal(resolveMaternalKinshipLabel(11, 3, outside), null, 'أم من خارج العائلة لا تُنتج خال');

const unlinkedAuntChild = {
  ...ctx,
  motherLinks: [{ childId: 11, spouseId: 100, confidence: 'confirmed' }],
};
assert.equal(
  resolveMaternalKinshipLabel(11, 31, unlinkedAuntChild),
  null,
  'ابن الخالة فقط إن رُبطت أمه بالأبناء',
);

const pathOnly = {
  children: ctx.children.filter((row) => row.gender !== 'daughter'),
  spouses: ctx.spouses,
  motherLinks: ctx.motherLinks,
};
assert.equal(resolveMaternalKinshipLabel(11, 3, pathOnly), 'خالك', 'مسار نسب الأم يكفي للخال دون صف الابنة');
assert.equal(resolveMaternalKinshipLabel(11, 31, pathOnly), null, 'ابن خالة يحتاج صف الخالة في المحرك');

const khuzaym = 'زيدان بن مطلق بن زيدان/قرينيس/مشعان/ملقاط/خزيم';
const liveNasab = {
  children: [
    {
      id: 850,
      branchKey: 'زيدان',
      parentName: 'زيدان بن مطلق بن زيدان/قرينيس/مشعان/ملقاط',
      name: khuzaym,
      gender: null,
    },
    {
      id: 859,
      branchKey: 'زيدان',
      parentName: khuzaym,
      name: khuzaym + '/سالم',
      gender: null,
    },
    {
      id: 1852,
      branchKey: 'زيدان',
      parentName: khuzaym,
      name: khuzaym + '/عقيله',
      gender: 'daughter',
    },
    {
      id: 120,
      branchKey: 'مزيد',
      parentName: 'مزيد بن مطلق بن زيدان/خميس/دليميك/خميس',
      name: 'مزيد بن مطلق بن زيدان/خميس/دليميك/خميس/حسن',
      gender: null,
    },
  ],
  spouses: [
    {
      id: 1,
      husbandId: 116,
      wifeName: 'عقيلة بنت خزيم بن ملقاط بن مشعان بن قرينيس بن زيدان بن مطلق',
      wifeLineage: 'عقيلة بنت خزيم بن ملقاط بن مشعان بن قرينيس بن زيدان بن مطلق',
      wifeIsFamilyMember: true,
      wifeBranchKey: 'زيدان',
      status: 'active',
    },
  ],
  motherLinks: [{ childId: 120, spouseId: 1, confidence: 'confirmed' }],
};
assert.equal(
  resolveMaternalKinshipLabel(120, 850, liveNasab),
  'جدك من الأم',
  'خزيم أبو عقيلة هو جدك من الأم',
);
assert.equal(
  resolveMaternalKinshipLabel(120, 859, liveNasab),
  'خالك',
  'عقيلة بنت خزيم تطابق عقيله وتُظهر سالم خالاً',
);

const liveNasabNoDaughter = {
  ...liveNasab,
  children: [
    liveNasab.children[0],
    liveNasab.children[1],
    liveNasab.children[3],
  ],
};
assert.equal(
  resolveMaternalKinshipLabel(120, 850, liveNasabNoDaughter),
  'جدك من الأم',
  'أبو الأم من نسب عقيلة هو جدك من الأم',
);
assert.equal(
  resolveMaternalKinshipLabel(120, 859, liveNasabNoDaughter),
  'خالك',
  'نص النسب يكفي لإيجاد أبي الأم ثم خالها دون صف الابنة',
);

function wifeNasabText(spouse) {
  const name = String(spouse.wifeName || '').trim();
  const lineage = String(spouse.wifeLineage || '').trim();
  const nameCount = nasabTokens(name).length;
  const lineageCount = nasabTokens(lineage).length;
  if (lineageCount > nameCount) return lineage;
  if (nameCount > lineageCount) return name;
  if (lineage.includes('/')) return lineage;
  return lineage || name;
}

function wifeRoleTowardViewer(spouse, viewer) {
  if (!spouse || !viewer || !isFamilyMember(spouse.wifeIsFamilyMember)) return null;
  if (!isActiveSpouse(spouse.status)) return null;
  const viewerPath = normalizePathKey(nodePathId(viewer));
  const viewerParent = normalizePathKey(viewer.parentName);
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

function linkKinshipByTargetId(viewer, ctx) {
  const map = {};
  const counts = {};
  (ctx.spouses || []).forEach((spouse) => {
    if (!spouse?.husbandId || !isActiveSpouse(spouse.status)) return;
    counts[spouse.husbandId] = (counts[spouse.husbandId] || 0) + 1;
  });
  (ctx.spouses || []).forEach((spouse) => {
    const role = wifeRoleTowardViewer(spouse, viewer);
    if (!role) return;
    const label = role === 'self' ? 'ابنك' : role === 'daughter' ? 'حفيدك من ابنتك' : 'ابن أختك';
    const ids = [];
    (ctx.motherLinks || []).forEach((item) => {
      if (Number(item.spouseId) !== Number(spouse.id) || !isConfirmedLink(item.confidence)) return;
      if (item.childId) ids.push(Number(item.childId));
    });
    if (!ids.length && counts[spouse.husbandId] === 1) {
      const husband = ctx.children.find((row) => Number(row.id) === Number(spouse.husbandId));
      if (husband) {
        sonsOfParent(ctx, nodePathId(husband), husband.branchKey).forEach((son) => {
          if (son.id) ids.push(Number(son.id));
        });
      }
    }
    ids.forEach((childId) => {
      if (!childId || childId === Number(viewer.id) || map[childId]) return;
      map[childId] = label;
    });
  });
  return map;
}

const daughterOfViewer = {
  id: 72,
  branchKey: 'مزيد',
  parentName: 'مزيد/خميس/عيد/حسن',
  name: 'مزيد/خميس/عيد/حسن/نوره',
  gender: 'daughter',
};
const daughterHusband = {
  id: 80,
  branchKey: 'لاحم',
  parentName: 'لاحم/عيد',
  name: 'لاحم/عيد/سعد',
  gender: 'son',
};
const daughterSon = {
  id: 81,
  branchKey: 'لاحم',
  parentName: daughterHusband.name,
  name: daughterHusband.name + '/يوسف',
  gender: 'son',
};
const fatherOfDaughter = {
  id: 11,
  branchKey: 'مزيد',
  parentName: 'مزيد/خميس/عيد',
  name: 'مزيد/خميس/عيد/حسن',
  gender: 'son',
};
const nasabWife = {
  id: 701,
  husbandId: 80,
  wifeName: 'نوره',
  wifeLineage: 'نوره حسن عيد',
  wifeIsFamilyMember: true,
  wifeBranchKey: 'مزيد',
  status: 'active',
};
const nasabCtx = {
  children: [fatherOfDaughter, daughterOfViewer, daughterHusband, daughterSon],
  spouses: [nasabWife],
  motherLinks: [{ childId: 81, spouseId: 701, confidence: 'confirmed' }],
};
assert.equal(wifeRoleTowardViewer(nasabWife, daughterOfViewer), 'self');
assert.equal(wifeRoleTowardViewer(nasabWife, fatherOfDaughter), 'daughter');
assert.equal(linkKinshipByTargetId(daughterOfViewer, nasabCtx)[81], 'ابنك');
assert.equal(linkKinshipByTargetId(fatherOfDaughter, nasabCtx)[81], 'حفيدك من ابنتك');

console.log('verify-maternal-kinship: ok');
void pathToFileURL;
void require;
