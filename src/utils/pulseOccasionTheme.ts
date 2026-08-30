import type { PulseSeasonId } from './pulseSeason';

export type OccasionMotif =
  | 'national_flag'
  | 'founding'
  | 'ramadan'
  | 'eid'
  | 'hajj'
  | 'school'
  | 'plain';

export type OccasionTheme = {
  motif: OccasionMotif;
  from: string;
  to: string;
  text: string;
  muted: string;
};

export function occasionMotif(id?: PulseSeasonId | null): OccasionMotif {
  if (id === 'national') return 'national_flag';
  if (id === 'founding') return 'founding';
  if (id === 'ramadan') return 'ramadan';
  if (id === 'eid_fitr' || id === 'eid_adha') return 'eid';
  if (id === 'hajj_ten') return 'hajj';
  if (id === 'school_start') return 'school';
  return 'plain';
}

export function occasionMark(motif: OccasionMotif) {
  if (motif === 'national_flag') return '🇸🇦';
  if (motif === 'founding') return '🇸🇦';
  if (motif === 'ramadan') return '🌙';
  if (motif === 'eid') return '🕯️';
  if (motif === 'hajj') return '🕋';
  if (motif === 'school') return '📖';
  return '';
}

export function resolveOccasionTheme(id?: PulseSeasonId | null): OccasionTheme {
  const motif = occasionMotif(id);
  if (motif === 'national_flag') {
    return { motif, from: '#006C35', to: '#004C28', text: '#FFF8EC', muted: 'rgba(255,248,236,0.82)' };
  }
  if (motif === 'founding') {
    return { motif, from: '#6B4F32', to: '#1F4F44', text: '#FFF8EC', muted: 'rgba(232,213,168,0.86)' };
  }
  if (motif === 'ramadan') {
    return { motif, from: '#0B1430', to: '#1C2754', text: '#F3EBD9', muted: 'rgba(232,213,168,0.86)' };
  }
  if (motif === 'eid') {
    return { motif, from: '#7A3B12', to: '#C4A35A', text: '#FFF8EC', muted: 'rgba(255,248,236,0.86)' };
  }
  if (motif === 'hajj') {
    return { motif, from: '#1E1A16', to: '#5A4A32', text: '#F3EBD9', muted: 'rgba(232,213,168,0.86)' };
  }
  if (motif === 'school') {
    return { motif, from: '#1F4F44', to: '#4F7187', text: '#FFF8EC', muted: 'rgba(255,248,236,0.84)' };
  }
  return { motif, from: '#FFF8EC', to: '#EDE3C9', text: '#173F35', muted: '#66736E' };
}
