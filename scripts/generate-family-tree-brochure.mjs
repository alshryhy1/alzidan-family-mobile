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
const MAX_DEPTH = 3;
const MAX_CHILDREN_PER_NODE = 12;

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

  for (const row of rows) {
    if (isHiddenGender(row.gender)) continue;
    const name = normalizeName(row.name || row.child_name);
    const parent = normalizeName(row.parent_name);
    if (!name || !parent) continue;

    metaByPath.set(name, row);
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, new Set());
    childrenByParent.get(parent).add(name);

    const parts = name.split('/').filter(Boolean);
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      if (!childrenByParent.has(parentPath)) childrenByParent.set(parentPath, new Set());
      childrenByParent.get(parentPath).add(name);
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

  function nodeTree(parentPath, depth) {
    const kids = Array.from(childrenByParent.get(parentPath) || [])
      .map((childPath) => ({
        path: childPath,
        name: leafName(childPath),
        deceased: isDeceased(metaByPath.get(childPath) || {}),
        city: normalizeName(metaByPath.get(childPath)?.city || ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const unique = [];
    const seen = new Set();
    for (const kid of kids) {
      const key = kid.name;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(kid);
    }

    const limited = unique.slice(0, MAX_CHILDREN_PER_NODE);
    const overflow = unique.length - limited.length;

    return limited.map((kid) => ({
      ...kid,
      children:
        depth < MAX_DEPTH ? nodeTree(kid.path, depth + 1) : [],
      overflow:
        depth === MAX_DEPTH && (childrenByParent.get(kid.path)?.size || 0) > 0
          ? (childrenByParent.get(kid.path)?.size || 0)
          : 0,
    })).concat(
      overflow > 0
        ? [{ name: `+${overflow} آخرون`, path: '', deceased: false, city: '', children: [], overflow: 0 }]
        : [],
    );
  }

  const topLevel = nodeTree(root, 1);
  const houses = topLevel.filter((n) => !n.name.startsWith('+')).length;

  return { root, topLevel, stats, houses };
}

function renderTreeNodes(nodes, depth = 0) {
  if (!nodes.length) return '';
  const cls = depth === 0 ? 'ftb-tree-root-list' : 'ftb-tree-children';
  const items = nodes
    .map((node) => {
      const tag = node.deceased ? ' <span class="ftb-deceased">رحمه الله</span>' : '';
      const city = node.city ? ` <span class="ftb-city">${escapeHtml(node.city)}</span>` : '';
      const more =
        node.overflow > 0
          ? `<li class="ftb-more">… و${node.overflow} من الذرية (في الموقع والتطبيق)</li>`
          : '';
      const kids = node.children?.length ? renderTreeNodes(node.children, depth + 1) : '';
      return `<li class="ftb-node${node.deceased ? ' is-deceased' : ''}"><span class="ftb-name">${escapeHtml(node.name)}</span>${tag}${city}${kids ? `<ul class="${cls}">${kids}</ul>` : ''}${more}</li>`;
    })
    .join('');
  return items;
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
          <span><strong>${b.houses}</strong> بيت</span>
        </div>
        <ul class="ftb-tree-root-list">${renderTreeNodes(b.topLevel)}</ul>
        ${
          b.stats.cities.size
            ? `<p class="ftb-cities">مناطق: ${escapeHtml(Array.from(b.stats.cities).slice(0, 8).join(' · '))}${b.stats.cities.size > 8 ? ' …' : ''}</p>`
            : ''
        }
      </article>`,
    )
    .join('');

  const overviewBranches = branches
    .map(
      (b) => `
      <div class="ftb-overview-item">
        <div class="ftb-overview-name">${escapeHtml(b.key)}</div>
        <div class="ftb-overview-sub">${escapeHtml(leafName(b.root))}</div>
        <div class="ftb-overview-count">${b.stats.living} حي</div>
      </div>`,
    )
    .join('');

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
        بروشور تعريفي يوثّق الفروع الخمسة للعائلة وعدد الأفراد المسجّلين في الشجرة الرقمية
        المعتمدة على الموقع والتطبيق.
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
        <div class="ftb-root-node">${escapeHtml(ROOT_NAME)}<small>الجد الجامع</small></div>
        <div class="ftb-root-branches">${overviewBranches}</div>
      </div>
    </section>

    <section class="ftb-section">
      <h2>الفروع والذرية</h2>
      <p class="ftb-note">
        الأسماء من قاعدة بيانات الشجرة المعتمدة. يُعرض هنا أول ${MAX_DEPTH} أجيال لكل فرع؛
        التفاصيل الكاملة في <a href="https://alzidan.org/">الموقع</a> وتطبيق العائلة.
      </p>
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
