export type ThemeId = 'heritage' | 'feminine';

export type ThemePalette = {
  themeId: ThemeId;
  heroDeep: string;
  heroMid: string;
  heroLift: string;
  cream: string;
  creamLift: string;
  gold: string;
  goldSoft: string;
  ink: string;
  tabActiveWash: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  border: string;
  happy: string;
  health: string;
  condolence: string;
  white: string;
  /** Scene aliases — heritage greens, feminine hero stack. */
  greenDeep: string;
  green: string;
  greenMid: string;
};

const SHARED = {
  cream: '#F3EBD9',
  creamLift: '#FFF8EC',
  gold: '#C4A35A',
  goldSoft: '#E8D5A8',
  ink: '#1E2925',
  border: '#DCCDB0',
  textMuted: '#66736E',
  surfaceMuted: '#EDE3C9',
  happy: '#A36A20',
  health: '#4F7187',
  condolence: '#5D5B67',
  white: '#FFFFFF',
} as const;

export const heritagePalette: ThemePalette = {
  themeId: 'heritage',
  heroDeep: '#0F2A24',
  heroMid: '#173F35',
  heroLift: '#1F4F44',
  cream: SHARED.cream,
  creamLift: SHARED.creamLift,
  gold: SHARED.gold,
  goldSoft: SHARED.goldSoft,
  ink: SHARED.ink,
  tabActiveWash: 'rgba(23,63,53,0.12)',
  background: SHARED.cream,
  surface: SHARED.creamLift,
  surfaceMuted: SHARED.surfaceMuted,
  primary: '#1F4F44',
  primaryDark: '#173F35',
  primarySoft: '#DCEBE4',
  accent: SHARED.gold,
  accentSoft: SHARED.goldSoft,
  text: SHARED.ink,
  textMuted: SHARED.textMuted,
  border: SHARED.border,
  happy: SHARED.happy,
  health: SHARED.health,
  condolence: SHARED.condolence,
  white: SHARED.white,
  greenDeep: '#0F2A24',
  green: '#173F35',
  greenMid: '#1F4F44',
};

export const femininePalette: ThemePalette = {
  themeId: 'feminine',
  heroDeep: '#44333C',
  heroMid: '#4A3740',
  heroLift: '#513D48',
  cream: SHARED.cream,
  creamLift: SHARED.creamLift,
  gold: SHARED.gold,
  goldSoft: SHARED.goldSoft,
  ink: SHARED.ink,
  tabActiveWash: '#E8E0E2',
  background: SHARED.cream,
  surface: SHARED.creamLift,
  surfaceMuted: SHARED.surfaceMuted,
  primary: '#4A3740',
  primaryDark: '#4A3740',
  primarySoft: SHARED.creamLift,
  accent: SHARED.gold,
  accentSoft: SHARED.goldSoft,
  text: SHARED.ink,
  textMuted: SHARED.textMuted,
  border: SHARED.border,
  happy: SHARED.happy,
  health: SHARED.health,
  condolence: SHARED.condolence,
  white: SHARED.white,
  greenDeep: '#44333C',
  green: '#4A3740',
  greenMid: '#513D48',
};

export const palettes: Record<ThemeId, ThemePalette> = {
  heritage: heritagePalette,
  feminine: femininePalette,
};

export function getPalette(themeId: ThemeId): ThemePalette {
  return palettes[themeId] || heritagePalette;
}

/** Legacy static exports — heritage only. Seasonal / leftover imports. Prefer useThemePalette(). */
export const colors = {
  background: heritagePalette.background,
  surface: heritagePalette.surface,
  surfaceMuted: heritagePalette.surfaceMuted,
  primary: heritagePalette.primary,
  primaryDark: heritagePalette.primaryDark,
  primarySoft: heritagePalette.primarySoft,
  accent: heritagePalette.accent,
  accentSoft: heritagePalette.accentSoft,
  text: heritagePalette.text,
  textMuted: heritagePalette.textMuted,
  border: heritagePalette.border,
  happy: heritagePalette.happy,
  health: heritagePalette.health,
  condolence: heritagePalette.condolence,
  white: heritagePalette.white,
};

/** Locked product scene: deep green + gold + cream. */
export const scene = {
  greenDeep: heritagePalette.greenDeep,
  green: heritagePalette.green,
  greenMid: heritagePalette.greenMid,
  gold: heritagePalette.gold,
  goldSoft: heritagePalette.goldSoft,
  cream: heritagePalette.cream,
  creamLift: heritagePalette.creamLift,
  ink: heritagePalette.ink,
};

/** Brand row circles (donate + family mark) stay the same size. */
export const brandCircleSize = 56;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 42,
};

export const typography = {
  display: 30,
  heading: 22,
  title: 18,
  body: 15,
  caption: 12,
};

export const shadows = {
  card: {
    elevation: 2,
    shadowColor: '#1A2A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
};

export const MEMBER_PHONE_KEY = 'alzidan_member_phone_v1';
