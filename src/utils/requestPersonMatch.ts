import { arabicNorm, leafPersonName } from './personEncounter';

export function namesLikelyMatch(left: string, right: string) {
  const a = arabicNorm(leafPersonName(left));
  const b = arabicNorm(leafPersonName(right));
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function pickRequestBindTarget<T extends { displayName: string; path?: string | null }>(
  query: string,
  requestName: string,
  matches: T[],
): T | null {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  const needle = arabicNorm(query.trim() || leafPersonName(requestName));
  if (!needle) return null;

  const exact = matches.filter((person) => {
    const display = arabicNorm(person.displayName);
    const pathLeaf = arabicNorm(leafPersonName(person.path || ''));
    return (
      display === needle ||
      pathLeaf === needle ||
      namesLikelyMatch(person.displayName, requestName) ||
      namesLikelyMatch(person.path || '', requestName)
    );
  });

  return exact.length === 1 ? exact[0] : null;
}
