import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment-hijri';
import { selectPublicRows } from './supabase';

export type SpecialCardType =
  | 'wedding'
  | 'graduation'
  | 'birth'
  | 'promotion'
  | 'new_house'
  | 'honor'
  | 'announcement';

export type SpecialCard = {
  id: number;
  type: SpecialCardType;
  title: string;
  subtitle: string | null;
  person_name: string;
  secondary_person: string | null;
  degree_name: string | null;
  university: string | null;
  event_date: string | null;
  location: string | null;
  message: string | null;
  image_url: string | null;
  background_url: string | null;
  theme: string | null;
  button_text: string | null;
  button_link: string | null;
  priority: number | null;
  display_seconds: number | null;
  show_once_per_day: boolean | null;
  allow_share: boolean | null;
  allow_save: boolean | null;
  audio_url: string | null;
  template_key: string | null;
  start_date?: string | null;
  end_date?: string | null;
  display_mode?: string | null;
  max_per_session?: number | null;
  sequence_order?: number | null;
};

function localTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function storageKey(cardId: number) {
  return `special_card_seen_${cardId}_${localTodayKey()}`;
}

function isGregorianDateKey(value: string) {
  return /^(19|20)\d{2}-\d{2}-\d{2}$/.test(value);
}

function eventDateToGregorianKey(value?: string | null) {
  const raw = String(value || '')
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/\//g, '-');

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!iso) return '';

  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  if (!year || !month || !day) return '';

  let date: Date | null = null;
  if (year >= 1900 && year < 2100) {
    date = new Date(year, month - 1, day, 12, 0, 0, 0);
  } else if (year >= 1300 && year < 1900) {
    try {
      const converted = moment(`${year}/${month}/${day}`, 'iYYYY/iM/iD').toDate();
      if (converted instanceof Date && Number.isFinite(converted.getTime())) date = converted;
    } catch {
      date = null;
    }
  }

  if (!date || !Number.isFinite(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWithinSchedule(card: SpecialCard) {
  const today = localTodayKey();
  const start = String(card.start_date || '').trim();
  const end = String(card.end_date || '').trim();

  if (start && isGregorianDateKey(start) && today < start) return false;
  if (end && isGregorianDateKey(end) && today > end) return false;

  // بدون تاريخ نهاية: البطاقة تختفي بعد انتهاء يوم المناسبة
  if (!end) {
    const eventEnd = eventDateToGregorianKey(card.event_date);
    if (eventEnd && today > eventEnd) return false;
  }

  return true;
}

export async function markSpecialCardSeen(cardId: number) {
  await AsyncStorage.setItem(storageKey(cardId), '1');
}

export async function shouldShowSpecialCard(card: SpecialCard) {
  if (card.show_once_per_day === false) return true;

  try {
    const seen = await AsyncStorage.getItem(storageKey(card.id));
    return seen !== '1';
  } catch {
    return true;
  }
}

export async function fetchPendingSpecialCards() {
  const rows = await selectPublicRows<SpecialCard>(
    'special_cards?select=*&is_active=eq.true&order=priority.desc,sequence_order.asc,created_at.desc&limit=20',
  );

  const pending: SpecialCard[] = [];
  let sessionLimit = 1;

  for (const card of rows) {
    if (!isWithinSchedule(card)) continue;
    if (!(await shouldShowSpecialCard(card))) continue;

    pending.push(card);
    sessionLimit = Math.max(sessionLimit, Number(card.max_per_session) || 1);
  }

  return pending.slice(0, sessionLimit);
}

export async function fetchActiveSpecialCard() {
  const cards = await fetchPendingSpecialCards();
  return cards[0] ?? null;
}

/** Active special cards for the home ticker (schedule only; ignore once-per-day modal seen flag). */
export async function fetchActiveSpecialCardsForTicker() {
  const rows = await selectPublicRows<SpecialCard>(
    'special_cards?select=*&is_active=eq.true&order=priority.desc,sequence_order.asc,created_at.desc&limit=20',
  );
  return rows.filter(isWithinSchedule);
}

export function formatSpecialCardTickerItem(card: SpecialCard) {
  const parts = [card.title, card.person_name, card.subtitle].map((v) => String(v || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return parts.join(' — ');
}
