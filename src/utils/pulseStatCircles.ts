/**
 * Compact Pulse percentage circles for affinity + work status.
 */

import { workStatusPercent } from './treeStats';
import type { PulseAffinitySnap } from './pulseAffinity';

export type PulseStatCircle = {
  key: string;
  label: string;
  percent: number;
};

function pctOf(count: number, total: number) {
  if (!total || count <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function pulseAffinityCircles(
  snap: PulseAffinitySnap | null | undefined,
): PulseStatCircle[] {
  if (!snap || snap.total <= 0) return [];
  return [
    { key: 'inside', label: 'داخل', percent: pctOf(snap.insideCount, snap.total) },
    { key: 'outside', label: 'خارج', percent: pctOf(snap.outsideCount, snap.total) },
  ];
}

export type PulseWorkSnap = {
  living: number;
  employed: number;
  retired: number;
  unemployed: number;
};

export function pulseWorkSnap(
  stats:
    | {
        living?: unknown;
        employed?: unknown;
        retired?: unknown;
        unemployed?: unknown;
      }
    | null
    | undefined,
): PulseWorkSnap | null {
  if (!stats) return null;
  const living = Math.floor(Number(stats.living));
  const employed = Math.floor(Number(stats.employed));
  const retired = Math.floor(Number(stats.retired));
  const unemployed = Math.floor(Number(stats.unemployed));
  if (![living, employed, retired, unemployed].every((n) => Number.isFinite(n) && n >= 0)) {
    return null;
  }
  if (living <= 0) return null;
  if (employed + retired + unemployed <= 0) return null;
  return { living, employed, retired, unemployed };
}

export function pulseWorkCircles(snap: PulseWorkSnap | null | undefined): PulseStatCircle[] {
  if (!snap) return [];
  return [
    {
      key: 'employed',
      label: 'موظف',
      percent: workStatusPercent(snap.employed, snap.living),
    },
    {
      key: 'retired',
      label: 'متقاعد',
      percent: workStatusPercent(snap.retired, snap.living),
    },
    {
      key: 'unemployed',
      label: 'عاطل',
      percent: workStatusPercent(snap.unemployed, snap.living),
    },
  ];
}

export function pulseStatCirclesA11y(
  title: string,
  circles: PulseStatCircle[],
): string {
  if (!circles.length) return '';
  return `${title} · ${circles.map((c) => `${c.label} ${c.percent}٪`).join(' · ')}`;
}
