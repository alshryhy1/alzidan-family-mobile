/**
 * Pulse affinity + Home section order.
 * Keep in sync with src/utils/pulseAffinity.ts + PulseLiveBoard / HomeScreen.
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-esm-hook.mjs', import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  pulseAffinitySnap,
  pulseAffinitySplitLine,
  pulseAffinityTotalLine,
} = await import(pathToFileURL(join(root, 'src/utils/pulseAffinity.ts')).href);

function assert(cond, message) {
  if (cond) {
    console.log('  ok  ' + message);
    return;
  }
  console.error('  FAIL  ' + message);
  process.exitCode = 1;
}

console.log('pulse affinity + home order smoke');

const snap = pulseAffinitySnap({ total: 85, insideCount: 61, outsideCount: 23 });
assert(snap?.total === 85 && snap?.insideCount === 61 && snap?.outsideCount === 23, 'يلتقط أرقام الويب');
assert(pulseAffinityTotalLine(snap) === 'مصاهرة · 85', 'سطر المجموع');
assert(
  pulseAffinitySplitLine(snap) === 'داخل العائلة 61 · خارجها 23',
  'سطر الداخل/الخارج',
);
assert(pulseAffinitySnap(null) === null, 'null يخفي');
assert(pulseAffinitySnap({ total: 0, insideCount: 0, outsideCount: 0 }) === null, 'أصفار تخفي');

const board = readFileSync(join(root, 'src/components/PulseLiveBoard.tsx'), 'utf8');
const home = readFileSync(join(root, 'src/screens/HomeScreen.tsx'), 'utf8');
const app = readFileSync(join(root, 'App.tsx'), 'utf8');

assert(board.includes("parts?: PulseBoardPart[]"), 'PulseLiveBoard يدعم تقسيم الأجزاء');
assert(board.includes('pulseAffinityTotalLine'), 'PulseLiveBoard يعرض المجموع');
assert(board.includes('pulseAffinitySplitLine'), 'PulseLiveBoard يعرض التقسيم');
assert(home.includes("parts={['presence']}"), 'الحضور أولًا وحده');
assert(
  home.includes("parts={['affinity', 'tiles', 'notices']}"),
  'المصاهرة والجو بعد الأقسام الشخصية',
);
assert(app.includes('affinityStats={publicData.affinityStats}'), 'App يمرّر affinityStats كاملة');

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
