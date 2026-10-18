/**
 * Living / total tree counts + work_status tallies.
 * Mirrors src/utils/treeStats.collectBranchTreeStats (same path the Branches UI uses).
 *
 * Rules under test:
 * - إضافة عضو حي → living +1 و total +1
 * - إضافة مولود حي → living +1 و total +1
 * - تسجيل وفاة لشخص موجود → living −1 و total ثابت و deceased +1
 * - إضافة عضو متوفى من البداية → total +1 و living لا يزيد
 * - المجموع الكلي للفروع = مجموع living لكل فرع
 */
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-esm-hook.mjs', import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  collectBranchTreeStats,
  isTreePersonDeceased,
  normalizeEducationDegree,
  normalizeWorkStatus,
  normalizeWorkplace,
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
const member = `${rootName}/خميس/سعد`;

let nextId = 1;
function row(name, opts = {}) {
  return {
    id: opts.id ?? nextId++,
    branchKey: opts.branchKey || branchKey,
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
    workplace: opts.workplace ?? null,
    educationDegree: opts.educationDegree ?? null,
  };
}

console.log('tree living/total + work_status + education smoke');

assert(normalizeWorkStatus('موظف') === 'employed', 'موظف → employed');
assert(normalizeWorkStatus('متقاعد') === 'retired', 'متقاعد → retired');
assert(normalizeWorkStatus('عاطل') === 'unemployed', 'عاطل → unemployed');
assert(normalizeWorkStatus('') === '', 'فارغ → unset');
assert(normalizeEducationDegree('متوسط') === 'intermediate', 'متوسط → intermediate');
assert(normalizeEducationDegree('ثانوي') === 'secondary', 'ثانوي → secondary');
assert(normalizeEducationDegree('دبلوم') === 'diploma', 'دبلوم → diploma');
assert(normalizeEducationDegree('بكالوريوس') === 'bachelor', 'بكالوريوس → bachelor');
assert(normalizeEducationDegree('ماجستير') === 'master', 'ماجستير → master');
assert(normalizeEducationDegree('دكتوراه') === 'doctorate', 'دكتوراه → doctorate');
assert(normalizeWorkplace('  وزارة التعليم  ') === 'وزارة التعليم', 'جهة العمل تُقلَّم');
assert(workStatusPercent(2, 4) === 50, 'نسبة 2/4 = 50');
assert(workStatusPercent(0, 4) === 0, 'نسبة 0/4 = 0');
assert(workStatusPercent(1, 0) === 0, 'نسبة مع living=0 = 0');

const baseRows = [
  row(father, { workStatus: 'employed', educationDegree: 'bachelor', workplace: 'تعليم' }),
  row(son, { parentName: father, workStatus: 'employed', educationDegree: 'secondary' }),
];
const base = collectBranchTreeStats(baseRows, branchKey);
assert(base.living === 2, 'قاعدة: أب + ابن حيّان → living=2');
assert(base.total === 2, 'قاعدة: total=2');
assert(base.deceased === 0, 'قاعدة: deceased=0');
assert(base.workStatus.employed === 2, 'موظفان حيان');
assert(base.educationDegree.bachelor === 1, 'بكالوريوس واحد');
assert(base.educationDegree.secondary === 1, 'ثانوي واحد');

const afterAddMember = collectBranchTreeStats(
  [...baseRows, row(member, { parentName: father, workStatus: 'unemployed' })],
  branchKey,
);
assert(afterAddMember.living === base.living + 1, 'إضافة عضو حي → living +1');
assert(afterAddMember.total === base.total + 1, 'إضافة عضو حي → total +1');
assert(afterAddMember.deceased === 0, 'إضافة عضو حي → deceased ثابت');

const afterBirth = collectBranchTreeStats(
  [
    ...baseRows,
    row(newborn, { parentName: son, workStatus: null }),
  ],
  branchKey,
);
assert(afterBirth.living === base.living + 1, 'إضافة مولود حي → living +1');
assert(afterBirth.total === base.total + 1, 'إضافة مولود حي → total +1');
assert(afterBirth.workStatus.unset === 1, 'مولود بلا حالة → unset');

const afterDeath = collectBranchTreeStats(
  [
    row(father, { workStatus: 'employed', educationDegree: 'bachelor' }),
    row(son, {
      parentName: father,
      isDeceased: true,
      workStatus: 'employed',
      educationDegree: 'secondary',
    }),
  ],
  branchKey,
);
assert(afterDeath.living === base.living - 1, 'تسجيل وفاة → living −1');
assert(afterDeath.total === base.total, 'تسجيل وفاة → total ثابت');
assert(afterDeath.deceased === 1, 'تسجيل وفاة → deceased +1');
assert(afterDeath.workStatus.employed === 1, 'المتوفى يخرج من نسب الموظفين');
assert(afterDeath.educationDegree.bachelor === 1, 'المتوفى يخرج من نسب الشهادات');
assert(afterDeath.educationDegree.secondary === 0, 'شهادة المتوفى لا تُحسب');

const afterDeathThenBirth = collectBranchTreeStats(
  [
    row(father, { workStatus: 'employed' }),
    row(son, { parentName: father, isDeceased: true, workStatus: 'employed' }),
    row(newborn, { parentName: son, workStatus: null }),
  ],
  branchKey,
);
assert(
  afterDeathThenBirth.living === base.living - 1 + 1,
  'وفاة ثم مولود حي: living يعود لنفس القاعدة (2−1+1)',
);
assert(afterDeathThenBirth.total === base.total + 1, 'وفاة ثم مولود → total +1 (المولود فقط)');
assert(afterDeathThenBirth.deceased === 1, 'وفاة ثم مولود → deceased=1');

const deceasedNewborn = collectBranchTreeStats(
  [
    ...baseRows,
    row(newborn, { parentName: son, isDeceased: true }),
  ],
  branchKey,
);
assert(deceasedNewborn.living === base.living, 'مولود متوفى لا يزيد الأحياء');
assert(deceasedNewborn.total === base.total + 1, 'مولود متوفى يزيد total فقط');
assert(deceasedNewborn.deceased === 1, 'مولود متوفى → deceased=1');

const addDeceasedMember = collectBranchTreeStats(
  [
    ...baseRows,
    row(cousin, { isDeceased: true, workStatus: 'retired' }),
  ],
  branchKey,
);
assert(addDeceasedMember.living === base.living, 'إضافة عضو متوفى لا تزيد living');
assert(addDeceasedMember.total === base.total + 1, 'إضافة عضو متوفى تزيد total');
assert(addDeceasedMember.workStatus.retired === 0, 'المتوفى لا يدخل نسب المتقاعدين');

// مجموع كلي عبر فرعين — نفس جمع شاشة الفروع
const mazidKey = 'مزيد';
const mazidRoot = 'مزيد بن مطلق بن زيدان';
const mazidChild = `${mazidRoot}/خميس`;
const zidanLiving = collectBranchTreeStats(baseRows, branchKey).living;
const mazidLiving = collectBranchTreeStats(
  [
    row(mazidChild, {
      id: 9001,
      branchKey: mazidKey,
      parentName: mazidRoot,
      workStatus: 'employed',
    }),
  ],
  mazidKey,
).living;
const heroTotal = zidanLiving + mazidLiving;
assert(zidanLiving === 2, 'فرع زيدان living=2');
assert(mazidLiving === 1, 'فرع مزيد living=1');
assert(heroTotal === 3, 'المجموع الكلي = مجموع living لكل فرع');

assert(isTreePersonDeceased(false, true) === true, 'عمود deceased=true يكفي ولو is_deceased=false');
assert(isTreePersonDeceased('متوفى') === true, 'قيمة عربية متوفى تُعدّ وفاة');
assert(isTreePersonDeceased(false, false) === false, 'حيّ صريح لا يُعدّ متوفى');

if (process.exitCode) {
  console.error('\ntree stats smoke failed');
  process.exit(1);
}
console.log('\ntree stats smoke passed');
