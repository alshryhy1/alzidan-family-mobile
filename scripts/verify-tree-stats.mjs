/**
 * Living tree count: marking متوفى decreases the total,
 * adding a living newborn increases it. Keep in sync with src/utils/treeStats.ts.
 */

function parseExplicitBoolValue(value) {
  if (value === true || value === false) return value;
  if (value == null) return null;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (['true', 't', '1', 'yes', 'y', 'on'].includes(text)) return true;
  if (['false', 'f', '0', 'no', 'n', 'off'].includes(text)) return false;
  if (['نعم', 'متوفي', 'متوفى', 'متوفاة', 'متوفاه'].includes(text)) return true;
  if (['لا', 'حي', 'حية', 'غير متوفي', 'غير متوفى'].includes(text)) return false;
  return null;
}

function isTreePersonDeceased(...values) {
  return values.some((value) => parseExplicitBoolValue(value) === true);
}

function livingCount(people) {
  const nodes = new Set();
  const dead = new Set();
  for (const person of people) {
    const id = String(person.name || '').trim();
    if (!id) continue;
    nodes.add(id);
    if (isTreePersonDeceased(person.isDeceased, person.deceased, person.is_deceased)) {
      dead.add(id);
    }
  }
  return Math.max(0, nodes.size - dead.size);
}

function assert(cond, message) {
  if (cond) {
    console.log('  ok  ' + message);
    return;
  }
  console.error('  FAIL  ' + message);
  process.exitCode = 1;
}

const father = 'زيدان بن مطلق بن زيدان/خميس';
const son = 'زيدان بن مطلق بن زيدان/خميس/أحمد';
const newborn = 'زيدان بن مطلق بن زيدان/خميس/أحمد/مولود';

const base = [
  { name: father, isDeceased: false },
  { name: son, isDeceased: false },
];

const afterDeath = [
  { name: father, isDeceased: false },
  { name: son, isDeceased: true },
];

const afterBirth = [
  { name: father, isDeceased: false },
  { name: son, isDeceased: false },
  { name: newborn, isDeceased: false },
];

const afterDeathThenBirth = [
  { name: father, isDeceased: false },
  { name: son, isDeceased: true },
  { name: newborn, isDeceased: false },
];

const deceasedNewborn = [
  { name: father, isDeceased: false },
  { name: son, isDeceased: false },
  { name: newborn, is_deceased: false, deceased: true },
];

console.log('tree living-count smoke');
assert(livingCount(base) === 2, 'قاعدة: أب + ابن حيّان = 2');
assert(livingCount(afterDeath) === 1, 'وسم الابن متوفي ينقص العدد إلى 1');
assert(livingCount(afterBirth) === 3, 'إضافة مولود حي ترفع العدد إلى 3');
assert(livingCount(afterDeathThenBirth) === 2, 'وفاة ثم مولود حي: 2 − 1 + 1 = 2');
assert(livingCount(deceasedNewborn) === 2, 'مولود متوفى لا يزيد الأحياء');
assert(isTreePersonDeceased(false, true) === true, 'عمود deceased=true يكفي ولو is_deceased=false');
assert(isTreePersonDeceased('متوفى') === true, 'قيمة عربية متوفى تُعدّ وفاة');
assert(isTreePersonDeceased(false, false) === false, 'حيّ صريح لا يُعدّ متوفى');

if (process.exitCode) {
  console.error('\ntree stats smoke failed');
  process.exit(1);
}
console.log('\ntree stats smoke passed');
