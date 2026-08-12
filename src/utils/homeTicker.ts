/**
 * بناء شريط أخبار الرئيسية بأولوية موحّدة:
 * 1) وفاة  2) مناسبات عائلية مهمة  3) أخبار عامة  4) بطاقات خاصة
 *
 * ملاحظة: لا يوجد expo-updates / قنوات OTA — أي إصلاح للشريط يصل للمتجر فقط ببناء جديد.
 */
import type { FamilyEvent } from '../types';
import { isDeathEventType } from './eventVisibility';

export type HomeTickerSources = {
  events?: FamilyEvent[];
  bannerMessages?: string[];
  specialCardTickerItems?: string[];
  /** حد مناسبات العائلة في الشريط (بعد الوفاة). */
  maxFamilyEvents?: number;
};

export type HomeTickerBuildResult = {
  items: string[];
  meta: {
    deathCount: number;
    familyCount: number;
    bannerCount: number;
    specialCardCount: number;
    beforeFilter: number;
    afterFilter: number;
  };
};

function normalizeTickerText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function formatEventTickerItem(event: FamilyEvent) {
  // Keep full wording for the marquee; do not soft-truncate mid-word.
  const detail = String(event.details || '').replace(/\s+/g, ' ').trim();
  return [event.title, event.person, detail, event.date ? `— ${event.date}` : '']
    .filter(Boolean)
    .join(' — ');
}

function createdAtMs(event: FamilyEvent) {
  const parsed = Date.parse(String(event.createdAt || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** مناسبات عائلية مهمة = كل family_events الظاهرة ما عدا الوفاة (الصحة + الأفراح). */
export function isImportantFamilyEvent(event: FamilyEvent) {
  return !isDeathEventType(event);
}

/**
 * يرتّب مرشّحي الشريط: وفاة → مناسبات → أخبار عامة → بطاقات خاصة.
 * يضمن إدراج كل وفيات النافذة النشطة قبل قصّ الحدّ على باقي المناسبات.
 */
export function buildHomeTickerItems(sources: HomeTickerSources): HomeTickerBuildResult {
  const maxFamilyEvents = Math.max(1, Number(sources.maxFamilyEvents ?? 6));
  const events = Array.isArray(sources.events) ? sources.events : [];
  const banners = (sources.bannerMessages || []).map(normalizeTickerText).filter(Boolean);
  const specialCards = (sources.specialCardTickerItems || []).map(normalizeTickerText).filter(Boolean);

  const deaths = events
    .filter((event) => isDeathEventType(event))
    .sort((a, b) => createdAtMs(b) - createdAtMs(a));
  const important = events
    .filter((event) => isImportantFamilyEvent(event))
    .sort((a, b) => createdAtMs(b) - createdAtMs(a));

  const familyBudget = Math.max(0, maxFamilyEvents - deaths.length);
  const selectedFamily = [...deaths, ...important.slice(0, familyBudget)];

  const deathItems = deaths.map(formatEventTickerItem).map(normalizeTickerText).filter(Boolean);
  const familyItems = selectedFamily
    .filter((event) => !isDeathEventType(event))
    .map(formatEventTickerItem)
    .map(normalizeTickerText)
    .filter(Boolean);

  const beforeFilter =
    deathItems.length + familyItems.length + banners.length + specialCards.length;

  // الأولوية الملزمة: وفاة → مناسبات → عام → بطاقات
  const items = [...deathItems, ...familyItems, ...banners, ...specialCards].filter(Boolean);

  return {
    items,
    meta: {
      deathCount: deathItems.length,
      familyCount: familyItems.length,
      bannerCount: banners.length,
      specialCardCount: specialCards.length,
      beforeFilter,
      afterFilter: items.length,
    },
  };
}

export function logHomeTickerCandidates(
  label: string,
  result: HomeTickerBuildResult,
  extra?: Record<string, unknown>,
) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log(`[homeTicker:${label}]`, {
    ...result.meta,
    preview: result.items.slice(0, 4),
    ...extra,
  });
}
