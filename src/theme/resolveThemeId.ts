import type { ThemeId } from '../theme';

/**
 * ThemeResolver — gender of the account-linked person only.
 * Do not import personVisibility / isPublicLineageHiddenPerson.
 * Matches tree_child_normalize_gender aliases, then fail closed to heritage.
 *
 * isVerifiedFemaleAccount is the same gender test (not a visibility rule).
 * Occasion outreach UI uses it independently of theme tokens.
 */
const DAUGHTER = new Set([
  'daughter',
  'female',
  'f',
  'أنثى',
  'انثى',
  'ابنة',
  'بنت',
]);

export function isVerifiedFemaleAccount(gender: string | null | undefined): boolean {
  const g = String(gender || '')
    .trim()
    .toLowerCase();
  return Boolean(g) && DAUGHTER.has(g);
}

export function resolveThemeId(gender: string | null | undefined): ThemeId {
  return isVerifiedFemaleAccount(gender) ? 'feminine' : 'heritage';
}

/** Outreach UI (greetings, WhatsApp, add occasion, send memory). Visitor / son / unset stay on. */
export function canUseOccasionSocial(gender: string | null | undefined): boolean {
  return !isVerifiedFemaleAccount(gender);
}
