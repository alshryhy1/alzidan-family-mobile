/**
 * جوالات المتصلين: SQL + نبض بالجوال + تبويب إدارة العائلة + أصول الويب.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const sql = read('docs/COPY-ME-pulse-online-phones-v1.sql');
const pulse = read('src/services/pulsePresence.ts');
const app = read('App.tsx');
const adminSvc = read('src/services/familyAdmin.ts');
const adminUi = read('src/screens/FamilyAdminScreen.tsx');
const webJs = read('docs/web-assets/admin-pulse-online.js');
const run = read('docs/RUN-PULSE-ONLINE-PHONES.md');

const checks = [
  ['sql has presence table', sql.includes('create table if not exists public.pulse_presence')],
  ['sql migrates last_seen_at', sql.includes('add column if not exists last_seen_at')],
  ['sql does not backfill now()', !sql.includes("set last_seen_at = now()\n    where last_seen_at is null")],
  ['sql deletes unknown timestamps', sql.includes('where last_seen_at is null')],
  ['sql heartbeat accepts phone', sql.includes('p_phone text default null')],
  ['sql family admin list', sql.includes('family_admin_pulse_online_v1')],
  ['sql web admin list', sql.includes('admin_pulse_online_v1')],
  ['sql registered phone only', sql.includes('member_phone_registered_v1')],
  ['mobile heartbeat sends phone', pulse.includes('p_phone')],
  ['app passes member phone to heartbeat', app.includes('pulseHeartbeat(sessionId, memberPhoneForRequests)')],
  ['admin service fetch online', adminSvc.includes('family_admin_pulse_online_v1')],
  ['admin UI online tab', adminUi.includes("key: 'online'") && adminUi.includes('أرقام الآن')],
  ['admin UI online section title', adminUi.includes('أرقام جوالات المتصلين الآن')],
  ['admin UI clarifies public count unchanged', adminUi.includes('المتواجدون')],
  ['web js rpc', webJs.includes('admin_pulse_online_v1')],
  ['runbook exists', run.includes('SQL مرة واحدة')],
  ['html snippet exists', existsSync(join(root, 'docs/snippets/admin-pulse-online-section.html'))],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(
    'verify-admin-online-phones failed:\n' + failed.map(([name]) => ` - ${name}`).join('\n'),
  );
  process.exit(1);
}
console.log(`verify-admin-online-phones: ${checks.length} checks ok`);
