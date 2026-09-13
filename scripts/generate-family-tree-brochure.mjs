#!/usr/bin/env node
/**
 * Generates a print-ready family tree brochure from live Supabase data.
 * Output: docs/family-tree-brochure.html
 *
 * Usage: node scripts/generate-family-tree-brochure.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
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

function nodeVisualClass(generation) {
  if (generation === 5) return 'ftb-leaf';
  if (generation === 1) return 'ftb-bough';
  if (generation >= 2 && generation <= 4) return 'ftb-twigs';
  return 'ftb-twigs';
}

function renderTreeNodes(nodes) {
  if (!nodes.length) return '';
  const items = nodes
    .map((node) => {
      const visual = nodeVisualClass(node.generation);
      const kids = node.children?.length ? renderTreeNodes(node.children) : '';
      const more =
        node.overflow > 0
          ? `<li class="ftb-tree-more">… +${node.overflow} ورقة (ج6+)</li>`
          : '';
      const deceased = node.deceased ? ' is-deceased' : '';
      const tag = node.deceased ? '<span class="ftb-deceased-tag">رحمه الله</span>' : '';
      return `<li class="ftb-tree-item ftb-gen-${node.generation || 0}${deceased}">
        <span class="${visual}" title="الجيل ${node.generation}">${escapeHtml(node.name)}${tag}</span>
        ${kids}
        ${more}
      </li>`;
    })
    .join('');
  return `<ul class="ftb-tree">${items}</ul>`;
}

function renderMasterTreeSvg(branches) {
  const sons = branches.map((b) => ({
    key: b.key,
    living: b.stats.living,
  }));
  const xPositions = [90, 210, 330, 450, 570];
  const branchPaths = sons
    .map(
      (son, i) =>
        `<path class="ftb-svg-branch" d="M330 250 C330 210 ${xPositions[i]} 210 ${xPositions[i]} 150" />`,
    )
    .join('');
  const leaves = sons
    .map(
      (son, i) => `
      <g class="ftb-svg-leaf-group">
        <circle class="ftb-svg-leaf" cx="${xPositions[i]}" cy="118" r="34" />
        <text class="ftb-svg-leaf-text" x="${xPositions[i]}" y="112">${escapeHtml(son.key)}</text>
        <text class="ftb-svg-leaf-sub" x="${xPositions[i]}" y="132">${son.living} حي</text>
      </g>`,
    )
    .join('');
  return `<svg class="ftb-master-tree" viewBox="0 0 660 320" role="img" aria-label="شجرة مطلق بن زيدان والفروع الخمسة">
    <ellipse class="ftb-svg-soil" cx="330" cy="292" rx="120" ry="18" />
    <rect class="ftb-svg-trunk" x="312" y="170" width="36" height="112" rx="14" />
    <path class="ftb-svg-root" d="M300 282 Q280 300 250 305 M360 282 Q380 300 410 305" />
    ${branchPaths}
    ${leaves}
    <circle class="ftb-svg-core" cx="330" cy="188" r="22" />
    <text class="ftb-svg-root-text" x="330" y="184">مطلق</text>
    <text class="ftb-svg-root-sub" x="330" y="202">بن زيدان</text>
    <text class="ftb-svg-caption" x="330" y="26">الغصون = الفروع الخمسة · الأوراق = الذرية حتى الجيل الخامس</text>
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

function buildHtml({ branches, generatedAt, logoSvg }) {
  const totalLiving = branches.reduce((s, b) => s + b.stats.living, 0);
  const totalAll = branches.reduce((s, b) => s + b.stats.total, 0);
  const totalDeceased = branches.reduce((s, b) => s + b.stats.deceased, 0);

  const branchCards = branches
    .map(
      (b) => `
      <article class="ftb-branch-card">
        <div class="ftb-branch-head">
          <h3>${escapeHtml(b.title)}</h3>
          <p class="ftb-branch-full">${escapeHtml(b.root)}</p>
        </div>
        <div class="ftb-branch-metrics">
          <span><strong>${b.stats.living}</strong> حي</span>
          <span><strong>${b.stats.deceased}</strong> متوفى</span>
          <span><strong>${b.houses}</strong> غصن</span>
        </div>
        <div class="ftb-tree-scene" aria-label="شجرة ${escapeHtml(b.key)}">
          <div class="ftb-tree-ground">
            <span class="ftb-ground-label">الجذر</span>
            <span class="ftb-trunk-name">${escapeHtml(b.root)}</span>
          </div>
          <div class="ftb-tree-scroll">${renderTreeNodes(b.topLevel)}</div>
        </div>
        ${
          b.stats.cities.size
            ? `<p class="ftb-cities">مناطق: ${escapeHtml(Array.from(b.stats.cities).slice(0, 8).join(' · '))}${b.stats.cities.size > 8 ? ' …' : ''}</p>`
            : ''
        }
      </article>`,
    )
    .join('');

  const masterTreeSvg = renderMasterTreeSvg(branches);

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>بروشور شجرة عائلة الزيدان</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="بروشور تعريفي لشجرة عائلة الزيدان — ذرية مطلق بن زيدان، الفروع الخمسة، والإحصائيات من قاعدة البيانات المعتمدة." />
  <link rel="stylesheet" href="family-tree-brochure.css" />
</head>
<body>
  <div class="ftb-toolbar">
    <button type="button" onclick="window.print()">طباعة / حفظ PDF</button>
    <a href="https://alzidan.org/" target="_blank" rel="noopener">alzidan.org</a>
  </div>

  <article class="ftb-sheet">
    <header class="ftb-cover">
      <div class="ftb-logo">${logoSvg}</div>
      <p class="ftb-brand">شجرة عائلة الزيدان</p>
      <h1>ذرية مطلق بن زيدان</h1>
      <p class="ftb-lead">
        شجرة الفروع الخمسة من الجد الجامع <strong>مطلق بن زيدان</strong> (زيدان الأول) —
        مع عرض الذرية حتى <strong>الجيل الخامس</strong> فقط لكل فرع.
      </p>
      <p class="ftb-date">تاريخ التوليد: ${escapeHtml(generatedAt)}</p>
    </header>

    <section class="ftb-section">
      <h2>نظرة عامة</h2>
      <div class="ftb-stats-grid">
        <div class="ftb-stat"><span class="ftb-stat-num">${totalLiving}</span><span class="ftb-stat-label">فرد حيّ</span></div>
        <div class="ftb-stat"><span class="ftb-stat-num">${totalDeceased}</span><span class="ftb-stat-label">متوفى</span></div>
        <div class="ftb-stat"><span class="ftb-stat-num">${totalAll}</span><span class="ftb-stat-label">إجمالي المسجّلين</span></div>
        <div class="ftb-stat"><span class="ftb-stat-num">5</span><span class="ftb-stat-label">فروع رئيسية</span></div>
      </div>

      <div class="ftb-root-diagram" aria-label="شجرة الجد الجامع">
        ${masterTreeSvg}
        <p class="ftb-root-caption">${escapeHtml(ROOT_NAME)} — الجد الجامع · الفروع: زيدان · مزيد · زايد · لاحم · ملحم</p>
      </div>
    </section>

    <section class="ftb-section">
      <h2>الفروع والذرية — شكل شجرة</h2>
      <p class="ftb-note">
        <strong>جذر</strong> = رأس الفرع · <strong>غصن</strong> = ج1 وج2 · <strong>أغصان</strong> = ج3 وج4 ·
        <strong>ورقة</strong> = الجيل الخامس. ما بعده في <a href="https://alzidan.org/">الموقع</a>.
      </p>
      <div class="ftb-legend-row">
        <span class="ftb-legend-item"><i class="ftb-swatch ftb-swatch-root"></i>جذر</span>
        <span class="ftb-legend-item"><i class="ftb-swatch ftb-swatch-bough"></i>غصن</span>
        <span class="ftb-legend-item"><i class="ftb-swatch ftb-swatch-twigs"></i>أغصان</span>
        <span class="ftb-legend-item"><i class="ftb-swatch ftb-swatch-leaf"></i>ورقة (ج5)</span>
      </div>
      <div class="ftb-branches">${branchCards}</div>
    </section>

    <section class="ftb-section ftb-digital">
      <h2>الشجرة الرقمية</h2>
      <ul>
        <li><strong>الموقع:</strong> <a href="https://alzidan.org/">alzidan.org</a> — عرض الفروع والمناسبات والإحصائيات</li>
        <li><strong>تطبيق العائلة:</strong> شجرة تفاعلية، مناسبات، ذكريات، وخدمات الأقارب</li>
        <li><strong>التحديث:</strong> يُحدَّث العدد عند إضافة أفراد أو تصحيح البيانات من الإدارة والمناديب</li>
      </ul>
    </section>

    <footer class="ftb-footer">
      للاستفسار:
      <a href="mailto:alzidan990@gmail.com">alzidan990@gmail.com</a>
      ·
      <a href="https://wa.me/966551840058">واتساب 0551840058</a>
      ·
      <a href="https://alzidan.org/">alzidan.org</a>
      <br />
      بروشور شجرة عائلة الزيدان — مُولَّد من البيانات المعتمدة
    </footer>
  </article>
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

  const logoSvg = readFileSync(join(ROOT, 'assets', 'alzidan-family-logo.svg'), 'utf8');
  const html = buildHtml({
    branches,
    generatedAt: formatDateAr(),
    logoSvg,
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
