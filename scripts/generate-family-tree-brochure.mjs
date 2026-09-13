#!/usr/bin/env node
/**
 * شجرة عائلة الزيدان — صفحة واحدة، نمو من الأسفل:
 * جذر (مطلق) → 5 أغصان → أوراق ج2 → ج3 → ج4 → ج5
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUT = join(ROOT_DIR, 'docs', 'family-tree-brochure.html');

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wbskjfdqpugnwvrykqcn.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_JhgwBIXhs6z4yBZOoE2EqA_UlzjzW9c';

const BRANCH_ORDER = ['زيدان', 'مزيد', 'زايد', 'لاحم', 'ملحم'];
const ROOT_NAME = 'مطلق بن زيدان';
const MAX_GENERATION = 5;

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function branchRootName(branchKey) {
  const key = normalizeName(branchKey);
  return key ? `${key} بن مطلق بن زيدان` : '';
}

function generationFromBranchRoot(path, branchRoot) {
  const p = normalizeName(path);
  const root = normalizeName(branchRoot);
  if (!p || !root || !p.startsWith(root)) return null;
  const rest = p.slice(root.length).replace(/^\//, '');
  if (!rest) return 0;
  return rest.split('/').filter(Boolean).length;
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

  const link = (parentPath, childPath) => {
    const parent = normalizeName(parentPath);
    const child = normalizeName(childPath);
    if (!parent || !child || parent === child) return;
    if (!child.startsWith(`${root}/`)) return;
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
    link(parts.slice(0, -1).join('/'), name);
    const parentFromRow = normalizeName(row.parent_name);
    if (parentFromRow && parentFromRow !== parts.slice(0, -1).join('/')) {
      link(parentFromRow, name);
    }
  }

  function nodeTree(parentPath) {
    return Array.from(childrenByParent.get(parentPath) || [])
      .map((childPath) => {
        const gen = generationFromBranchRoot(childPath, root);
        return {
          path: childPath,
          name: leafName(childPath),
          generation: gen,
          deceased: isDeceased(metaByPath.get(childPath) || {}),
        };
      })
      .filter((n) => n.generation != null && n.generation > 0 && n.generation <= MAX_GENERATION)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
      .map((n) => ({
        ...n,
        children: n.generation < MAX_GENERATION ? nodeTree(n.path) : [],
      }));
  }

  const topLevel = nodeTree(root);
  let living = 0;
  let deceased = 0;
  for (const row of metaByPath.values()) {
    if (isDeceased(row)) deceased += 1;
    else living += 1;
  }

  return { root, topLevel, stats: { living, deceased, total: living + deceased } };
}

function collectByGeneration(nodes) {
  const rows = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  function walk(list) {
    for (const n of list) {
      if (n.generation >= 1 && n.generation <= 5) rows[n.generation].push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return rows;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLeaf(node) {
  return `<span class="leaf${node.deceased ? ' dead' : ''}" title="ج${node.generation}">${escapeHtml(node.name)}</span>`;
}

function renderGenLayer(gen, nodes) {
  if (!nodes.length) return '';
  return `<div class="gen-layer g${gen}" data-gen="${gen}">
    <div class="gen-stem"></div>
    <div class="leaves">${nodes.map(renderLeaf).join('')}</div>
  </div>`;
}

function renderBranchColumn(branch) {
  const gens = collectByGeneration(branch.topLevel);
  const layers = [5, 4, 3, 2, 1]
    .map((g) => renderGenLayer(g, gens[g]))
    .filter(Boolean)
    .join('');

  return `<section class="branch-col" data-branch="${escapeHtml(branch.key)}">
    ${layers}
    <div class="branch-stem"></div>
    <div class="bough">${escapeHtml(branch.key)}<small>${branch.stats.living} حي</small></div>
  </section>`;
}

function renderTrunkSvg() {
  const xs = [10, 30, 50, 70, 90];
  const paths = xs
    .map((x) => `<path class="trunk-branch" d="M50 72 Q50 58 ${x} 42 L${x} 38" />`)
    .join('');
  return `<svg class="trunk-svg" viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true">
    <ellipse class="soil" cx="50" cy="76" rx="38" ry="5" />
    <rect class="trunk" x="46" y="38" width="8" height="36" rx="3" />
    ${paths}
  </svg>`;
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
  const columns = branches.map(renderBranchColumn).join('');

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>شجرة عائلة الزيدان</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="family-tree-brochure.css" />
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">طباعة / PDF</button>
    <span>alzidan.org</span>
  </div>

  <article class="poster" id="poster">
    <header class="head">
      <h1>شجرة عائلة الزيدان</h1>
      <p>من ${escapeHtml(ROOT_NAME)} · حتى الجيل الخامس · ${escapeHtml(generatedAt)} · ${totalLiving} حي · ${totalAll} مسجّل</p>
    </header>

    <div class="canopy" id="canopy">${columns}</div>

    <footer class="base">
      ${renderTrunkSvg()}
      <div class="roots">
        <div class="root-name">${escapeHtml(ROOT_NAME)}</div>
        <div class="root-sub">الجد الجامع · زيدان الأول</div>
      </div>
    </footer>
  </article>

  <script>
    (function () {
      var poster = document.getElementById('poster');
      var canopy = document.getElementById('canopy');
      function fit() {
        canopy.style.transform = 'none';
        canopy.style.fontSize = '100%';
        var ph = poster.clientHeight - poster.querySelector('.head').offsetHeight - poster.querySelector('.base').offsetHeight - 8;
        var ch = canopy.scrollHeight;
        if (ch > ph && ph > 0) {
          var scale = ph / ch;
          canopy.style.transform = 'scale(' + scale + ')';
          canopy.style.transformOrigin = 'bottom center';
        }
      }
      window.addEventListener('load', fit);
      window.addEventListener('resize', fit);
      window.addEventListener('beforeprint', fit);
    })();
  </script>
</body>
</html>`;
}

async function main() {
  const [branchRows, childRows] = await Promise.all([
    fetchJson('/rest/v1/tree_branches?select=key,title&order=key'),
    fetchJson(
      '/rest/v1/tree_children?select=branch_key,parent_name,name,child_name,gender,is_deceased,deceased&order=branch_key',
    ),
  ]);

  const byBranch = new Map();
  for (const row of childRows) {
    if (!byBranch.has(row.branch_key)) byBranch.set(row.branch_key, []);
    byBranch.get(row.branch_key).push(row);
  }

  const branches = BRANCH_ORDER.map((key) => {
    const graph = buildBranchGraph(byBranch.get(key) || [], key);
    const titleRow = branchRows.find((r) => r.key === key);
    return { key, title: titleRow?.title || key, ...graph };
  });

  writeFileSync(OUT, buildHtml({ branches, generatedAt: formatDateAr() }), 'utf8');
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
