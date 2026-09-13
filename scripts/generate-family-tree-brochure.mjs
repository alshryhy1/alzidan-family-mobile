#!/usr/bin/env node
/**
 * Generates a print-ready family tree brochure from live Supabase data.
 * Output: docs/family-tree-brochure.html
 *
 * Usage: node scripts/generate-family-tree-brochure.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'docs', 'family-tree-brochure.html');

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wbskjfdqpugnwvrykqcn.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_JhgwBIXhs6z4yBZOoE2EqA_UlzjzW9c';

const BRANCH_ORDER = ['زيدان', 'مزيد', 'زايد', 'لاحم', 'ملحم'];
const ROOT_NAME = 'مطلق بن زيدان';
/** أبناء مطلق = الجيل 1؛ يُعرض حتى الجيل الخامس (5 مستويات تحت كل فرع). */
const MAX_GENERATION = 5;

function normalizeName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function branchRootName(branchKey) {
  const key = normalizeName(branchKey);
  return key ? `${key} بن مطلق بن زيدان` : '';
}

function leafName(path) {
  const parts = normalizeName(path).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : normalizeName(path);
}

function generationFromBranchRoot(path, branchRoot) {
  const p = normalizeName(path);
  const root = normalizeName(branchRoot);
  if (!p || !root || !p.startsWith(root)) return null;
  const rest = p.slice(root.length).replace(/^\//, '');
  if (!rest) return 0;
  return rest.split('/').filter(Boolean).length;
}

function isHiddenGender(gender) {
  const g = String(gender || '').trim().toLowerCase();
  return ['daughter', 'female', 'f', 'أنثى', 'انثى', 'ابنة', 'بنت'].includes(g);
}

function isDeceased(row) {
  const v = row.is_deceased ?? row.deceased ?? row.isDeceased;
  if (v === true || v === 1) return true;
  const t = String(v || '').trim().toLowerCase();
  return ['true', '1', 'نعم', 'متوفي', 'متوفى', 'متوفاة', 'متوفاه'].includes(t);
}

async function fetchJson(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function buildBranchGraph(rows, branchKey) {
  const root = branchRootName(branchKey);
  const childrenByParent = new Map();
  const metaByPath = new Map();

  const linkParentChild = (parentPath, childPath) => {
    const parent = normalizeName(parentPath);
    const child = normalizeName(childPath);
    if (!parent || !child || parent === child) return;
    if (!child.startsWith(`${root}/`) && child !== root) return;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, new Set());
    childrenByParent.get(parent).add(child);
  };

  for (const row of rows) {
    if (isHiddenGender(row.gender)) continue;
    const name = normalizeName(row.name || row.child_name);
    if (!name || !name.startsWith(`${root}/`)) continue;

    metaByPath.set(name, row);
    const parts = name.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const parentPath = parts.slice(0, -1).join('/');
    linkParentChild(parentPath, name);

    const parentFromRow = normalizeName(row.parent_name);
    if (parentFromRow && parentFromRow !== parentPath) {
      linkParentChild(parentFromRow, name);
    }
  }

  if (!childrenByParent.has(root)) childrenByParent.set(root, new Set());

  const stats = { total: 0, living: 0, deceased: 0, cities: new Set() };
  for (const [path, row] of metaByPath.entries()) {
    if (path === root) continue;
    stats.total += 1;
    if (isDeceased(row)) stats.deceased += 1;
    else stats.living += 1;
    if (row.city) stats.cities.add(normalizeName(row.city));
  }

  function nodeTree(parentPath) {
    const kids = Array.from(childrenByParent.get(parentPath) || [])
      .map((childPath) => {
        const gen = generationFromBranchRoot(childPath, root);
        return {
          path: childPath,
          name: leafName(childPath),
          generation: gen,
          deceased: isDeceased(metaByPath.get(childPath) || {}),
          city: normalizeName(metaByPath.get(childPath)?.city || ''),
        };
      })
      .filter((kid) => kid.generation != null && kid.generation > 0 && kid.generation <= MAX_GENERATION)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    return kids.map((kid) => {
      const childNodes = kid.generation < MAX_GENERATION ? nodeTree(kid.path) : [];
      const overflowAtCap =
        kid.generation === MAX_GENERATION
          ? Array.from(childrenByParent.get(kid.path) || []).filter(
              (p) => (generationFromBranchRoot(p, root) || 0) > MAX_GENERATION,
            ).length
          : 0;
      return {
        ...kid,
        children: childNodes,
        overflow: overflowAtCap,
      };
    });
  }

  const topLevel = nodeTree(root);
  const houses = topLevel.filter((n) => !n.name.startsWith('+')).length;

  return { root, topLevel, stats, houses };
}

function renderLeafCloud(nodes) {
  return nodes
    .map(
      (node) =>
        `<span class="ftb-leaf-mini${node.deceased ? ' is-deceased' : ''}" title="ج5">${escapeHtml(node.name)}</span>`,
    )
    .join('');
}

function renderCompactNode(node) {
  if (node.generation === 5) {
    return `<span class="ftb-leaf-mini${node.deceased ? ' is-deceased' : ''}">${escapeHtml(node.name)}</span>`;
  }

  const children = node.children || [];
  const gen5 = children.filter((child) => child.generation === 5);
  const younger = children.filter((child) => child.generation < 5);
  const visual = node.generation === 1 ? 'ftb-bough-mini' : 'ftb-twigs-mini';
  const subtrees = younger.map((child) => renderCompactNode(child)).join('');
  const leaves = gen5.length ? `<div class="ftb-leaf-cloud">${renderLeafCloud(gen5)}</div>` : '';
  const more = node.overflow > 0 ? `<span class="ftb-more-mini">+${node.overflow}</span>` : '';

  return `<div class="ftb-block ftb-g${node.generation}${node.deceased ? ' is-deceased' : ''}">
    <span class="${visual}">${escapeHtml(node.name)}</span>
    ${subtrees ? `<div class="ftb-children">${subtrees}</div>` : ''}
    ${leaves}
    ${more}
  </div>`;
}

function renderBranchColumn(branch) {
  return `<section class="ftb-col" aria-label="فرع ${escapeHtml(branch.key)}">
    <header class="ftb-col-head">
      <span class="ftb-col-name">${escapeHtml(branch.key)}</span>
      <span class="ftb-col-meta">${branch.stats.living} حي</span>
    </header>
    <div class="ftb-col-stem" aria-hidden="true"></div>
    <div class="ftb-col-body">${branch.topLevel.map((node) => renderCompactNode(node)).join('')}</div>
  </section>`;
}

function renderMasterTreeSvg(branches) {
  const sons = branches.map((b) => ({ key: b.key, living: b.stats.living }));
  const xPositions = [70, 170, 270, 370, 470];
  const branchPaths = sons
    .map(
      (_, i) =>
        `<path class="ftb-svg-branch" d="M270 118 C270 98 ${xPositions[i]} 98 ${xPositions[i]} 72" />`,
    )
    .join('');
  const leaves = sons
    .map(
      (son, i) => `
      <g>
        <circle class="ftb-svg-leaf" cx="${xPositions[i]}" cy="52" r="22" />
        <text class="ftb-svg-leaf-text" x="${xPositions[i]}" y="50">${escapeHtml(son.key)}</text>
        <text class="ftb-svg-leaf-sub" x="${xPositions[i]}" y="64">${son.living}</text>
      </g>`,
    )
    .join('');
  return `<svg class="ftb-master-tree" viewBox="0 0 540 140" role="img" aria-label="شجرة مطلق بن زيدان">
    <ellipse class="ftb-svg-soil" cx="270" cy="132" rx="70" ry="8" />
    <rect class="ftb-svg-trunk" x="258" y="84" width="24" height="46" rx="8" />
    ${branchPaths}
    ${leaves}
    <circle class="ftb-svg-core" cx="270" cy="96" r="12" />
    <text class="ftb-svg-root-text" x="270" y="99">مطلق</text>
  </svg>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateAr() {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

function buildHtml({ branches, generatedAt }) {
  const totalLiving = branches.reduce((s, b) => s + b.stats.living, 0);
  const totalAll = branches.reduce((s, b) => s + b.stats.total, 0);
  const totalDeceased = branches.reduce((s, b) => s + b.stats.deceased, 0);
  const masterTreeSvg = renderMasterTreeSvg(branches);
  const columns = branches.map((b) => renderBranchColumn(b)).join('');

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>شجرة عائلة الزيدان — صفحة واحدة</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="شجرة عائلة الزيدان في صفحة واحدة — ذرية مطلق بن زيدان حتى الجيل الخامس." />
  <link rel="stylesheet" href="family-tree-brochure.css" />
</head>
<body>
  <div class="ftb-toolbar">
    <button type="button" onclick="window.print()">طباعة / PDF — صفحة واحدة</button>
    <a href="https://alzidan.org/" target="_blank" rel="noopener">alzidan.org</a>
  </div>

  <div class="ftb-page-wrap">
    <article class="ftb-one-page" id="ftb-page">
      <div class="ftb-scale-inner" id="ftb-scale-inner">
        <header class="ftb-top">
          <div class="ftb-top-title">
            <h1>شجرة عائلة الزيدان</h1>
            <p>ذرية ${escapeHtml(ROOT_NAME)} · حتى الجيل الخامس · ${escapeHtml(generatedAt)}</p>
          </div>
          <div class="ftb-top-stats">
            <span><b>${totalLiving}</b> حي</span>
            <span><b>${totalDeceased}</b> متوفى</span>
            <span><b>${totalAll}</b> مسجّل</span>
            <span><b>5</b> فروع</span>
          </div>
          <div class="ftb-top-tree">${masterTreeSvg}</div>
        </header>

        <div class="ftb-legend">
          <span><i class="sw-root"></i>جذر</span>
          <span><i class="sw-bough"></i>غصن (ج1–2)</span>
          <span><i class="sw-twig"></i>غصينات (ج3–4)</span>
          <span><i class="sw-leaf"></i>ورقة (ج5)</span>
        </div>

        <div class="ftb-forest">${columns}</div>

        <footer class="ftb-foot">
          ${escapeHtml(ROOT_NAME)} — الجد الجامع · alzidan.org · alzidan990@gmail.com · 0551840058
        </footer>
      </div>
    </article>
  </div>

  <script>
    (function fitOnePage() {
      var page = document.getElementById('ftb-page');
      var inner = document.getElementById('ftb-scale-inner');
      if (!page || !inner) return;
      function apply() {
        inner.style.transform = 'none';
        inner.style.width = '100%';
        var ph = page.clientHeight;
        var ih = inner.scrollHeight;
        var scale = ih > ph ? ph / ih : 1;
        inner.style.transform = 'scale(' + scale + ')';
        inner.style.transformOrigin = 'top center';
        inner.style.width = scale < 1 ? (100 / scale) + '%' : '100%';
      }
      window.addEventListener('load', apply);
      window.addEventListener('resize', apply);
      window.addEventListener('beforeprint', apply);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
    })();
  </script>
</body>
</html>`;
}

async function main() {
  const [branchRows, childRows] = await Promise.all([
    fetchJson('/rest/v1/tree_branches?select=key,title&order=key'),
    fetchJson(
      '/rest/v1/tree_children?select=branch_key,parent_name,name,child_name,gender,is_deceased,deceased,city&order=branch_key',
    ),
  ]);

  const titleByKey = new Map(branchRows.map((r) => [r.key, r.title || r.key]));
  const byBranch = new Map();
  for (const row of childRows) {
    if (!byBranch.has(row.branch_key)) byBranch.set(row.branch_key, []);
    byBranch.get(row.branch_key).push(row);
  }

  const branches = BRANCH_ORDER.map((key) => {
    const graph = buildBranchGraph(byBranch.get(key) || [], key);
    return {
      key,
      title: titleByKey.get(key) || `ذرية ${branchRootName(key)}`,
      ...graph,
    };
  });

  const html = buildHtml({
    branches,
    generatedAt: formatDateAr(),
  });

  writeFileSync(OUT, html, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(
    'Branches:',
    branches.map((b) => `${b.key}: ${b.stats.living} living / ${b.stats.total} total`).join(' · '),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
