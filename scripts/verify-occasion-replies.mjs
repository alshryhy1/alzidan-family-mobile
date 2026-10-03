/**
 * الرد يطابق نوع المناسبة: لا تهنئة على عزاء، ولا حضور على خبر، ولا مرض على سلامة.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/services/occasionInteractions.ts'), 'utf8');
const events = readFileSync(join(root, 'src/screens/EventsScreen.tsx'), 'utf8');
const encounter = readFileSync(join(root, 'src/screens/PersonEncounterScreen.tsx'), 'utf8');

const JOY = new Set([
  'bless_success',
  'you_deserve',
  'm_barak_lakuma',
  'm_mubarak',
  'w_barak_lakuma',
  'cer_barak',
  'inv_yes',
  'inv_no',
  'inv_maybe',
]);
const DEATH = new Set([
  'd_rahimahullah',
  'd_ghafar',
  'k_azza',
  'k_ajr',
  'msg_condolence',
]);

function filterCatalogForType(items, typeKey, family) {
  const DROP = new Set(['inv_details', 'inv_contact']);
  const ILLNESS = new Set(['heal_ask', 'heal_tahoor']);
  const SICKNESS = new Set(['heal_ask', 'heal_tahoor', 'heal_shifa']);
  const RSVP = new Set([
    'feast',
    'gathering',
    'family_meetup',
    'dinner',
    'lunch',
    'general',
    'finjal_asr',
    'finjal_isha',
    'finjal_hawlna',
  ]);
  let list = (items || []).filter((item) => {
    if (!item || DROP.has(item.key)) return false;
    const types = item.applies_to_types;
    if (!Array.isArray(types) || !types.length || !types.includes(typeKey)) return false;
    if (family === 'death' && item.family && item.family !== 'death') return false;
    if (family === 'health' && item.family && item.family !== 'health') return false;
    if ((family === 'news' || family === 'occasion') && item.family === 'death') return false;
    return true;
  });
  if (typeKey === 'healing') list = list.filter((item) => !ILLNESS.has(item.key));
  if (typeKey === 'safety') list = list.filter((item) => !SICKNESS.has(item.key));
  if (RSVP.has(typeKey)) {
    list = list.filter(
      (item) =>
        item.key === 'inv_yes' ||
        item.key === 'inv_no' ||
        item.key === 'inv_maybe' ||
        item.allows_message,
    );
  }
  return list;
}

const mixed = [
  { key: 'd_rahimahullah', family: 'death', applies_to_types: ['death', 'condolence'] },
  { key: 'k_azza', family: 'death', applies_to_types: ['death', 'condolence'] },
  { key: 'bless_success', family: 'news', applies_to_types: ['promotion_notice'] },
  { key: 'inv_yes', family: 'occasion', applies_to_types: ['gathering'] },
  { key: 'm_mubarak', family: 'news', applies_to_types: ['marriage'] },
  { key: 'orphan_joy', family: 'news', applies_to_types: [] },
  { key: 'heal_tahoor', family: 'health', applies_to_types: ['sick', 'safety'] },
  { key: 'heal_salama', family: 'health', applies_to_types: ['safety', 'healing'] },
];

const deathGot = filterCatalogForType(mixed, 'death', 'death').map((x) => x.key);
const condolenceGot = filterCatalogForType(mixed, 'condolence', 'death').map((x) => x.key);
const marriageGot = filterCatalogForType(mixed, 'marriage', 'news').map((x) => x.key);
const safetyGot = filterCatalogForType(mixed, 'safety', 'health').map((x) => x.key);
const gatheringGot = filterCatalogForType(
  [
    { key: 'inv_yes', family: 'occasion', applies_to_types: ['gathering'] },
    { key: 'inv_no', family: 'occasion', applies_to_types: ['gathering'] },
    { key: 'inv_maybe', family: 'occasion', applies_to_types: ['gathering'] },
    { key: 'msg_custom', family: 'occasion', applies_to_types: ['gathering'], allows_message: true },
    { key: 'inv_details', family: 'occasion', applies_to_types: ['gathering'] },
    { key: 'bless_success', family: 'news', applies_to_types: ['promotion_notice'] },
    { key: 'd_rahimahullah', family: 'death', applies_to_types: ['death'] },
  ],
  'gathering',
  'occasion',
).map((x) => x.key);

const checks = [
  ['death has condolence only', deathGot.join(',') === 'd_rahimahullah,k_azza'],
  ['no joy on death', deathGot.every((key) => !JOY.has(key))],
  ['condolence same family', condolenceGot.every((key) => DEATH.has(key))],
  ['no mubarak leak via empty applies', !deathGot.includes('orphan_joy')],
  ['marriage has mubarak only from list', marriageGot.join(',') === 'm_mubarak'],
  ['no death on marriage', marriageGot.every((key) => !DEATH.has(key))],
  ['safety hides طهور', !safetyGot.includes('heal_tahoor') && safetyGot.includes('heal_salama')],
  ['gathering rsvp only', gatheringGot.join(',') === 'inv_yes,inv_no,inv_maybe,msg_custom'],
  ['source rejects empty applies', src.includes('!Array.isArray(types) || !types.length')],
  ['source death family guard', src.includes("family === 'death'")],
  ['whatsapp death before mubarak', /family === 'death'[\s\S]*ألف مبروك/.test(events)],
  ['encounter uses type not category', /eventType=\{String\(liveOccasion\.type/.test(encounter)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(
    'verify-occasion-replies failed:\n' + failed.map(([name]) => ` - ${name}`).join('\n'),
  );
  process.exit(1);
}
console.log(`verify-occasion-replies: ${checks.length} checks ok`);
