import { arabicNorm, leafPersonName } from './personEncounter';

export function namesLikelyMatch(left: string, right: string) {
  const a = arabicNorm(leafPersonName(left));
  const b = arabicNorm(leafPersonName(right));
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function tokenOverlapScore(needles: string[], haystack: string) {
  const normalized = arabicNorm(haystack);
  if (!normalized) return 0;
  let score = 0;
  for (const token of needles) {
    if (!token) continue;
    if (normalized.includes(token)) score += 1;
  }
  return score;
}

export function pickRequestBindTarget<T extends { displayName: string; path?: string | null }>(
  query: string,
  requestName: string,
  matches: T[],
): T | null {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  const fullNeedle = arabicNorm(query.trim() || requestName);
  const tokens = (query.trim() || requestName)
    .split(/\s+/)
    .map((part) => arabicNorm(part))
    .filter((part) => part.length >= 2);

  const exact = matches.filter((person) => {
    const display = arabicNorm(person.displayName);
    const pathLeaf = arabicNorm(leafPersonName(person.path || ''));
    const pathFull = arabicNorm(person.path || '');
    return (
      display === fullNeedle ||
      pathLeaf === fullNeedle ||
      pathFull === fullNeedle ||
      namesLikelyMatch(person.displayName, requestName) ||
      namesLikelyMatch(person.path || '', requestName)
    );
  });

  if (exact.length === 1) return exact[0];

  const scored = matches
    .map((person) => {
      const displayScore = tokenOverlapScore(tokens, person.displayName);
      const pathScore = tokenOverlapScore(tokens, person.path || '');
      return { person, score: Math.max(displayScore, pathScore) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  if (scored.length === 1) return scored[0].person;
  if (scored[0].score > scored[1].score) return scored[0].person;
  return null;
}
