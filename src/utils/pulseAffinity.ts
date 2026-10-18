/**
 * Quiet Pulse lines under presence — same meaning as web «نسب المصاهرة العامة».
 * Source: PublicAffinityStats from active spouse rows.
 */

export type PulseAffinitySnap = {
  total: number;
  insideCount: number;
  outsideCount: number;
};

function finiteCount(value: unknown): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Math.floor(Number(value));
  return n < 0 ? null : n;
}

export function pulseAffinitySnap(
  stats: { total?: unknown; insideCount?: unknown; outsideCount?: unknown } | null | undefined,
): PulseAffinitySnap | null {
  if (!stats) return null;
  const total = finiteCount(stats.total);
  const insideCount = finiteCount(stats.insideCount);
  const outsideCount = finiteCount(stats.outsideCount);
  if (total == null || insideCount == null || outsideCount == null) return null;
  if (total <= 0 && insideCount <= 0 && outsideCount <= 0) return null;
  return { total, insideCount, outsideCount };
}

/** Primary line: total active affinity records. */
export function pulseAffinityTotalLine(snap: PulseAffinitySnap | null | undefined): string {
  if (!snap) return '';
  return `مصاهرة · ${snap.total}`;
}

/** Secondary line: inside vs outside the family. */
export function pulseAffinitySplitLine(snap: PulseAffinitySnap | null | undefined): string {
  if (!snap) return '';
  return `داخل العائلة ${snap.insideCount} · خارجها ${snap.outsideCount}`;
}
