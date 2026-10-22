/**
 * Pulse affinity + work circles + Home section order.
 * Keep in sync with pulseAffinity / pulseStatCircles + PulseLiveBoard / HomeScreen.
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-esm-hook.mjs', import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  pulseAffinitySnap,
  pulseAffinityCaption,
  pulseAffinityTotalLine,
  pulseAffinitySplitLine,
} = await import(pathToFileURL(join(root, 'src/utils/pulseAffinity.ts')).href);
const {
  pulseAffinityCircles,
  pulseWorkCircles,
  pulseWorkSnap,
  pulseStatCirclesA11y,
} = await import(pathToFileURL(join(root, 'src/utils/pulseStatCircles.ts')).href);

function assert(cond, message) {
  if (cond) {
    console.log('  ok  ' + message);
    return;
  }
  console.error('  FAIL  ' + message);
  process.exitCode = 1;
}

console.log('pulse affinity + work circles smoke');

const snap = pulseAffinitySnap({ total: 85, insideCount: 61, outsideCount: 23 });
assert(snap?.total === 85 && snap?.insideCount === 61 && snap?.outsideCount === 23, 'يلتقط أرقام الويب');
assert(pulseAffinityTotalLine(snap) === 'مصاهرة · 85', 'سطر المجموع');
assert(
  pulseAffinitySplitLine(snap) === 'داخل العائلة 61 · خارجها 23',
  'سطر الداخل/الخارج',
);
assert(pulseAffinityCaption(snap) === 'مصاهرة · 85', 'تعليق الدوائر');
assert(pulseAffinitySnap(null) === null, 'null يخفي');
assert(pulseAffinitySnap({ total: 0, insideCount: 0, outsideCount: 0 }) === null, 'أصفار تخفي');

const affinityCircles = pulseAffinityCircles(snap);
assert(affinityCircles.length === 2, 'دائرتا المصاهرة');
assert(affinityCircles[0]?.label === 'داخل' && affinityCircles[0]?.percent === 72, 'نسبة داخل');
assert(affinityCircles[1]?.label === 'خارج' && affinityCircles[1]?.percent === 27, 'نسبة خارج');

const work = pulseWorkSnap({ living: 100, employed: 45, retired: 30, unemployed: 10 });
assert(work?.employed === 45, 'يلتقط الموظفين');
const workCircles = pulseWorkCircles(work);
assert(workCircles.length === 3, 'ثلاث دوائر وظيفية');
assert(workCircles[0]?.percent === 45 && workCircles[0]?.label === 'موظف', 'نسبة موظف');
assert(workCircles[1]?.percent === 30 && workCircles[1]?.label === 'متقاعد', 'نسبة متقاعد');
assert(workCircles[2]?.percent === 10 && workCircles[2]?.label === 'عاطل', 'نسبة عاطل');
assert(pulseWorkSnap({ living: 0, employed: 1, retired: 0, unemployed: 0 }) === null, 'بدون أحياء يخفي');
assert(
  pulseStatCirclesA11y('المصاهرة', affinityCircles) === 'المصاهرة · داخل 72٪ · خارج 27٪',
  'وصف الوصولية',
);

const board = readFileSync(join(root, 'src/components/PulseLiveBoard.tsx'), 'utf8');
const home = readFileSync(join(root, 'src/screens/HomeScreen.tsx'), 'utf8');
const app = readFileSync(join(root, 'App.tsx'), 'utf8');

assert(board.includes("parts?: PulseBoardPart[]"), 'PulseLiveBoard يدعم تقسيم الأجزاء');
assert(board.includes('pulseAffinityCircles'), 'PulseLiveBoard يعرض دوائر المصاهرة');
assert(board.includes('pulseWorkCircles'), 'PulseLiveBoard يعرض دوائر الموظفين');
assert(board.includes('STAT_CIRCLE'), 'دوائر صغيرة بحجم ثابت');
assert(home.includes("parts={['presence']}"), 'الحضور أولًا وحده');
assert(
  home.includes("parts={['affinity', 'tiles', 'notices']}"),
  'المصاهرة والجو بعد الأقسام الشخصية',
);
assert(home.includes('workStatus={workStatusStats}'), 'Home يمرّر إحصاء الموظفين');
assert(app.includes('affinityStats={publicData.affinityStats}'), 'App يمرّر affinityStats كاملة');
assert(app.includes('workStatusStats={pulseWorkStatusStats}'), 'App يمرّر نسب الموظفين');

const presenceCall = home.indexOf("parts={['presence']}");
const familyAtHome = home.indexOf('عند أهلك');
const sinceVisit = home.indexOf('منذ آخر زيارة');
const boardTitle = home.indexOf('وش عند الزيدان؟');
const statsCall = home.indexOf("parts={['affinity', 'tiles', 'notices']}");

assert(
  presenceCall >= 0 &&
    familyAtHome > presenceCall &&
    sinceVisit > familyAtHome &&
    boardTitle > sinceVisit &&
    statsCall > boardTitle,
  'الترتيب: حضور → عند أهلك → منذ آخر زيارة → وش عند الزيدان → مصاهرة/جو',
);

if (process.exitCode) {
  console.error('\npulse affinity smoke failed');
  process.exit(1);
}
console.log('\npulse affinity smoke passed');
