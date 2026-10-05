import {
  FINJAL_DURATION_CHOICES,
  type EventFamily,
  findMobileEventType,
} from './eventRequestMessage';

export type OccasionDraft = {
  typeKey: string;
  family: EventFamily;
  person: string;
  hours: number | null;
};

const HOUR_WORDS: Array<[RegExp, number]> = [
  [/ساعتين|ساعتان|ساعتي/, 2],
  [/ثلاث(?:ة|ه)?/, 3],
  [/اربع(?:ة|ه)?/, 4],
  [/ست(?:ة|ه)?/, 6],
  [/ثمان(?:ي|ية|يه)?/, 8],
  [/اثنت(?:ا|ي)\s*عشر(?:ة|ه)?|ثنت(?:ا|ي)\s*عشر(?:ة|ه)?/, 12],
];

function normalizeDraft(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function nearestHours(value: number) {
  let best: number = FINJAL_DURATION_CHOICES[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const choice of FINJAL_DURATION_CHOICES) {
    const gap = Math.abs(choice - value);
    if (gap < distance) {
      distance = gap;
      best = choice;
    }
  }
  return best;
}

function hoursFrom(text: string) {
  const digit = text.match(/(\d+)\s*ساع/);
  if (digit) return nearestHours(Number(digit[1]));
  for (const [pattern, hours] of HOUR_WORDS) {
    if (pattern.test(text)) return nearestHours(hours);
  }
  return null;
}

function personFrom(raw: string) {
  const match = String(raw || '').match(
    /عند\s+(.+?)(?=\s*(?:,|،|لمده|لمدة|\d+\s*ساع|[٠-٩]+\s*ساع|ساعتين|ثلاث|اربع|أربع|ست|ثمان)|$)/,
  );
  return String(match?.[1] || '')
    .replace(/[،,].*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function typeKeyFrom(text: string) {
  if (/فنجال|فنجان/.test(text)) {
    if (/عشاه|العشاه|العشا/.test(text)) return 'finjal_isha';
    if (/عصر/.test(text)) return 'finjal_asr';
    return 'finjal_hawlna';
  }
  if (/وفاه|عزاه|تعزيه/.test(text)) return 'death';
  if (/زواج|عرس/.test(text)) return /حفل/.test(text) ? 'wedding' : 'marriage';
  if (/مولود|ولاده/.test(text)) return 'birth';
  if (/مريض|عمليه/.test(text)) return /عمليه/.test(text) ? 'operation' : 'sick';
  if (/شفاء|سلامه/.test(text)) return 'healing';
  return '';
}

/** يعبّي النموذج من جملة. ما ينشر. */
export function parseOccasionDraft(raw: string): OccasionDraft | null {
  const text = normalizeDraft(raw);
  if (text.length < 3) return null;
  const typeKey = typeKeyFrom(text);
  if (!typeKey) return null;
  const type = findMobileEventType(typeKey);
  return {
    typeKey: type.key,
    family: type.family,
    person: personFrom(raw),
    hours: type.key.startsWith('finjal_') ? hoursFrom(text) : null,
  };
}
