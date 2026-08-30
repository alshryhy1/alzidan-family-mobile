import { selectPublicRows } from './supabase';

const KEYS = {
  sadaqahUrl: 'sadaqah_jariyah_url',
  sadaqahEnabled: 'sadaqah_jariyah_enabled',
  supportEnabled: 'site_support_enabled',
  supportAmounts: 'site_support_amounts',
  supportAllowCustom: 'site_support_allow_custom',
} as const;

const DEFAULT_AMOUNTS = [10, 25, 50, 100];
const SUPPORT_RETURN_URL = 'https://alzidan.org/pages/index.html?support_return=1#giving';

export type GivingSettings = {
  sadaqahUrl: string;
  sadaqahEnabled: boolean;
  supportEnabled: boolean;
  supportAmounts: number[];
  supportAllowCustom: boolean;
};

type SettingRow = { key: string; value: string | null };

function isEnabledFlag(value: unknown) {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export function isHttpsUrl(value: string) {
  const s = String(value || '').trim();
  if (!s) return false;
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseAmounts(raw: string | null | undefined) {
  const parts = String(raw ?? '')
    .split(/[,|\s]+/)
    .map((p) => Math.round(Number(String(p).trim())))
    .filter((n) => Number.isFinite(n) && n > 0);
  const seen = new Set<number>();
  const out: number[] = [];
  parts.forEach((n) => {
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  out.sort((a, b) => a - b);
  return out.length ? out : DEFAULT_AMOUNTS.slice();
}

export async function fetchGivingSettings(): Promise<GivingSettings> {
  const keys = Object.values(KEYS);
  const rows = await selectPublicRows<SettingRow>(
    `site_settings?select=key,value&key=in.(${keys.join(',')})`,
  );
  const map: Record<string, string> = {};
  rows.forEach((row) => {
    if (!row?.key) return;
    map[String(row.key)] = row.value == null ? '' : String(row.value);
  });
  const allowCustom =
    map[KEYS.supportAllowCustom] == null || map[KEYS.supportAllowCustom] === ''
      ? true
      : isEnabledFlag(map[KEYS.supportAllowCustom]);
  return {
    sadaqahUrl: String(map[KEYS.sadaqahUrl] || '').trim(),
    sadaqahEnabled: isEnabledFlag(map[KEYS.sadaqahEnabled]),
    supportEnabled: isEnabledFlag(map[KEYS.supportEnabled]),
    supportAmounts: parseAmounts(map[KEYS.supportAmounts]),
    supportAllowCustom: allowCustom,
  };
}

export function canOpenEhsan(settings: GivingSettings | null) {
  return !!(settings && settings.sadaqahEnabled && isHttpsUrl(settings.sadaqahUrl));
}

export function canOpenPlatform(settings: GivingSettings | null) {
  return !!(settings && settings.supportEnabled);
}

type IntentionOk = {
  ok: true;
  checkout_url?: string;
  client_secret?: string;
  public_key?: string;
  intention_id?: string;
};

type IntentionErr = {
  ok?: false;
  error?: string;
};

export async function startSiteSupportPayment(amount: number) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('تعذر إتمام الدفع الآن. حاول مرة أخرى.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/alzidan-paymob-intention`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'SAR',
      redirection_url: SUPPORT_RETURN_URL,
    }),
  });

  const text = await response.text();
  let data: IntentionOk | IntentionErr | null = null;
  try {
    data = text ? (JSON.parse(text) as IntentionOk | IntentionErr) : null;
  } catch {
    data = null;
  }

  if (!data || data.ok !== true) {
    const err = data && 'error' in data ? String(data.error || '') : '';
    if (err === 'support_disabled') throw new Error('دعم المنصة غير مفعّل حاليًا.');
    if (err === 'invalid_amount') throw new Error('المبلغ غير مسموح. اختر مبلغًا من القائمة أو اكتب مبلغًا آخر.');
    throw new Error('تعذر إنشاء الدفع. حاول مرة أخرى.');
  }

  let checkout = String(data.checkout_url || '').trim();
  if (!checkout && data.client_secret) {
    const pk = String(data.public_key || '').trim();
    const qs = [`clientSecret=${encodeURIComponent(String(data.client_secret))}`];
    if (pk && !pk.startsWith('sau_sk_')) {
      qs.unshift(`publicKey=${encodeURIComponent(pk)}`);
    }
    checkout = `https://ksa.paymob.com/unifiedcheckout/?${qs.join('&')}`;
  }
  if (!checkout) throw new Error('تعذر فتح صفحة الدفع.');
  return checkout;
}
