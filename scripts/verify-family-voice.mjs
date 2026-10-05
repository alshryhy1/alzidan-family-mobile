/**
 * نسب من المسار المحفوظ، جملة آخر زيارة، وتعبئة نموذج المناسبة من جملة.
 * ما ينشر، وما يخترع أبًا.
 */
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-esm-hook.mjs', import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const { nasabQuery, spokenNasab, sinceVisitSummary } = await import(
  pathToFileURL(join(root, 'src/utils/familyVoiceCopy.ts')).href
);
const { parseOccasionDraft } = await import(
  pathToFileURL(join(root, 'src/utils/occasionDraft.ts')).href
);

const failures = [];

function check(name, actual, expected) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) failures.push(`${name}\n  got ${left}\n  want ${right}`);
}

check(
  'nasab chain',
  spokenNasab(['لاحم بن مطلق بن زيدان', 'ندا', 'سهو', 'الحميدي', 'محمد']),
  'محمد بن الحميدي بن سهو بن ندا بن لاحم بن مطلق بن زيدان',
);

check(
  'single name',
  spokenNasab(['محمد']),
  'محمد. ما بعده غير مسجّل في الشجرة.',
);

check('empty nasab', spokenNasab(['', '  ']), '');
check('query نسب', nasabQuery('نسب محمد'), 'محمد');
check('query وش نسب', nasabQuery('وش نسب  الحميدي'), 'الحميدي');

check('empty visit', sinceVisitSummary([]), 'ما فاتك شيء من آخر زيارة.');
check(
  'one visit',
  sinceVisitSummary([{ kind: 'death', title: 'وفاة', subtitle: 'أبو هيثم' }]),
  'فاتك عزا أبو هيثم.',
);

const finjal = parseOccasionDraft('فنجال بعد العشاء عند أبو هيثم، ثلاث ساعات');
check('finjal type', finjal?.typeKey, 'finjal_isha');
check('finjal family', finjal?.family, 'occasion');
check('finjal person', finjal?.person, 'أبو هيثم');
check('finjal hours', finjal?.hours, 3);

check('unknown sentence', parseOccasionDraft('نروح السوق بكرة'), null);
check('short sentence', parseOccasionDraft('لا'), null);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('family voice checks ok');
