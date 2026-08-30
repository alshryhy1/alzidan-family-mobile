import Constants from 'expo-constants';

import { selectPublicRows } from './supabase';

const BUNDLE_ID = 'com.alzidan.family2';
const FALLBACK_STORE_URL = 'https://apps.apple.com/sa/app/id6797335229';
const LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}&country=sa`;

export type AppStoreGateResult = {
  required: boolean;
  storeUrl: string;
};

type SettingRow = { key?: string; value?: string | null };

function parseVersionParts(value: string) {
  return String(value || '')
    .trim()
    .split(/[.+-]/)
    .map((part) => {
      const n = Number.parseInt(part.replace(/[^0-9].*$/, ''), 10);
      return Number.isFinite(n) ? n : 0;
    });
}

export function compareVersions(a: string, b: string) {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const d = (left[i] || 0) - (right[i] || 0);
    if (d) return d;
  }
  return 0;
}

export function localAppVersion() {
  return String(
    Constants.nativeApplicationVersion || Constants.expoConfig?.version || '',
  ).trim();
}

export function localAppBuild() {
  const raw = String(
    Constants.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber || '',
  ).trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function fetchStoreListing(): Promise<{ version: string; storeUrl: string } | null> {
  try {
    const res = await withTimeout(fetch(LOOKUP_URL), 8000);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ version?: string; trackViewUrl?: string }>;
    };
    const row = Array.isArray(data?.results) ? data.results[0] : null;
    const version = String(row?.version || '').trim();
    if (!version) return null;
    return {
      version,
      storeUrl: String(row?.trackViewUrl || '').trim() || FALLBACK_STORE_URL,
    };
  } catch {
    return null;
  }
}

async function fetchRemoteMinimum(): Promise<{ version: string; build: number; storeUrl: string }> {
  const empty = { version: '', build: 0, storeUrl: '' };
  try {
    const rows = await withTimeout(
      selectPublicRows<SettingRow>(
        'site_settings?select=key,value&key=in.(app_ios_min_version,app_ios_min_build,app_store_url)',
      ),
      8000,
    );
    const map: Record<string, string> = {};
    (rows || []).forEach((row) => {
      const key = String(row?.key || '').trim();
      if (!key) return;
      map[key] = row?.value == null ? '' : String(row.value).trim();
    });
    const build = Number.parseInt(map.app_ios_min_build || '', 10);
    return {
      version: map.app_ios_min_version || '',
      build: Number.isFinite(build) ? build : 0,
      storeUrl: map.app_store_url || '',
    };
  } catch {
    return empty;
  }
}

/** Fail-open if the store or settings cannot be reached. Block only when a newer copy is known. */
export async function checkAppStoreGate(): Promise<AppStoreGateResult> {
  const localVersion = localAppVersion();
  const localBuild = localAppBuild();
  const [store, remote] = await Promise.all([fetchStoreListing(), fetchRemoteMinimum()]);
  const storeUrl = remote.storeUrl || store?.storeUrl || FALLBACK_STORE_URL;

  if (store?.version && localVersion && compareVersions(localVersion, store.version) < 0) {
    return { required: true, storeUrl };
  }
  if (remote.version && localVersion && compareVersions(localVersion, remote.version) < 0) {
    return { required: true, storeUrl };
  }
  if (remote.build > 0 && localBuild > 0 && localBuild < remote.build) {
    return { required: true, storeUrl };
  }
  return { required: false, storeUrl };
}
