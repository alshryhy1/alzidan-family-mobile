/**
 * Living tree count + work_status tallies.
 * Keep in sync with src/utils/treeStats.ts.
 */
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-esm-hook.mjs', import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  collectBranchTreeStats,
  isTreePersonDeceased,
  normalizeWorkStatus,
  workStatusPercent,
} = await import(pathToFileURL(join(root, 'src/utils/treeStats.ts')).href);

function assert(cond, message) {
  if (cond) {
    console.log('  ok  ' + message);
    return;
  }
  console.error('  FAIL  ' + message);
  process.exitCode = 1;
}

const branchKey = 'زيدان';
const rootName = 'زيدان بن مطلق بن زيدان';
const father = `${rootName}/خميس`;
const son = `${rootName}/خميس/أحمد`;
const newborn = `${rootName}/خميس/أحمد/مولود`;
const cousin = `${rootName}/عبدالله/سعد`;

function row(name, opts = {}) {
  return {
    id: opts.id ?? Math.abs(String(name).length * 17),
    branchKey,
    parentName: opts.parentName || rootName,
    name,
    birthOrder: null,
    birthDateGregorian: null,
    birthDateHijri: null,
    birthYear: null,
    city: null,
    area: null,
    isDeceased: opts.isDeceased ?? false,
    workStatus: opts.workStatus ?? null,
  };
}

console.log('tree living-count + work_status smoke');

assert(normalizeWorkStatus('موظف') === 'employed', 'موظف → employed');
assert(normalizeWorkStatus('متقاعد') === 'retired', 'متقاعد → retired');
assert(normalizeWorkStatus('عاطل') === 'unemployed', 'عاطل → unemployed');
assert(normalizeWorkStatus('') === '', 'فارغ → unset');
assert(workStatusPercent(2, 4) === 50, 'نسبة 2/4 = 50');
assert(workStatusPercent(0, 4) === 0, 'نسبة 0/4 = 0');
assert(workStatusPercent(1, 0) === 0, 'نسبة مع living=0 = 0');

const livingBase = collectBranchTreeStats(
  [
    row(father, { workStatus: 'employed' }),
    row(son, { parentName: father, workStatus: 'employed' }),
  ],
  branchKey,
);
assert(livingBase.living === 2, 'قاعدة: أب + ابن حيّان = 2');
assert(livingBase.workStatus.employed === 2, 'موظفان حيان');
assert(livingBase.workStatus.retired === 0, 'لا متقاعدين');

const afterDeath = collectBranchTreeStats(
  [
    row(father, { workStatus: 'employed' }),
    row(son, { parentName: father, isDeceased: true, workStatus: 'employed' }),
  ],
  branchKey,
);
assert(afterDeath.living === 1, 'وسم الابن متوفي ينقص العدد إلى 1');
assert(afterDeath.workStatus.employed === 1, 'المتوفى لا يدخل نسب الموظفين');

const afterBirth = collectBranchTreeStats(
  [
    row(father, { workStatus: 'retired' }),
    row(son, { parentName: father, workStatus: 'employed' }),
    row(newborn, { parentName: son, workStatus: 'unemployed' }),
    row(cousin, { workStatus: null }),
  ],
  branchKey,
);
assert(afterBirth.living === 4, 'أربعة أحياء');
assert(afterBirth.workStatus.employed === 1, 'موظف واحد');
assert(afterBirth.workStatus.retired === 1, 'متقاعد واحد');
assert(afterBirth.workStatus.unemployed === 1, 'عاطل واحد');
assert(afterBirth.workStatus.unset === 1, 'غير محدد واحد');
assert(workStatusPercent(afterBirth.workStatus.employed, afterBirth.living) === 25, 'موظف 25٪');

assert(isTreePersonDeceased(false, true) === true, 'عمود deceased=true يكفي ولو is_deceased=false');
assert(isTreePersonDeceased('متوفى') === true, 'قيمة عربية متوفى تُعدّ وفاة');
assert(isTreePersonDeceased(false, false) === false, 'حيّ صريح لا يُعدّ متوفى');

if (process.exitCode) {
  console.error('\ntree stats smoke failed');
  process.exit(1);
}
console.log('\ntree stats smoke passed');
