/**
 * Smoke: Bug 36 — duplicate grandfather صالح under لاحم must merge after grouping.
 * Mirrors src/utils/groupChildrenRows.ts (keep in sync when changing merge rules).
 */

function normalizePersonName(value) {
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

function getBranchRootName(branchKey) {
  const key = normalizePersonName(branchKey);
  if (!key) return '';
  return `${key} بن مطلق بن زيدان`;
}

function normalizeParentName(value, branchKey) {
  const raw = normalizePersonName(value || '');
  const cleaned = raw.replace(/^أصل الفرع:\s*/i, '').trim();
  if (!cleaned) return '';
  if (/بن\s+مطلق\s+بن\s+زيدان/.test(cleaned)) return cleaned;
  if (branchKey && normalizePersonName(branchKey) === cleaned) {
    return `${cleaned} بن مطلق بن زيدان`;
  }
  return cleaned;
}

function normalizePersonBaseName(value) {
  const n = normalizePersonName(value || '');
  if (!n) return '';
  const parts = n
    .split('/')
    .map((part) => normalizePersonName(part))
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : n;
}

function tokenizeLineageInput(value) {
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

function buildChildId(parentId, baseName) {
  const parent = normalizePersonName(parentId || '');
  const base = normalizePersonName(baseName || '');
  if (!parent || !base) return '';
  return `${parent}/${base}`;
}

function preferChild(left, right) {
  const leftPath = normalizePersonName(left.name).includes('/');
  const rightPath = normalizePersonName(right.name).includes('/');
  if (leftPath !== rightPath) return rightPath ? right : left;
  return right.id >= left.id ? right : left;
}

function mergeChildMeta(prev, next) {
  const preferred = preferChild(prev, next);
  const other = preferred === prev ? next : prev;
  return { ...preferred, ...Object.fromEntries(Object.entries(other).filter(([, v]) => v == null || v === '')) };
}

function groupChildrenRows(rows, branchKey) {
  const key = normalizePersonName(branchKey || '');
  const branchRoot = key ? getBranchRootName(key) : '';
  const byParent = new Map();
  const idsByBase = new Map();
  let syntheticId = -1;

  const indexKnownId = (nodeId) => {
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

  const addOrMergeChildById = (parentId, child) => {
    const parent = normalizePersonName(parentId || '');
    const name = normalizePersonName(child.name || '');
    if (!parent || !name) return;
    const list = byParent.get(parent) ?? [];
    if (!byParent.has(parent)) byParent.set(parent, list);
    const idx = list.findIndex((item) => normalizePersonName(item.name) === name);
    const mergedChild = { ...child, parentName: parent, name };
    if (idx < 0) {
      list.push(mergedChild);
      return;
    }
    list[idx] = mergeChildMeta(list[idx], mergedChild);
  };

  const addOrMergeChildAndIndex = (parentId, child) => {
    addOrMergeChildById(parentId, child);
    const parent = normalizePersonName(parentId || '');
    if (parent) indexKnownId(parent);
    const name = normalizePersonName(child.name || '');
    if (name) indexKnownId(name);
  };

  const ensureParentId = (rawParent, childRaw) => {
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
        });
      }
      return parentId;
    }
    return raw;
  };

  const normalizeChildId = (rawChildId, parentId) => {
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

  const addChain = (anchorParentId, basesOldestToYoungest, leaf) => {
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
        });
      }
      current = childId;
    }
  };

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
    const tokens = rawTokens;
    if (!tokens.length) continue;
    if (tokens.length > 1) {
      const chainOldest = [...tokens].reverse();
      const parentBase = normalizePersonBaseName(parentId);
      if (chainOldest.length && parentBase && chainOldest[0] === parentBase) chainOldest.shift();
      addChain(parentId, chainOldest, row);
      continue;
    }
    addChain(parentId, [tokens[0]], row);
  }

  for (const [parent, list] of byParent.entries()) {
    const byLeaf = new Map();
    for (const child of list) {
      const leaf = normalizePersonBaseName(child.name);
      if (!leaf) continue;
      const prev = byLeaf.get(leaf);
      byLeaf.set(leaf, prev ? mergeChildMeta(prev, child) : child);
    }
    byParent.set(parent, Array.from(byLeaf.values()));
  }

  return byParent;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

const branch = 'لاحم';
const root = getBranchRootName(branch);
const fixture = [
  { id: 321, branchKey: branch, parentName: root, name: 'صالح' },
  { id: 491, branchKey: branch, parentName: root, name: `${root}/صالح` },
  { id: 670, branchKey: branch, parentName: root, name: `${root}/ندا` },
  {
    id: 500,
    branchKey: branch,
    parentName: `${root}/صالح`,
    name: `${root}/صالح/سليمان`,
  },
  {
    id: 501,
    branchKey: branch,
    parentName: `${root}/صالح`,
    name: `${root}/صالح/عيد`,
  },
  {
    id: 502,
    branchKey: branch,
    parentName: `${root}/صالح`,
    name: `${root}/صالح/ناصر`,
  },
  // other-branch-safe: further sibling with same leaf elsewhere must not collapse globally
  {
    id: 900,
    branchKey: branch,
    parentName: `${root}/ندا`,
    name: `${root}/ندا/صالح`,
  },
  {
    id: 901,
    branchKey: branch,
    parentName: `${root}/ندا/صالح`,
    name: `${root}/ندا/صالح/ريان`,
  },
];

const map = groupChildrenRows(fixture, branch);
const rootKids = map.get(root) || [];
const salehLeaves = rootKids.filter((c) => normalizePersonBaseName(c.name) === 'صالح');
const salehNode = salehLeaves[0];
const salehKids = salehNode ? map.get(salehNode.name) || [] : [];
const nadaKids = map.get(`${root}/ندا`) || [];

assert(salehLeaves.length === 1, 'root has exactly one صالح node');
assert(
  salehNode && salehNode.name === `${root}/صالح`,
  'صالح node uses full canonical path',
);
assert(salehKids.length === 3, 'صالح has three children (سليمان/عيد/ناصر)');
assert(
  !rootKids.some((c) => c.name === 'صالح'),
  'empty short صالح sibling is gone',
);
assert(
  nadaKids.some((c) => c.name === `${root}/ندا/صالح`),
  'ندا/صالح sibling elsewhere remains (no cross-branch collapse)',
);
assert(rootKids.length === 2, 'root still has صالح + ندا only');

if (process.exitCode) {
  console.error('\nBug 36 smoke failed');
  process.exit(1);
}
console.log('\nBug 36 smoke passed');
