/**
 * المسجّل في العائلة ينشر المناسبة مباشرة — لا يعتمد على جهاز موثوق فقط.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/services/memberOccasions.ts'), 'utf8');
const screen = readFileSync(join(root, 'src/screens/EventsScreen.tsx'), 'utf8');

const checks = [
  ['rpc lookup', src.includes("member_phone_registered_v1")],
  ['profiles fallback', src.includes('memberProfilePhoneQuery')],
  ['device_required mapped', src.includes("error: 'device_required'")],
  ['hint registered phone', screen.includes('الجوال مسجّل — تنشر مباشرة')],
  ['button uses phoneRegistered', /phoneRegistered\s*\n\s*\? 'نشر إعلان الوفاة'/.test(screen)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(
    'verify-member-occasion-direct failed:\n' + failed.map(([name]) => ` - ${name}`).join('\n'),
  );
  process.exit(1);
}
console.log(`verify-member-occasion-direct: ${checks.length} checks ok`);
