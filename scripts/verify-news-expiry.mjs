/**
 * Smoke: توحيد انتهاء الأخبار (مسار C / NEWS-001).
 * يختبر `AlzidanEventVisibility` في family repo — نفس قواعد التطبيق والودجت.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const familyModule = join(
  __dirname,
  '../../alzidan-family/assets/js/modules/events/event-visibility.js',
);

try {
  require(familyModule);
} catch (err) {
  // fallback: sibling path from Downloads layout
  require('/Users/ahshryhy/Downloads/alzidan-family/assets/js/modules/events/event-visibility.js');
}

const vis = globalThis.AlzidanEventVisibility;
if (!vis || typeof vis.isFamilyEventPubliclyVisible !== 'function') {
  console.error('FAIL: AlzidanEventVisibility not loaded');
  process.exit(1);
}

function dayOffsetIso(daysFromToday, hour = 12) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function createdDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const now = new Date();
const cases = [
  {
    name: 'death within 3 days stays',
    row: {
      type: 'death',
      event_date: dayOffsetIso(-2),
      created_at: createdDaysAgo(2),
      details: JSON.stringify({ v: 1, kind: 'death_notice', showDays: 7 }),
    },
    expect: true,
  },
  {
    name: 'death after 3 days hidden',
    row: {
      type: 'death',
      event_date: dayOffsetIso(-3),
      created_at: createdDaysAgo(3),
      details: JSON.stringify({ v: 1, kind: 'death_notice', showDays: 7 }),
    },
    expect: false,
  },
  {
    name: 'happy past event day hidden',
    row: {
      type: 'marriage',
      event_date: dayOffsetIso(-1),
      created_at: createdDaysAgo(1),
      details: JSON.stringify({ v: 1, kind: 'happy_notice', showDays: 7 }),
    },
    expect: false,
  },
  {
    name: 'happy today visible',
    row: {
      type: 'marriage',
      event_date: dayOffsetIso(0),
      created_at: createdDaysAgo(0),
      details: JSON.stringify({ v: 1, kind: 'happy_notice', showDays: 7 }),
    },
    expect: true,
  },
  {
    name: 'null event_date expired by showDays',
    row: {
      type: 'gathering',
      event_date: null,
      created_at: createdDaysAgo(8),
      details: JSON.stringify({ v: 1, kind: 'happy_notice', showDays: 7 }),
    },
    expect: false,
  },
  {
    name: 'null event_date within showDays visible',
    row: {
      type: 'gathering',
      event_date: null,
      created_at: createdDaysAgo(2),
      details: JSON.stringify({ v: 1, kind: 'happy_notice', showDays: 7 }),
    },
    expect: true,
  },
  {
    name: 'sick within showDays visible',
    row: {
      type: 'sick',
      event_date: null,
      created_at: createdDaysAgo(3),
      details: JSON.stringify({ v: 1, kind: 'health_notice', showDays: 5 }),
    },
    expect: true,
  },
  {
    name: 'sick beyond showDays hidden',
    row: {
      type: 'sick',
      event_date: null,
      created_at: createdDaysAgo(6),
      details: JSON.stringify({ v: 1, kind: 'health_notice', showDays: 5 }),
    },
    expect: false,
  },
  {
    name: 'happy far-future gathering stays scheduled/hidden',
    row: {
      type: 'gathering',
      event_date: '2027-01-17',
      created_at: createdDaysAgo(0),
      show_before_days: 3,
      show_at: '2027-01-17T00:00:00.000Z',
      details: JSON.stringify({
        v: 1,
        kind: 'happy_notice',
        showDays: 7,
        show_before_days: 3,
        show_at: '2027-01-17T00:00:00.000Z',
      }),
    },
    expect: false,
  },
];

let failed = 0;
for (const c of cases) {
  const got = vis.isFamilyEventPubliclyVisible(c.row, now);
  if (got !== c.expect) {
    failed += 1;
    console.error(`FAIL: ${c.name} expected=${c.expect} got=${got}`);
  } else {
    console.log(`OK: ${c.name}`);
  }
}

if (failed) {
  console.error(`\n${failed} case(s) failed (NEWS-001)`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} news-expiry cases passed.`);
