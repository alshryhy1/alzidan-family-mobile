import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), 'utf8'));
}

const pkg = readJson('package.json');
const app = readJson('app.json');

const checks = [];

function check(label, ok, detail) {
  checks.push({ label, ok, detail });
  console.log(`${ok ? 'OK' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
}

check('expo-notifications dependency', Boolean(pkg.dependencies?.['expo-notifications']));
check('expo-device dependency', Boolean(pkg.dependencies?.['expo-device']));
check('expo-notifications plugin', Array.isArray(app.expo?.plugins) && app.expo.plugins.some((p) => Array.isArray(p) ? p[0] === 'expo-notifications' : p === 'expo-notifications'));
check('EAS projectId', Boolean(app.expo?.extra?.eas?.projectId), app.expo?.extra?.eas?.projectId || '');

const pushSource = readFileSync(join(root, 'src/services/pushNotifications.ts'), 'utf8');
check('registerPushToken defined', pushSource.includes('export async function registerPushToken'));
check('physical device guard', pushSource.includes('Device.isDevice'));
check('push_tokens upsert', pushSource.includes("'push_tokens'"));
check('Android channel family-events', pushSource.includes("'family-events'"));
check('notification handler configured', pushSource.includes('setNotificationHandler'));

const pushNotifyFn = join(root, '../alzidan-family/supabase/functions/alzidan-push-notify/index.ts');
check('push sender edge function exists', existsSync(pushNotifyFn));

const requestActions = readFileSync(join(root, '../alzidan-family/assets/js/modules/request-actions.js'), 'utf8');
check('admin invokes alzidan-push-notify', requestActions.includes('alzidan-push-notify'));

const appTsx = readFileSync(join(root, 'App.tsx'), 'utf8');
check('App registers push on mount', appTsx.includes('registerPushToken'));

const envPath = join(root, '.env');
const envExamplePath = join(root, '.env.example');
check('.env exists', existsSync(envPath));
check('.env.example exists', existsSync(envExamplePath));

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, 'utf8');
  check('EXPO_PUBLIC_SUPABASE_URL in .env', /EXPO_PUBLIC_SUPABASE_URL=/.test(envText));
  check('EXPO_PUBLIC_SUPABASE_ANON_KEY in .env', /EXPO_PUBLIC_SUPABASE_ANON_KEY=/.test(envText));
}

const failed = checks.filter((item) => !item.ok).length;
if (failed) {
  console.error(`\n${failed} فحص(فحوص) فشل — جاهزية الإشعارات غير مكتملة (ثابت).`);
  process.exit(1);
}

console.log('\nنجح التحقق الثابت لجاهزية الإشعارات.');
console.log('ملاحظة: تسليم push فعلي يحتاج جهازًا حقيقيًا + build EAS (§17).');
