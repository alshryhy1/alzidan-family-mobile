#!/usr/bin/env node
/**
 * Deploy mobile admin RPCs to Supabase Postgres.
 *
 * Requires one of:
 *   SUPABASE_DB_URL — postgres connection string (preferred)
 *   DATABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL (uses pg via pooler if password in env)
 *
 * Usage:
 *   SUPABASE_DB_URL='postgresql://...' node scripts/deploy-admin-rpcs.mjs
 *   node scripts/deploy-admin-rpcs.mjs --dry-run
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, 'alzidan-family');

const SQL_FILES = [
  'supabase/sql/COPY-ME-family-admin-app-v1.sql',
  'supabase/sql/COPY-ME-family-admin-delegates-v1.sql',
  'supabase/sql/COPY-ME-women-manager-phone-requests-v1.sql',
  'supabase/sql/COPY-ME-women-manager-members-v1.sql',
  'supabase/sql/COPY-ME-women-manager-mothers-v1.sql',
  'supabase/sql/COPY-ME-women-manager-search-match-v1.sql',
  'supabase/sql/COPY-ME-delegate-app-inbox-v1.sql',
];

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function bundleSql() {
  const parts = [];
  for (const rel of SQL_FILES) {
    const path = join(webRoot, rel);
    if (!existsSync(path)) {
      throw new Error(`Missing SQL file: ${path}\nClone alzidan-family next to mobile repo.`);
    }
    parts.push(`-- ===== ${rel} =====\n`);
    parts.push(readFileSync(path, 'utf8'));
    parts.push('\n');
  }
  return parts.join('\n');
}

async function deployWithPg(url, sql, dryRun) {
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  if (dryRun) {
    console.log(`Dry-run: would execute ${sql.length} bytes in ${SQL_FILES.length} files.`);
    await client.end();
    return;
  }
  console.log(`Executing ${SQL_FILES.length} SQL bundles…`);
  await client.query(sql);
  await client.end();
  console.log('Done.');
}

function deployWithPsql(url, sql, dryRun) {
  if (dryRun) {
    console.log(`Dry-run: would execute ${sql.length} bytes via psql.`);
    return;
  }
  const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  console.log(result.stdout || 'Done.');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = { ...loadEnv(), ...process.env };
  const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL || '';

  if (!existsSync(webRoot)) {
    console.error('Clone web repo: git clone https://github.com/alshryhy1/alzidan-family alzidan-family');
    process.exit(1);
  }

  const sql = bundleSql();
  const outPath = join(root, 'supabase/deploy-admin-rpcs-bundle.sql');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(join(root, 'supabase'), { recursive: true });
  writeFileSync(outPath, sql, 'utf8');
  console.log(`Bundled SQL written to ${outPath}`);

  if (!dbUrl) {
    console.error('\nMissing SUPABASE_DB_URL or DATABASE_URL.');
    console.error('Get it from Supabase → Project Settings → Database → Connection string (URI).');
    console.error('Then run: SUPABASE_DB_URL="postgresql://..." node scripts/deploy-admin-rpcs.mjs');
    process.exit(1);
  }

  try {
    await deployWithPg(dbUrl, sql, dryRun);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/cannot find package 'pg'|ERR_MODULE_NOT_FOUND/i.test(msg)) {
      console.log('pg not installed, trying psql…');
      deployWithPsql(dbUrl, sql, dryRun);
    } else {
      throw error;
    }
  }

  console.log('\nVerifying RPCs…');
  const verify = spawnSync('node', [join(root, 'scripts/verify-admin-rpcs.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env,
  });
  process.exit(verify.status || 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
