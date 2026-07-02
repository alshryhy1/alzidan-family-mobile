import AsyncStorage from '@react-native-async-storage/async-storage';
import { selectPublicRows } from './supabase';

export type SpecialCardType =
  | 'wedding'
  | 'graduation'
  | 'birth'
  | 'promotion'
  | 'new_house'
  | 'honor'
  | 'announcement'
  | 'engagement'
  | 'excellence'
  | 'retirement'
  | 'appreciation';

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
  group_key: string | null;
  group_title: string | null;
  sequence_order: number | null;
  max_per_session: number | null;
  display_mode: 'manual' | 'auto' | null;
  is_group_card: boolean | null;
  updated_at?: string | null;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(card: Pick<SpecialCard, 'id' | 'template_key' | 'updated_at' | 'audio_url'>) {
  const fingerprint = String(card.updated_at || card.template_key || card.audio_url || 'base')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40);
  return `special_card_seen_${card.id}_${todayKey()}_${fingerprint}`;
}

export async function markSpecialCardSeen(card: Pick<SpecialCard, 'id' | 'template_key' | 'updated_at' | 'audio_url'>) {
  await AsyncStorage.setItem(storageKey(card), '1');
}

export async function shouldShowSpecialCard(card: SpecialCard) {
  if (card.show_once_per_day === false) return true;
  const seen = await AsyncStorage.getItem(storageKey(card));
  return seen !== '1';
}

export async function fetchActiveSpecialCards() {
  const rows = await selectPublicRows<SpecialCard>(
    'special_cards?select=*&is_active=eq.true&order=priority.desc,sequence_order.asc,created_at.desc&limit=20',
  );

  const visibleCards: SpecialCard[] = [];

  for (const card of rows) {
    const canShow = await shouldShowSpecialCard(card);
    if (canShow) visibleCards.push(card);
  }

  return visibleCards;
}

export async function fetchActiveSpecialCard() {
  const cards = await fetchActiveSpecialCards();
  return cards[0] ?? null;
}
