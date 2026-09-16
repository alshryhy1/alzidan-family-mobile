#!/usr/bin/env node
/**
 * Probes mobile admin Supabase RPCs. Requires .env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * Usage: node scripts/verify-admin-rpcs.mjs [optional-phone-for-session-probe]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...process.env, ...loadEnv() };
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const probePhone = process.argv[2] || '';

const RPCS = [
  'family_admin_session_v1',
  'family_admin_search_people_v1',
  'family_admin_update_person_v1',
  'family_admin_set_phone_v1',
  'family_admin_requests_list_v1',
  'family_admin_request_reject_v1',
  'family_admin_request_approve_v1',
  'family_admin_request_bind_v1',
  'family_admin_delegates_list_v1',
  'family_admin_delegates_set_role_v1',
  'family_admin_delegates_set_enabled_v1',
  'family_admin_devices_list_v1',
  'family_admin_device_unbind_v1',
  'women_manager_session_v1',
  'women_manager_phone_requests_v1',
  'women_manager_search_members_v1',
  'women_manager_add_member_v1',
  'women_manager_bind_phone_v1',
  'women_manager_set_member_phone_v1',
  'women_manager_set_pending_phone_v1',
  'women_manager_mother_children_v1',
  'women_manager_search_tree_people_v1',
  'women_manager_link_mother_v1',
  'women_manager_unlink_mother_v1',
  'delegate_app_session_v1',
  'delegate_app_requests_list_v1',
  'delegate_app_request_set_v1',
  'delegate_app_search_people_v1',
  'delegate_app_request_bind_v1',
];

function rpcArgs(name) {
  if (name.endsWith('_session_v1')) return { p_phone: probePhone || '+966500000000' };
  if (name.includes('search')) return { p_phone: probePhone || '+966500000000', p_query: 'اختبار' };
  if (name === 'family_admin_search_people_v1') {
    return { p_phone: probePhone || '+966500000000', p_query: 'اختبار', p_branch_key: null };
  }
  if (name === 'delegate_app_search_people_v1') {
    return { p_phone: probePhone || '+966500000000', p_query: 'اختبار' };
  }
  if (name.includes('_list_v1') || name.includes('phone_requests')) {
    return { p_phone: probePhone || '+966500000000' };
  }
  return { p_phone: probePhone || '+966500000000' };
}

async function probeRpc(name) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rpcArgs(name)),
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  if (response.status === 404 || /PGRST202|Could not find the function/i.test(text)) {
    return { name, status: 'missing', http: response.status, detail: text.slice(0, 120) };
  }
  if (!response.ok) {
    return { name, status: 'exists_error', http: response.status, detail: text.slice(0, 120) };
  }
  const row = body && typeof body === 'object' ? body : {};
  if (row.error === 'sql_missing') {
    return { name, status: 'sql_missing', http: response.status, detail: 'sql_missing' };
  }
  return { name, status: 'ok', http: response.status, detail: row.ok === false ? String(row.error || 'ok_false') : 'reachable' };
}

async function main() {
  if (!url || !key) {
    console.error('FAIL: أضف EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_ANON_KEY في .env');
    process.exit(1);
  }
  console.log(`Supabase: ${url}`);
  console.log(`Probing ${RPCS.length} admin RPCs…\n`);

  const results = [];
  for (const name of RPCS) {
    try {
      const row = await probeRpc(name);
      results.push(row);
      const icon = row.status === 'ok' || row.status === 'exists_error' ? 'OK' : 'MISSING';
      console.log(`${icon}: ${name} — ${row.status} (${row.http}) ${row.detail}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({ name, status: 'network', detail });
      console.log(`ERR: ${name} — ${detail}`);
    }
  }

  const missing = results.filter((r) => r.status === 'missing' || r.status === 'sql_missing');
  const reachable = results.filter((r) => r.status === 'ok' || r.status === 'exists_error');
  console.log(`\nالخلاصة: ${reachable.length} موجودة/تستجيب، ${missing.length} مفقودة من ${RPCS.length}`);
  if (missing.length) {
    console.log('\nمفقودة:');
    missing.forEach((r) => console.log(`  - ${r.name}`));
    process.exit(1);
  }
}

main();
