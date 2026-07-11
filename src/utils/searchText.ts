export function normalizeArabicDigits(value: string) {
  const arabicZero = '٠'.charCodeAt(0);
  const persianZero = '۰'.charCodeAt(0);
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const normalized = code >= persianZero ? code - persianZero : code - arabicZero;
    return String(normalized);
  });
}

export function normalizeSearchText(value: unknown) {
  return normalizeArabicDigits(String(value || ''))
    .replace(/\u0640/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function matchesSearchQuery(haystackParts: Array<unknown>, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (normalizedQuery.length < 2) return false;

  const haystack = haystackParts.map((part) => normalizeSearchText(part)).join(' ');
  return haystack.includes(normalizedQuery);
}
