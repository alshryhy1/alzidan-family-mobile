/**
 * Today remembrances must use the leaf given name, not the branch root of a path.
 */
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-esm-hook.mjs', import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { listTodayRemembrances } = await import(
  pathToFileURL(join(root, 'src/utils/todayRemembrance.ts')).href
);

function assert(cond, message) {
  if (cond) {
    console.log('  ok  ' + message);
    return;
  }
  console.error('  FAIL  ' + message);
  process.exitCode = 1;
}

console.log('today remembrance leaf name smoke');

// Hijri 1447-05-12 ≈ pick a fixed Date that moment-hijri maps consistently;
// we stub birthDateHijri to match hijriToday of a chosen Date.
const now = new Date('2026-10-23T12:00:00+03:00');
const { hijriToday } = await import(pathToFileURL(join(root, 'src/utils/todayRemembrance.ts')).href);
const today = hijriToday(now);
const hijriStamp = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

const ryan = {
  id: 101,
  branchKey: 'زيدان',
  parentName: 'زيدان/فهد',
  name: 'زيدان/فهد/ريان',
  birthDateHijri: hijriStamp,
  isDeceased: false,
};

const rows = listTodayRemembrances({
  people: [ryan],
  viewer: { id: 1, branchKey: 'مزيد', name: 'مزيد/خالد', parentName: 'مزيد' },
  now,
  limit: 4,
});

assert(rows.length === 1, 'صف ميلاد واحد');
assert(rows[0]?.given === 'ريان', `الاسم المعطى ريان وليس جذر الفرع: ${rows[0]?.given}`);
assert(
  rows[0]?.title === 'اليوم ميلاد ريان',
  `العنوان يستخدم ريان: ${rows[0]?.title}`,
);
assert(!String(rows[0]?.title || '').includes('زيدان'), 'العنوان لا يذكر جذر فرع الزيدان');

const spaced = listTodayRemembrances({
  people: [
    {
      id: 102,
      branchKey: 'زيدان',
      parentName: 'زيدان',
      name: 'ريان بن فهد',
      birthDateHijri: hijriStamp,
      isDeceased: false,
    },
  ],
  now,
  limit: 2,
});
assert(spaced[0]?.title === 'اليوم ميلاد ريان', `اسم بمسافات: ${spaced[0]?.title}`);

if (process.exitCode) {
  console.error('\ntoday remembrance smoke failed');
  process.exit(1);
}
console.log('\ntoday remembrance smoke passed');
