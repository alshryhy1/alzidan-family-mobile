/**
 * طلب المساعدة الخاص يظهر فقط لأنثى حالتها أرملة أو مطلقة.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const publicData = read('src/services/publicData.ts');
const profile = read('src/screens/ProfileScreen.tsx');
const encounter = read('src/screens/PersonEncounterScreen.tsx');
const aid = read('src/screens/AidRequestScreen.tsx');

const checks = [
  ['aidSituation requires female', publicData.includes('viewerIsFemale')],
  ['male clears widow flags', publicData.includes('if (!viewerIsFemale)')],
  ['profile gates by female', profile.includes('!isPublicLineageHiddenPerson(memberTreeRow)')],
  ['profile shows only when eligible', profile.includes('onOpenAidRequest && canRequestPrivateAid')],
  ['encounter requires aidSituation', encounter.includes('onOpenAidRequest && aidSituation')],
  ['encounter checks female for aidSituation', encounter.includes('isPublicLineageHiddenPerson(person)')],
  ['aid submit requires female', aid.includes('!isPublicLineageHiddenPerson(viewerPerson)')],
  ['aid submit blocks non widow/divorced', aid.includes("situation !== 'widow' && situation !== 'divorced'")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('verify-aid-widow-only failed:\n' + failed.map(([n]) => ` - ${n}`).join('\n'));
  process.exit(1);
}
console.log(`verify-aid-widow-only: ${checks.length} checks ok`);
