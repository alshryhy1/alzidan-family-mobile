import moment from 'moment-hijri';

import type { TreeChild } from '../types';
import { isPublicLineageHiddenPerson } from './personVisibility';
import { resolveProvenKinshipLabel } from './personEncounter';

export type RemembranceKind = 'birth' | 'death';

export type TodayRemembrance = {
  personId: number;
  name: string;
  given: string;
  branchKey: string;
  kind: RemembranceKind;
  title: string;
  subtitle: string;
  phrase: string;
};

export type HijriDay = {
  year: number;
  month: number;
  day: number;
  key: string;
};

function normalizeDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

export function parseHijriMonthDay(value: string | null | undefined) {
  const raw = normalizeDigits(String(value || ''))
    .trim()
    .replace(/[.\-]/g, '/')
    .replace(/\s+/g, '');
  const parts = raw.split('/').filter(Boolean).map((part) => Number(part));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const yearFirst = parts[0] >= 1300 && parts[0] < 1600;
  const yearLast = parts[2] >= 1300 && parts[2] < 1600;
  const month = yearFirst ? parts[1] : yearLast ? parts[1] : 0;
  const day = yearFirst ? parts[2] : yearLast ? parts[0] : 0;
  if (!yearFirst && !yearLast) return null;
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  return { month, day };
}

/** Hijri calendar day in Riyadh, matching the widget. */
export function hijriToday(now = new Date()): HijriDay {
  const m = moment(now).utcOffset(180);
  const year = m.iYear();
  const month = m.iMonth() + 1;
  const day = m.iDate();
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, key };
}

function givenName(name: string) {
  const token = String(name || '').trim().split(/\s+/).filter(Boolean)[0] || '';
  return token || 'قريب';
}

function hasDeathDate(person: TreeChild) {
  return Boolean(String(person.deathDateHijri || person.deathDateGregorian || '').trim()) || person.isDeceased === true;
}

export function listTodayRemembrances(input: {
  people: TreeChild[];
  viewer?: TreeChild | null;
  maternalById?: Record<number, string>;
  now?: Date;
  limit?: number;
}): TodayRemembrance[] {
  const today = hijriToday(input.now);
  const viewer = input.viewer || null;
  const branch = String(viewer?.branchKey || '').trim();
  const limit = input.limit ?? 4;
  const rows: Array<TodayRemembrance & { rank: number }> = [];

  for (const person of input.people) {
    if (!person || !Number(person.id)) continue;
    if (isPublicLineageHiddenPerson(person)) continue;
    const name = String(person.name || '').trim();
    if (!name) continue;
    const given = givenName(name);
    const self = Boolean(viewer && Number(viewer.id) === Number(person.id));
    const death = parseHijriMonthDay(person.deathDateHijri);
    const birth = parseHijriMonthDay(person.birthDateHijri);
    const deathToday = Boolean(death && death.month === today.month && death.day === today.day);
    const birthToday = Boolean(
      !hasDeathDate(person) && birth && birth.month === today.month && birth.day === today.day,
    );
    const kind: RemembranceKind | null = deathToday ? 'death' : birthToday ? 'birth' : null;
    if (!kind || (kind === 'death' && self)) continue;

    const maternal = input.maternalById ? String(input.maternalById[Number(person.id)] || '').trim() : '';
    const kin = self ? '' : resolveProvenKinshipLabel(viewer, person, maternal || null, input.people) || '';
    const who = kin ? `${kin} ${given}` : given;
    const sameBranch = Boolean(branch && person.branchKey && person.branchKey === branch);
    rows.push({
      personId: Number(person.id),
      name,
      given,
      branchKey: String(person.branchKey || ''),
      kind,
      title: kind === 'death' ? `ذكرى وفاة ${who}` : self ? 'اليوم ميلادك' : `اليوم ميلاد ${who}`,
      subtitle: kin || self ? '' : sameBranch ? 'من فرعك' : '',
      phrase: kind === 'death' ? 'اللهم ارحمه' : 'مبروك',
      rank: (kind === 'death' ? 0 : 2) + (self ? -1 : 0) + (sameBranch ? 0 : 1),
    });
  }

  rows.sort((a, b) => a.rank - b.rank || a.given.localeCompare(b.given, 'ar'));
  return rows.slice(0, limit).map(({ rank: _rank, ...row }) => row);
}
