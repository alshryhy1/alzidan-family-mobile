import AsyncStorage from '@react-native-async-storage/async-storage';
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

function isWithinSchedule(card: SpecialCard) {
  const today = localTodayKey();
  const start = String(card.start_date || '').trim();
  const end = String(card.end_date || '').trim();

  if (start && isGregorianDateKey(start) && today < start) return false;
  if (end && isGregorianDateKey(end) && today > end) return false;
  return true;
}

function isAutoDisplay(card: SpecialCard) {
  return String(card.display_mode || 'auto').trim() !== 'manual';
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
    if (!isAutoDisplay(card)) continue;
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
