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
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(cardId: number) {
  return `special_card_seen_${cardId}_${todayKey()}`;
}

export async function markSpecialCardSeen(cardId: number) {
  await AsyncStorage.setItem(storageKey(cardId), '1');
}

export async function shouldShowSpecialCard(card: SpecialCard) {
  if (card.show_once_per_day === false) return true;
  const seen = await AsyncStorage.getItem(storageKey(card.id));
  return seen !== '1';
}

export async function fetchActiveSpecialCard() {
  const rows = await selectPublicRows<SpecialCard>(
    'special_cards?select=*&is_active=eq.true&order=priority.desc,created_at.desc&limit=1',
  );

  const card = rows[0] ?? null;
  if (!card) return null;

  const canShow = await shouldShowSpecialCard(card);
  return canShow ? card : null;
}
