/**
 * يتحقق أن رسالة tree_card من الجوال قابلة للقراءة عبر buildTreeCardRows في Admin.
 * منطق Admin مأخوذ من assets/js/modules/request-actions.js
 */

function normalizeTreeCardText(v) {
  return String(v || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeParseJsonTextLoose(v) {
  try {
    if (v == null) return null;
    const s = String(v || '').trim();
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractTreeCardPayloadFromMessage(msg) {
  const text = String(msg || '');
  const marker = '__JSON__:';
  const idx = text.indexOf(marker);
  if (idx < 0) return null;
  const jsonText = text.slice(idx + marker.length).trim();
  if (!jsonText) return null;
  const parsed = safeParseJsonTextLoose(jsonText);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

function buildTreeCardRows(reqRow, branchOverride) {
  const payload = extractTreeCardPayloadFromMessage(reqRow?.message ?? '');
  if (!payload) {
    return { ok: false, message: 'تعذر قراءة بيانات البطاقة (JSON غير موجود).', rows: [] };
  }
  const branchKey = normalizeTreeCardText(branchOverride || payload.branch_key || reqRow.branch_key || '');
  const father = normalizeTreeCardText(payload.father || '');
  const personName = normalizeTreeCardText(payload.name || '');
  const personDob = normalizeTreeCardText(payload.birth_date_g || '');
  const city = normalizeTreeCardText(payload.city || '');
  const area = normalizeTreeCardText(payload.area || '');
  if (!branchKey) {
    return { ok: false, message: 'بيانات البطاقة ناقصة (العائلة).', rows: [] };
  }
  const createdAt = normalizeTreeCardText(payload.created_at || reqRow.created_at || new Date().toISOString());
  const rows = [];
  const seen = new Set();

  function pushEdge(parent, child, extra) {
    const p = normalizeTreeCardText(parent || '');
    const c = normalizeTreeCardText(child || '');
    if (!p || !c) return;
    const key = `${branchKey}|${p}|${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    const row = {
      branch_key: branchKey,
      parent_name: p,
      child_name: c,
      created_at: createdAt,
    };
    if (extra && typeof extra === 'object') Object.assign(row, extra);
    rows.push(row);
  }

  const customRows = Array.isArray(payload.tree_rows) ? payload.tree_rows : [];
  if (customRows.length) {
    customRows.forEach((item) => {
      const parent = normalizeTreeCardText(item?.parent_name ?? '');
      const child = normalizeTreeCardText(item?.child_name ?? '');
      if (!parent || !child) return;
      pushEdge(parent, child, {
        birth_date_g: normalizeTreeCardText(item.birth_date_g || ''),
        city: normalizeTreeCardText(item.city || ''),
        area: normalizeTreeCardText(item.area || ''),
      });
    });
    return { ok: true, rows };
  }

  if (!father || !personName) {
    return { ok: false, message: 'بيانات البطاقة ناقصة (الأب/الاسم).', rows: [] };
  }

  const ancestorsFromArray = Array.isArray(payload.ancestors) ? payload.ancestors : [];
  const ancestorsFromFields = [payload.grandfather, payload.grandfather2, payload.grandfather3, payload.grandfather4].filter(Boolean);
  const ancestorsClosestFirst = (ancestorsFromArray.length ? ancestorsFromArray : ancestorsFromFields)
    .map((v) => normalizeTreeCardText(v))
    .filter(Boolean);
  const farthestFirst = ancestorsClosestFirst.slice().reverse();
  for (let i = 0; i + 1 < farthestFirst.length; i += 1) {
    pushEdge(farthestFirst[i], farthestFirst[i + 1]);
  }
  if (ancestorsClosestFirst.length) {
    pushEdge(ancestorsClosestFirst[0], father);
  }
  pushEdge(father, personName, {
    birth_date_g: personDob || '',
    city: city || '',
    area: area || '',
  });
  const kids = Array.isArray(payload.children) ? payload.children : [];
  kids.forEach((c) => {
    const childName = normalizeTreeCardText(c?.name ?? '');
    const childDob = normalizeTreeCardText(c?.dob ?? '');
    if (!childName) return;
    pushEdge(personName, childName, { birth_date_g: childDob || '' });
  });
  return { ok: true, rows };
}

function buildTreeCardMessage(payload) {
  const lines = [];
  lines.push('بطاقة إضافة بيانات للشجرة');
  lines.push('');
  lines.push(`رقم الطلب: ${payload.requestId}`);
  lines.push(`العائلة (إجباري): ${payload.branch}`);
  if (payload.ancestors.length) {
    lines.push('سلسلة الأجداد:');
    payload.ancestors.forEach((value, index) => {
      lines.push(`الجد ${index + 1}: ${value}`);
    });
  } else {
    lines.push(`الجد 1 (إجباري): ${payload.grandfather}`);
  }
  lines.push(`الأب (إجباري): ${payload.father}`);
  lines.push(`الاسم (إجباري): ${payload.personName}`);
  lines.push(`تاريخ الميلاد (اختياري): ${payload.personDob}`);
  lines.push(`المدينة (اختياري): ${payload.city}`);
  lines.push(`الحي/القرية (اختياري): ${payload.area}`);
  lines.push('');
  lines.push('الأبناء (اختياري):');
  if (payload.children.length) {
    payload.children.forEach((child, index) => {
      lines.push(`${index + 1}- الاسم: ${child.name} — تاريخ الميلاد: ${child.dob}`);
    });
  } else {
    lines.push('(لا يوجد)');
  }
  lines.push('');
  lines.push('بيانات المرسل (إجباري):');
  lines.push(`الاسم: ${payload.submitterName}`);
  lines.push(`الجوال: ${payload.submitterPhone}`);
  lines.push(`البريد (اختياري): ${payload.submitterEmail}`);
  lines.push(`التاريخ: ${new Date(payload.createdAt).toLocaleString('ar-SA')}`);
  lines.push('');
  lines.push('__JSON__:');
  lines.push(
    JSON.stringify(
      {
        v: 1,
        kind: 'tree_card',
        branch_key: payload.branch,
        grandfather: payload.grandfather,
        ancestors: payload.ancestors,
        father: payload.father,
        name: payload.personName,
        birth_date_g: payload.personDob,
        city: payload.city,
        area: payload.area,
        children: payload.children,
        submitter: {
          name: payload.submitterName,
          phone: payload.submitterPhone,
          email: payload.submitterEmail,
        },
        created_at: payload.createdAt,
      },
      null,
      2,
    ),
  );
  return lines.join('\n');
}

const sample = {
  ancestors: ['خميس', 'عبدالرحمن'],
  branch: 'زيدان',
  city: 'الرياض',
  area: 'النرجس',
  children: [{ name: 'محمد', dob: '2010-05-01' }],
  createdAt: new Date().toISOString(),
  father: 'سعود',
  grandfather: 'خميس',
  personDob: '1985-03-15',
  personName: 'فهد',
  requestId: 'REQ-TEST-0001',
  submitterEmail: 'test@example.com',
  submitterName: 'مرسل تجريبي',
  submitterPhone: '0500000000',
};

const message = buildTreeCardMessage(sample);
const reqRow = {
  kind: 'tree_card',
  branch_key: sample.branch,
  message,
  created_at: sample.createdAt,
};

const built = buildTreeCardRows(reqRow);
const payload = extractTreeCardPayloadFromMessage(message);

const checks = [
  ['__JSON__ marker', message.includes('__JSON__:')],
  ['payload.kind tree_card', payload?.kind === 'tree_card'],
  ['payload.v === 1', payload?.v === 1],
  ['buildTreeCardRows ok', built.ok === true],
  ['rows.length >= 1', built.rows.length >= 1],
  ['leaf edge father→person', built.rows.some((r) => r.parent_name === 'سعود' && r.child_name === 'فهد')],
  ['child edge', built.rows.some((r) => r.parent_name === 'فهد' && r.child_name === 'محمد')],
  ['visible header', message.startsWith('بطاقة إضافة بيانات للشجرة')],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) {
    console.error(`FAIL: ${label}`);
    failed += 1;
  } else {
    console.log(`OK: ${label}`);
  }
}

if (failed) {
  console.error(`\n${failed} فحص(فحوص) فشل.`);
  process.exit(1);
}

console.log(`\nنجح التحقق: ${checks.length} فحص — ${built.rows.length} صف شجرة مُستخرج.`);
