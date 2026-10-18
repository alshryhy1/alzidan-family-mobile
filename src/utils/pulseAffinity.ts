/**
 * Quiet Pulse line under presence: outside-family in-laws (مصاهرون).
 * Uses PublicAffinityStats.outsideCount from active spouse rows.
 */

export function pulseAffinityLine(outsideCount: number | null | undefined): string {
  if (outsideCount == null || !Number.isFinite(outsideCount) || outsideCount < 0) return '';
  const n = Math.floor(outsideCount);
  return `مصاهرون من خارج العائلة · ${n}`;
}
