/**
 * Pulse affinity line under presence (مصاهرون من خارج العائلة).
 * Keep in sync with src/utils/pulseAffinity.ts + PulseLiveBoard / HomeScreen wiring.
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-esm-hook.mjs', import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { pulseAffinityLine } = await import(
  pathToFileURL(join(root, 'src/utils/pulseAffinity.ts')).href
);

function assert(cond, message) {
  if (cond) {
    console.log('  ok  ' + message);
    return;
  }
  console.error('  FAIL  ' + message);
  process.exitCode = 1;
}

console.log('pulse affinity line smoke');

assert(pulseAffinityLine(48) === 'مصاهرون من خارج العائلة · 48', 'عدد خارج العائلة');
assert(pulseAffinityLine(0) === 'مصاهرون من خارج العائلة · 0', 'صفر يظهر');
assert(pulseAffinityLine(null) === '', 'null يخفي السطر');
assert(pulseAffinityLine(undefined) === '', 'undefined يخفي السطر');
assert(pulseAffinityLine(-1) === '', 'سالب يخفي السطر');

const board = readFileSync(join(root, 'src/components/PulseLiveBoard.tsx'), 'utf8');
const home = readFileSync(join(root, 'src/screens/HomeScreen.tsx'), 'utf8');
const app = readFileSync(join(root, 'App.tsx'), 'utf8');

assert(board.includes('pulseAffinityLine'), 'PulseLiveBoard يستورد السطر');
assert(board.includes('affinityOutsideCount'), 'PulseLiveBoard يقبل العدد');
assert(board.includes('styles.affinityLine'), 'السطر داخل شريط الحضور');
assert(home.includes('affinityOutsideCount'), 'HomeScreen يمرّر العدد');
assert(app.includes('affinityStats?.outsideCount'), 'App يمرّر outsideCount من البيانات العامة');
const pulseIdx = home.indexOf('<PulseLiveBoard');
const boardIdx = home.indexOf('وش عند الزيدان؟');
assert(pulseIdx >= 0 && boardIdx >= 0 && pulseIdx < boardIdx, 'نبض فوق قسم اللوحة لا تحتها');

if (process.exitCode) {
  console.error('\npulse affinity smoke failed');
  process.exit(1);
}
console.log('\npulse affinity smoke passed');
