import type { SpecialCard } from '../services/specialCards';

type ThemePalette = {
  accent: string;
  title: string;
  subtitle: string;
  meta: string;
  message: string;
};

type ColorMeta = {
  titleColor: string;
  subtitleColor: string;
  personColor: string;
  metaColor: string;
  messageColor: string;
};

export type ResolvedSpecialCardTextColors = {
  accent: string;
  title: string;
  subtitle: string;
  person: string;
  secondary: string;
  meta: string;
  message: string;
};

function readTemplateColor(text: string, key: string) {
  const match = text.match(new RegExp(`__${key}_([0-9a-fA-F]{6})(?:__|$)`));
  return match ? `#${match[1].toLowerCase()}` : '';
}

function parseTemplateMeta(value?: string | null): ColorMeta {
  const text = String(value || '').trim();
  return {
    titleColor: readTemplateColor(text, 'ttl'),
    subtitleColor: readTemplateColor(text, 'sub'),
    personColor: readTemplateColor(text, 'nam'),
    metaColor: readTemplateColor(text, 'meta'),
    messageColor: readTemplateColor(text, 'msg'),
  };
}

function parseVisualMetaUrl(value?: string | null): ColorMeta {
  const text = String(value || '').trim();
  const empty: ColorMeta = {
    titleColor: '',
    subtitleColor: '',
    personColor: '',
    metaColor: '',
    messageColor: '',
  };
  if (!text.startsWith('meta://special-card?')) return empty;

  const params = new URLSearchParams(text.slice('meta://special-card?'.length));
  const readColor = (key: string) => {
    const raw = String(params.get(key) || '').trim();
    return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : '';
  };

  return {
    titleColor: readColor('ttl'),
    subtitleColor: readColor('sub'),
    personColor: readColor('nam'),
    metaColor: readColor('meta'),
    messageColor: readColor('msg'),
  };
}

/** نفس specialCardThemePalette في assets/js/admin.js */
export function specialCardThemePalette(theme?: string | null): ThemePalette {
  const themes: Record<string, ThemePalette> = {
    navy: {
      accent: '#d7b56d',
      title: '#f8fafc',
      subtitle: '#dbeafe',
      meta: '#cbd5e1',
      message: '#f1f5f9',
    },
    gold: {
      accent: '#d7b56d',
      title: '#fff7db',
      subtitle: '#f5e7bf',
      meta: '#e7d8ad',
      message: '#fff1c8',
    },
    green: {
      accent: '#9ae6b4',
      title: '#ecfdf5',
      subtitle: '#bbf7d0',
      meta: '#86efac',
      message: '#dcfce7',
    },
    rose: {
      accent: '#f3c7d3',
      title: '#fff1f5',
      subtitle: '#fecdd3',
      meta: '#fda4af',
      message: '#ffe4e6',
    },
    sapphire: {
      accent: '#7dd3fc',
      title: '#e0f2fe',
      subtitle: '#bae6fd',
      meta: '#93c5fd',
      message: '#f0f9ff',
    },
    sunset: {
      accent: '#fdba74',
      title: '#fff7ed',
      subtitle: '#fed7aa',
      meta: '#fdba74',
      message: '#ffedd5',
    },
    plum: {
      accent: '#c4b5fd',
      title: '#f5f3ff',
      subtitle: '#ddd6fe',
      meta: '#c4b5fd',
      message: '#ede9fe',
    },
    emerald_luxe: {
      accent: '#d1fae5',
      title: '#f0fdf4',
      subtitle: '#bbf7d0',
      meta: '#86efac',
      message: '#dcfce7',
    },
    ruby_royal: {
      accent: '#fecdd3',
      title: '#fff1f2',
      subtitle: '#fda4af',
      meta: '#fda4af',
      message: '#ffe4e6',
    },
    obsidian_pearl: {
      accent: '#f5f5f4',
      title: '#fafaf9',
      subtitle: '#e7e5e4',
      meta: '#d6d3d1',
      message: '#f5f5f4',
    },
    desert_lux: {
      accent: '#fde68a',
      title: '#fffbeb',
      subtitle: '#fcd34d',
      meta: '#fbbf24',
      message: '#fef3c7',
    },
  };

  return themes[String(theme || 'navy').trim()] || themes.navy;
}

/** نفس منطق renderSpecialCardPreview في لوحة الإدارة */
export function resolveSpecialCardTextColors(card: SpecialCard): ResolvedSpecialCardTextColors {
  const visualMeta = parseVisualMetaUrl(card.audio_url);
  const templateMeta = parseTemplateMeta(card.template_key);
  const merged: ColorMeta = {
    titleColor: visualMeta.titleColor || templateMeta.titleColor,
    subtitleColor: visualMeta.subtitleColor || templateMeta.subtitleColor,
    personColor: visualMeta.personColor || templateMeta.personColor,
    metaColor: visualMeta.metaColor || templateMeta.metaColor,
    messageColor: visualMeta.messageColor || templateMeta.messageColor,
  };
  const palette = specialCardThemePalette(card.theme);

  return {
    accent: palette.accent,
    title: merged.titleColor || palette.title,
    subtitle: merged.subtitleColor || palette.subtitle,
    person: merged.personColor || palette.accent,
    secondary: merged.subtitleColor || palette.subtitle,
    meta: merged.metaColor || palette.meta,
    message: merged.messageColor || palette.message,
  };
}
