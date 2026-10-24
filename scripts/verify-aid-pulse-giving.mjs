/**
 * فرص المساعدة داخل تبرع + إضافة في النبض بلا تغيير شكل النبض.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const giving = read('src/screens/GivingScreen.tsx');
const home = read('src/screens/HomeScreen.tsx');
const aid = read('src/screens/AidRequestScreen.tsx');
const card = read('src/components/PublishedAidOpportunityCard.tsx');
const svc = read('src/services/aidRequest.ts');
const app = read('App.tsx');
const sql = read('docs/COPY-ME-family-aid-pay-channels-v1.sql');
const notices = read('src/utils/pulseNotices.ts');

const checks = [
  ['giving has aid pane', giving.includes("pane === 'aid'")],
  ['giving loads published aid', giving.includes('loadPublishedAidRequests')],
  ['giving shows opportunity card', giving.includes('PublishedAidOpportunityCard')],
  ['giving opens aid submit', giving.includes('onOpenAidSubmit')],
  ['app wires onOpenAidSubmit', app.includes('onOpenAidSubmit={() => openAidRequest')],
  ['home loads published aid', home.includes('loadPublishedAidRequests')],
  ['home shows aid only when rows', home.includes('publishedAid.length ?')],
  ['home does not override subtitle', !home.includes('subtitle={aidHeroLine}')],
  ['home does not inject heroExtra aid', !home.includes('aidHeroBand')],
  ['home keeps original notices', home.includes('notices={notices}')],
  ['home opens giving', home.includes('onOpenGiving')],
  ['ticker unchanged no aid kind', !notices.includes("'aid'")],
  ['app home opens giving', app.includes('onOpenGiving={() => openGiving') || app.includes('onOpenGiving={() => setScreen')],
  ['aid screen uses opportunity card', aid.includes('PublishedAidOpportunityCard')],
  ['aid form has need kinds', aid.includes('AID_NEED_KINDS')],
  ['aid form has pay ref field', aid.includes('selectedNeed.fieldLabel')],
  ['card supports compact pulse', card.includes('compact')],
  ['card has help field box', card.includes('خانة المساعدة')],
  ['card has othaim copy action', card.includes('رقم بطاقة العثيم')],
  ['svc has need kinds', svc.includes('AID_NEED_KINDS')],
  ['svc has water channel', svc.includes("'sawaa_water'")],
  ['svc has pay ref field label', svc.includes('aidPayRefFieldLabel')],
  ['svc has pay how-to', svc.includes('aidPayHowTo')],
  ['svc has othaim channel', svc.includes("'othaim_card'")],
  ['svc has sawaa electric', svc.includes("'sawaa_electric'")],
  ['svc has sawaa rent', svc.includes("'sawaa_rent'")],
  ['sql need kinds file', read('docs/COPY-ME-family-aid-need-kinds-v1.sql').includes('sawaa_water')],
  ['sql submit requires pay_ref', read('docs/COPY-ME-family-aid-need-kinds-v1.sql').includes('pay_ref_required')],
  ['sql adds pay_channel', sql.includes('add column if not exists pay_channel')],
  ['sql adds pay_ref', sql.includes('add column if not exists pay_ref')],
  ['sql public omits identity', sql.includes('null::text as display_name')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('verify-aid-pulse-giving failed:\n' + failed.map(([n]) => ` - ${n}`).join('\n'));
  process.exit(1);
}
console.log(`verify-aid-pulse-giving: ${checks.length} checks ok`);
