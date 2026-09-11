import type { FamilyAdminPerson } from '../services/familyAdmin';

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function familyAdminSearchAttempts(query: string, requestName: string) {
  const full = query.trim() || requestName.trim();
  const parts = full
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  const leaf = full.includes('/') ? full.split('/').pop()?.trim() || '' : parts.at(-1) || '';
  const attempts: string[] = [full, leaf, ...parts, parts.slice(-2).join(' '), parts.slice(-3).join(' ')];

  if (parts.length >= 3) {
    attempts.push(parts[2], `${parts[0]} ${parts[2]}`, `${parts[1]} ${parts[2]}`);
  }
  if (parts.length >= 2) {
    attempts.push(parts[parts.length - 1], parts[0]);
  }

  return uniqueStrings(attempts);
}

export function mergeFamilyAdminPeople(rows: FamilyAdminPerson[]) {
  const seen = new Set<number>();
  const out: FamilyAdminPerson[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
