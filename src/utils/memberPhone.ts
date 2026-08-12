export function cleanMemberPhone(value: string) {
  const arabicZero = '٠'.charCodeAt(0);
  const persianZero = '۰'.charCodeAt(0);
  const digits = value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      const normalized = code >= persianZero ? code - persianZero : code - arabicZero;
      return String(normalized);
    })
    .replace(/[^\d]/g, '');

  if (!digits) return '';
  let next = digits;
  if (next.startsWith('00966') && next.length >= 14) next = '0' + next.slice(5);
  else if (next.startsWith('966') && next.length >= 12) next = '0' + next.slice(3);
  if (next.length === 9 && next.startsWith('5')) next = '0' + next;
  return next.length === 10 && next.startsWith('05') ? next : digits;
}

export function memberPhoneCandidates(value: string) {
  const cleaned = cleanMemberPhone(value);
  const out = new Set<string>();
  if (cleaned) out.add(cleaned);
  const raw = value.replace(/[^\d]/g, '');
  if (raw) out.add(raw);
  if (cleaned.length === 10 && cleaned.startsWith('05')) {
    out.add(cleaned.slice(1));
    out.add('966' + cleaned.slice(1));
  }
  return [...out].filter(Boolean);
}

export function memberProfilePhoneQuery(phone: string) {
  const candidates = memberPhoneCandidates(phone);
  if (!candidates.length) return '';
  const or = candidates.map((item) => `phone.eq.${encodeURIComponent(item)}`).join(',');
  return `member_profiles?select=id,phone,branch_key,tree_child_id,person_id,display_name,status&or=(${or})&status=eq.active&limit=1`;
}
