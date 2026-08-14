/**
 * Unified phone handling for the Alzidan mobile app.
 * Storage: E.164 with leading + (e.g. +9665XXXXXXXX, +9647XXXXXXXXX).
 * UI: country dial code is chosen separately; user types national number only.
 * No schema change — text columns already accept international strings.
 */

export type PhoneCountry = {
  id: string;
  nameAr: string;
  flag: string;
  dial: string; // digits only, e.g. 966
  /** National length without country code / leading 0 */
  nationalLength: number;
  /** Allowed first digits of national number */
  nationalPrefix: RegExp;
  placeholder: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  {
    id: 'SA',
    nameAr: 'السعودية',
    flag: '🇸🇦',
    dial: '966',
    nationalLength: 9,
    nationalPrefix: /^5/,
    placeholder: '5XXXXXXXX',
  },
  {
    id: 'IQ',
    nameAr: 'العراق',
    flag: '🇮🇶',
    dial: '964',
    nationalLength: 10,
    nationalPrefix: /^7/,
    placeholder: '7XXXXXXXXX',
  },
  {
    id: 'AE',
    nameAr: 'الإمارات',
    flag: '🇦🇪',
    dial: '971',
    nationalLength: 9,
    nationalPrefix: /^5/,
    placeholder: '5XXXXXXXX',
  },
  {
    id: 'KW',
    nameAr: 'الكويت',
    flag: '🇰🇼',
    dial: '965',
    nationalLength: 8,
    nationalPrefix: /^[569]/,
    placeholder: 'XXXXXXXX',
  },
  {
    id: 'BH',
    nameAr: 'البحرين',
    flag: '🇧🇭',
    dial: '973',
    nationalLength: 8,
    nationalPrefix: /^[36]/,
    placeholder: 'XXXXXXXX',
  },
  {
    id: 'OM',
    nameAr: 'عُمان',
    flag: '🇴🇲',
    dial: '968',
    nationalLength: 8,
    nationalPrefix: /^[79]/,
    placeholder: 'XXXXXXXX',
  },
  {
    id: 'JO',
    nameAr: 'الأردن',
    flag: '🇯🇴',
    dial: '962',
    nationalLength: 9,
    nationalPrefix: /^7/,
    placeholder: '7XXXXXXXX',
  },
  {
    id: 'EG',
    nameAr: 'مصر',
    flag: '🇪🇬',
    dial: '20',
    nationalLength: 10,
    nationalPrefix: /^1/,
    placeholder: '1XXXXXXXXX',
  },
];

export const DEFAULT_PHONE_COUNTRY_ID = 'SA';

function easternToWesternDigits(value: string) {
  const arabicZero = '٠'.charCodeAt(0);
  const persianZero = '۰'.charCodeAt(0);
  return String(value || '').replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const normalized = code >= persianZero ? code - persianZero : code - arabicZero;
    return String(normalized);
  });
}

export function digitsOnly(value: string) {
  return easternToWesternDigits(value).replace(/\D/g, '');
}

export function getPhoneCountry(id?: string | null) {
  return PHONE_COUNTRIES.find((c) => c.id === id) || PHONE_COUNTRIES[0];
}

/** Strip leading 0 from national input (common habit). */
export function normalizeNationalInput(raw: string, countryId?: string) {
  let national = digitsOnly(raw);
  const country = getPhoneCountry(countryId);
  // If user pasted full international, peel dial code
  if (national.startsWith(country.dial) && national.length > country.nationalLength) {
    national = national.slice(country.dial.length);
  }
  if (national.startsWith('00' + country.dial)) {
    national = national.slice(2 + country.dial.length);
  }
  if (national.startsWith('0')) national = national.replace(/^0+/, '');
  if (national.length > country.nationalLength) {
    national = national.slice(0, country.nationalLength);
  }
  return national;
}

export function isValidNational(countryId: string, nationalRaw: string) {
  const country = getPhoneCountry(countryId);
  const national = normalizeNationalInput(nationalRaw, countryId);
  if (national.length !== country.nationalLength) return false;
  return country.nationalPrefix.test(national);
}

/** Canonical storage: +<dial><national> */
export function toE164(countryId: string, nationalRaw: string) {
  const country = getPhoneCountry(countryId);
  const national = normalizeNationalInput(nationalRaw, countryId);
  if (!national) return '';
  return `+${country.dial}${national}`;
}

export function e164Digits(e164OrAny: string) {
  return digitsOnly(e164OrAny);
}

/**
 * Parse any stored/legacy phone into country + national for the UI.
 * Supports SA 05… / 5… / 966… and IQ 07… / 7… / 964…
 */
export function parsePhoneToParts(raw: string): { countryId: string; national: string } {
  const digits = digitsOnly(raw);
  if (!digits) return { countryId: DEFAULT_PHONE_COUNTRY_ID, national: '' };

  // Longest dial match first
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of sorted) {
    if (digits.startsWith(country.dial)) {
      const national = digits.slice(country.dial.length).replace(/^0+/, '');
      return { countryId: country.id, national: national.slice(0, country.nationalLength) };
    }
    if (digits.startsWith('00' + country.dial)) {
      const national = digits.slice(2 + country.dial.length).replace(/^0+/, '');
      return { countryId: country.id, national: national.slice(0, country.nationalLength) };
    }
  }

  // Legacy KSA local 05XXXXXXXX / 5XXXXXXXX
  if (digits.length === 10 && digits.startsWith('05')) {
    return { countryId: 'SA', national: digits.slice(1) };
  }
  if (digits.length === 9 && digits.startsWith('5')) {
    return { countryId: 'SA', national: digits };
  }

  // Legacy Iraq local 07XXXXXXXXX / 7XXXXXXXXX
  if (digits.length === 11 && digits.startsWith('07')) {
    return { countryId: 'IQ', national: digits.slice(1) };
  }
  if (digits.length === 10 && digits.startsWith('7')) {
    return { countryId: 'IQ', national: digits };
  }

  return { countryId: DEFAULT_PHONE_COUNTRY_ID, national: digits.slice(0, 9) };
}

/** Normalize any input to canonical E.164 when possible. */
export function canonicalizePhone(raw: string, fallbackCountryId = DEFAULT_PHONE_COUNTRY_ID) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const parts = parsePhoneToParts(trimmed);
  const countryId = parts.national ? parts.countryId : fallbackCountryId;
  if (!isValidNational(countryId, parts.national)) {
    // Still return best-effort E.164 for lookup candidates
    const national = normalizeNationalInput(parts.national, countryId);
    if (!national) return '';
    return toE164(countryId, national);
  }
  return toE164(countryId, parts.national);
}

export function formatPhoneDisplay(raw: string) {
  const e164 = canonicalizePhone(raw);
  if (!e164) return String(raw || '').trim();
  const parts = parsePhoneToParts(e164);
  const country = getPhoneCountry(parts.countryId);
  return `${country.flag} +${country.dial} ${parts.national}`.trim();
}

/**
 * Candidates for DB lookup (legacy 05… plus E.164 forms).
 * Keeps login working for numbers stored as 05… or +966…
 */
export function phoneLookupCandidates(raw: string) {
  const out = new Set<string>();
  const e164 = canonicalizePhone(raw);
  const digits = e164Digits(e164 || raw);
  const parts = parsePhoneToParts(raw || e164);

  if (e164) out.add(e164);
  if (digits) out.add(digits);

  if (parts.countryId === 'SA' && parts.national.length === 9) {
    out.add('0' + parts.national);
    out.add(parts.national);
    out.add('966' + parts.national);
    out.add('+966' + parts.national);
  }
  if (parts.countryId === 'IQ' && parts.national.length === 10) {
    out.add('0' + parts.national);
    out.add(parts.national);
    out.add('964' + parts.national);
    out.add('+964' + parts.national);
  }

  // Always include raw digits variants
  const rawDigits = digitsOnly(raw);
  if (rawDigits) out.add(rawDigits);

  return [...out].filter(Boolean);
}

export function memberProfilePhoneQuery(phone: string) {
  const candidates = phoneLookupCandidates(phone);
  if (!candidates.length) return '';
  const or = candidates.map((item) => `phone.eq.${encodeURIComponent(item)}`).join(',');
  return `member_profiles?select=id,phone,branch_key,tree_child_id,person_id,display_name,status&or=(${or})&status=eq.active&limit=1`;
}

/** True when country + national form a complete valid mobile number. */
export function isValidPhone(countryId: string, nationalRaw: string) {
  return isValidNational(countryId, nationalRaw);
}

/** Validate any stored/typed phone (legacy or E.164). */
export function isValidStoredPhone(raw: string) {
  const parts = parsePhoneToParts(raw);
  return isValidNational(parts.countryId, parts.national);
}

/** Canonical clean for storage / RPC — always E.164 when parseable. */
export function cleanMemberPhone(value: string) {
  return canonicalizePhone(value);
}
