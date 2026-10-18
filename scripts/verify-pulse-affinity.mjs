/**
 * Pulse affinity lines under presence (full web-style split).
 * Keep in sync with src/utils/pulseAffinity.ts + PulseLiveBoard / HomeScreen wiring.
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

console.log('pulse affinity line smoke');

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

assert(board.includes('pulseAffinityTotalLine'), 'PulseLiveBoard يعرض المجموع');
assert(board.includes('pulseAffinitySplitLine'), 'PulseLiveBoard يعرض التقسيم');
assert(home.includes('affinityStats'), 'HomeScreen يمرّر الإحصاء');
assert(app.includes('affinityStats={publicData.affinityStats}'), 'App يمرّر affinityStats كاملة');
const presenceClose = board.indexOf('</LinearGradient>');
const affinityRender = board.indexOf('affinityTotal ?');
assert(
  presenceClose >= 0 && affinityRender > presenceClose,
  'السطور تحت شريط الحضور لا داخله',
);
const pulseIdx = home.indexOf('<PulseLiveBoard');
const boardIdx = home.indexOf('وش عند الزيدان؟');
assert(pulseIdx >= 0 && boardIdx >= 0 && pulseIdx < boardIdx, 'نبض فوق قسم اللوحة لا تحتها');

if (process.exitCode) {
  console.error('\npulse affinity smoke failed');
  process.exit(1);
}
console.log('\npulse affinity smoke passed');
