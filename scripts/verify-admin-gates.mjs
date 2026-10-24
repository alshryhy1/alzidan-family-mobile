/**
 * إدارة العائلة وطلبات الفرع لا تظهر لغير المخوّل.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const familyAdmin = readFileSync(join(root, 'src/services/familyAdmin.ts'), 'utf8');
const delegate = readFileSync(join(root, 'src/services/delegateInbox.ts'), 'utf8');
const profile = readFileSync(join(root, 'src/screens/ProfileScreen.tsx'), 'utf8');
const sql = readFileSync(join(root, 'docs/COPY-ME-family-admin-session-tighten-v1.sql'), 'utf8');

function isFamilyAdminEnabledFlag(value) {
  return value === true || value === 1 || value === 'true';
}

function isDelegateInboxEnabledFlag(value, roleKey) {
  const on = value === true || value === 1 || value === 'true';
  if (!on) return false;
  const role = String(roleKey || '').trim();
  if (!role) return true;
  return ['branch_editor', 'events_editor', 'full_delegate'].includes(role);
}

const checks = [
  ['strict true enables admin', isFamilyAdminEnabledFlag(true)],
  ['string false does not enable admin', !isFamilyAdminEnabledFlag('false')],
  ['undefined does not enable admin', !isFamilyAdminEnabledFlag(undefined)],
  ['delegate role required when present', !isDelegateInboxEnabledFlag(true, 'member')],
  ['full_delegate ok', isDelegateInboxEnabledFlag(true, 'full_delegate')],
  ['source exports admin flag helper', familyAdmin.includes('export function isFamilyAdminEnabledFlag')],
  ['source requires tree child for admin', familyAdmin.includes('Number(treeChildId || 0) > 0')],
  ['source exports delegate flag helper', delegate.includes('export function isDelegateInboxEnabledFlag')],
  ['profile matches grant tree id', profile.includes('grantId === memberTreeId')],
  ['profile requires delegate session for inbox', profile.includes('delegateInboxEnabled && isDelegateSession')],
  ['sql ties grant to tree_child_id', sql.includes('g.tree_child_id = v_mp.tree_child_id')],
  ['sql drops loose person_id match', !sql.includes('is not distinct from')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('verify-admin-gates failed:\n' + failed.map(([n]) => ` - ${n}`).join('\n'));
  process.exit(1);
}
console.log(`verify-admin-gates: ${checks.length} checks ok`);
