import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { SpecialCard } from '../services/specialCards';

type Props = {
  card: SpecialCard | null;
  visible: boolean;
  onClose: () => void;
};

type NameEffect = 'none' | 'pulse' | 'ornament' | 'pulse-ornament';

type TemplateMeta = {
  effect: NameEffect;
  titleColor: string;
  subtitleColor: string;
  personColor: string;
  metaColor: string;
  messageColor: string;
};

const EMPTY_TEMPLATE_META: TemplateMeta = {
  effect: 'none',
  titleColor: '',
  subtitleColor: '',
  personColor: '',
  metaColor: '',
  messageColor: '',
};

function themeColors(theme?: string | null) {
  if (theme === 'navy') return ['#07111f', '#10233f', '#d7b56d'] as const;
  if (theme === 'gold') return ['#19120a', '#3a2814', '#d7b56d'] as const;
  if (theme === 'green') return ['#071a12', '#123d2b', '#d7b56d'] as const;
  if (theme === 'rose') return ['#231018', '#4a1d2d', '#f3c7d3'] as const;
  if (theme === 'sapphire') return ['#0a1530', '#17366b', '#7dd3fc'] as const;
  if (theme === 'sunset') return ['#2a1208', '#7c2d12', '#fdba74'] as const;
  if (theme === 'plum') return ['#22102d', '#4c1d95', '#c4b5fd'] as const;
  if (theme === 'emerald_luxe') return ['#061510', '#0f3b2e', '#d1fae5'] as const;
  if (theme === 'ruby_royal') return ['#24070e', '#6b1024', '#fecdd3'] as const;
  if (theme === 'obsidian_pearl') return ['#09090b', '#27272a', '#f5f5f4'] as const;
  if (theme === 'desert_lux') return ['#2b1d12', '#8b5e34', '#fde68a'] as const;
  return ['#19120a', '#3a2814', '#d7b56d'] as const;
}

function typeLabel(type: SpecialCard['type']) {
  const map: Record<SpecialCard['type'], string> = {
    wedding: 'زواج',
    graduation: 'تخرج',
    birth: 'مولود',
    promotion: 'ترقية',
    new_house: 'منزل جديد',
    honor: 'تكريم',
    announcement: 'إعلان',
    engagement: 'خطوبة',
    excellence: 'إنجاز',
    retirement: 'تقاعد',
    appreciation: 'شكر وتقدير',
  };
  return map[type] ?? 'مناسبة';
}

function typeIcon(type: SpecialCard['type']) {
  const map: Record<SpecialCard['type'], string> = {
    wedding: '💍',
    graduation: '🎓',
    birth: '👶',
    promotion: '⭐️',
    new_house: '🏠',
    honor: '🏅',
    announcement: '📣',
    engagement: '💐',
    excellence: '🏆',
    retirement: '🕊️',
    appreciation: '👏',
  };
  return map[type] ?? '✨';
}

function dateText(value?: string | null) {
  if (!value) return null;
  const normalizeArabicDigits = (v: string) =>
    String(v || '')
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
  const toArabicDigits = (v: string) =>
    String(v || '').replace(/\d/g, (d) => String.fromCharCode(1632 + Number(d)));

  const normalized = normalizeArabicDigits(String(value || '').trim()).replace(/[\\/]/g, '-');
  const hijriIso = /^(14\d{2})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (hijriIso) {
    const y = hijriIso[1];
    const m = String(Number(hijriIso[2]));
    const d = String(Number(hijriIso[3]));
    return `${toArabicDigits(d)}/${toArabicDigits(m)}/${toArabicDigits(y)}`;
  }

  const date = new Date(`${normalized}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function parseTemplateMeta(value?: string | null): TemplateMeta {
  const text = String(value || '').trim();
  const readColor = (key: string) => {
    const match = text.match(new RegExp(`__${key}_([0-9a-fA-F]{6})(?:__|$)`));
    return match ? `#${match[1].toLowerCase()}` : '';
  };

  const effectMatch = text.match(/__fx_(pulse-ornament|pulse|ornament|none)(?:__|$)/);
  return {
    effect: (effectMatch ? effectMatch[1] : 'none') as NameEffect,
    titleColor: readColor('ttl'),
    subtitleColor: readColor('sub'),
    personColor: readColor('nam'),
    metaColor: readColor('meta'),
    messageColor: readColor('msg'),
  };
}

function parseVisualMetaUrl(value?: string | null): TemplateMeta {
  const text = String(value || '').trim();
  if (!text.startsWith('meta://special-card?')) return EMPTY_TEMPLATE_META;

  const params = new URLSearchParams(text.slice('meta://special-card?'.length));
  const readColor = (key: string) => {
    const raw = String(params.get(key) || '').trim();
    return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : '';
  };

  const effect = String(params.get('fx') || 'none').trim() as NameEffect;
  return {
    effect: effect || 'none',
    titleColor: readColor('ttl'),
    subtitleColor: readColor('sub'),
    personColor: readColor('nam'),
    metaColor: readColor('meta'),
    messageColor: readColor('msg'),
  };
}

export function SpecialCardModal({ card, visible, onClose }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const photoScale = useRef(new Animated.Value(0.55)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const goldFlash = useRef(new Animated.Value(0)).current;
  const edgeMove = useRef(new Animated.Value(0)).current;
  const namePulse = useRef(new Animated.Value(1)).current;
  const namePulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    scale.setValue(0.86);
    photoScale.setValue(0.55);
    buttonPulse.setValue(1);
    goldFlash.setValue(0);
    edgeMove.setValue(0);
    namePulse.setValue(1);

    const startPersistentLoops = () => {
      if (namePulseLoop.current) namePulseLoop.current.stop();
      namePulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(namePulse, {
            toValue: 1.11,
            duration: 720,
            useNativeDriver: true,
          }),
          Animated.timing(namePulse, {
            toValue: 1,
            duration: 720,
            useNativeDriver: true,
          }),
          Animated.delay(900),
        ]),
      );
      namePulseLoop.current.start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(edgeMove, {
            toValue: 1,
            duration: 5200,
            useNativeDriver: true,
          }),
          Animated.timing(edgeMove, {
            toValue: 0,
            duration: 5200,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, {
            toValue: 1.07,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(buttonPulse, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.delay(1800),
        ]),
      ).start();
    };

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(260),
        Animated.spring(photoScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(goldFlash, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(goldFlash, {
          toValue: 0.25,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(goldFlash, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(goldFlash, {
          toValue: 0.18,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(goldFlash, {
          toValue: 0.75,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(goldFlash, {
          toValue: 0.28,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    ]).start(startPersistentLoops);

    return () => {
      if (namePulseLoop.current) {
        namePulseLoop.current.stop();
        namePulseLoop.current = null;
      }
    };
  }, [buttonPulse, edgeMove, fade, goldFlash, namePulse, photoScale, scale, visible]);

  if (!card) return null;

  const [start, end, accent] = themeColors(card.theme);
  const templateMetaRaw = parseTemplateMeta(card.template_key);
  const audioMeta = parseVisualMetaUrl(card.audio_url);
  const templateMeta: TemplateMeta = {
    effect: audioMeta.effect !== 'none' ? audioMeta.effect : templateMetaRaw.effect,
    titleColor: audioMeta.titleColor || templateMetaRaw.titleColor,
    subtitleColor: audioMeta.subtitleColor || templateMetaRaw.subtitleColor,
    personColor: audioMeta.personColor || templateMetaRaw.personColor,
    metaColor: audioMeta.metaColor || templateMetaRaw.metaColor,
    messageColor: audioMeta.messageColor || templateMetaRaw.messageColor,
  };
  const nameEffect = templateMeta.effect;
  const formattedDate = dateText(card.event_date);
  const edgeTranslate = edgeMove.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 16],
  });

  const content = (
    <LinearGradient colors={[start, end]} style={styles.screen}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />

      <Animated.View style={[styles.card, { opacity: fade, transform: [{ scale }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.goldAura,
            {
              borderColor: accent,
              opacity: goldFlash,
              transform: [{ scale: goldFlash.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.025] }) }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeSparkTop,
            {
              backgroundColor: accent,
              opacity: goldFlash,
              transform: [{ translateX: edgeTranslate }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeSparkBottom,
            {
              backgroundColor: accent,
              opacity: goldFlash,
              transform: [{ translateX: edgeTranslate }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeSparkRight,
            {
              backgroundColor: accent,
              opacity: goldFlash,
              transform: [{ translateY: edgeTranslate }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeSparkLeft,
            {
              backgroundColor: accent,
              opacity: goldFlash,
              transform: [{ translateY: edgeTranslate }],
            },
          ]}
        />

        <Text style={[styles.family, { color: '#d7b56d' }]}>عائلة الزيدان</Text>

        <View style={[styles.badge, { borderColor: accent }]}>
          <Text style={[styles.badgeText, { color: accent }]}>
            {typeIcon(card.type)} {typeLabel(card.type)}
          </Text>
        </View>

        <Text style={[styles.title, templateMeta.titleColor ? { color: templateMeta.titleColor } : null]}>{card.title}</Text>

        {!!card.subtitle && <Text style={[styles.subtitle, templateMeta.subtitleColor ? { color: templateMeta.subtitleColor } : null]}>{card.subtitle}</Text>}

        {!!card.image_url && (
          <Animated.View style={[styles.photoFrame, { borderColor: accent, transform: [{ scale: photoScale }] }]}>
            <Image source={{ uri: card.image_url }} style={styles.personPhoto} />
          </Animated.View>
        )}

        <View style={[styles.nameBox, { borderColor: accent }]}>
          <Animated.View
            style={
              nameEffect === 'pulse' || nameEffect === 'pulse-ornament'
                ? { transform: [{ scale: namePulse }] }
                : undefined
            }
          >
            <View style={styles.nameRow}>
              {(nameEffect === 'ornament' || nameEffect === 'pulse-ornament') && (
                <View style={styles.ornamentGroup}>
                  <View style={[styles.ornamentLine, { backgroundColor: templateMeta.personColor || accent }]} />
                  <View style={[styles.ornamentDot, { backgroundColor: templateMeta.personColor || accent }]} />
                  <Text style={[styles.ornamentGem, { color: templateMeta.personColor || accent }]}>✦</Text>
                  <View style={[styles.ornamentDot, { backgroundColor: templateMeta.personColor || accent }]} />
                  <View style={[styles.ornamentLine, { backgroundColor: templateMeta.personColor || accent }]} />
                </View>
              )}
              <Text style={[styles.personName, { color: templateMeta.personColor || accent }]}>{card.person_name}</Text>
              {(nameEffect === 'ornament' || nameEffect === 'pulse-ornament') && (
                <View style={styles.ornamentGroup}>
                  <View style={[styles.ornamentLine, { backgroundColor: templateMeta.personColor || accent }]} />
                  <View style={[styles.ornamentDot, { backgroundColor: templateMeta.personColor || accent }]} />
                  <Text style={[styles.ornamentGem, { color: templateMeta.personColor || accent }]}>✦</Text>
                  <View style={[styles.ornamentDot, { backgroundColor: templateMeta.personColor || accent }]} />
                  <View style={[styles.ornamentLine, { backgroundColor: templateMeta.personColor || accent }]} />
                </View>
              )}
            </View>
          </Animated.View>
          {!!card.secondary_person && (
            <Text style={[styles.secondaryName, templateMeta.subtitleColor ? { color: templateMeta.subtitleColor } : null]}>{card.secondary_person}</Text>
          )}
        </View>

        {!!card.degree_name && <Text style={[styles.meta, templateMeta.metaColor ? { color: templateMeta.metaColor } : null]}>{card.degree_name}</Text>}
        {!!card.university && <Text style={[styles.meta, templateMeta.metaColor ? { color: templateMeta.metaColor } : null]}>{card.university}</Text>}
        {!!formattedDate && <Text style={[styles.date, templateMeta.metaColor ? { color: templateMeta.metaColor } : null]}>{formattedDate}</Text>}
        {!!card.location && <Text style={[styles.location, templateMeta.metaColor ? { color: templateMeta.metaColor } : null]}>📍 {card.location}</Text>}

        {!!card.message && <Text style={[styles.message, templateMeta.messageColor ? { color: templateMeta.messageColor } : null]}>{card.message}</Text>}

        <Animated.View style={{ transform: [{ scale: buttonPulse }] }}>
          <Pressable style={[styles.primaryButton, { backgroundColor: accent }]} onPress={onClose}>
            <Text style={styles.primaryButtonText}>{card.button_text || 'دخول'}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      {card.background_url ? (
        <ImageBackground source={{ uri: card.background_url }} style={styles.screen}>
          <View style={styles.overlay}>{content}</View>
        </ImageBackground>
      ) : (
        content
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 22,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  glowOne: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 140,
    height: 280,
    position: 'absolute',
    right: -90,
    top: -80,
    width: 280,
  },
  glowTwo: {
    backgroundColor: 'rgba(215,181,109,0.14)',
    borderRadius: 180,
    bottom: -110,
    height: 360,
    left: -120,
    position: 'absolute',
    width: 360,
  },
  card: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 34,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  goldAura: {
    borderRadius: 36,
    borderWidth: 2,
    bottom: -3,
    left: -3,
    position: 'absolute',
    right: -3,
    top: -3,
  },
  edgeSparkTop: {
    borderRadius: 999,
    height: 3,
    left: 56,
    position: 'absolute',
    right: 56,
    top: -2,
  },
  edgeSparkBottom: {
    borderRadius: 999,
    bottom: -2,
    height: 3,
    left: 56,
    position: 'absolute',
    right: 56,
  },
  edgeSparkRight: {
    borderRadius: 999,
    bottom: 90,
    position: 'absolute',
    right: -2,
    top: 90,
    width: 3,
  },
  edgeSparkLeft: {
    borderRadius: 999,
    bottom: 90,
    left: -2,
    position: 'absolute',
    top: 90,
    width: 3,
  },
  family: {
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 18,
    writingDirection: 'rtl',
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  title: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 22,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  photoFrame: {
    alignItems: 'center',
    borderRadius: 72,
    borderWidth: 3,
    height: 132,
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    padding: 4,
    width: 132,
  },
  personPhoto: {
    borderRadius: 64,
    height: 124,
    width: 124,
  },
  nameBox: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    marginBottom: 18,
    paddingVertical: 16,
    width: '100%',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 10,
  },
  ornamentGroup: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 3,
  },
  ornamentLine: {
    borderRadius: 999,
    height: 2,
    opacity: 0.92,
    width: 18,
  },
  ornamentDot: {
    borderRadius: 999,
    height: 4,
    opacity: 0.98,
    width: 4,
  },
  ornamentGem: {
    fontSize: 10,
    textShadowColor: 'rgba(255,255,255,0.28)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  personName: {
    fontSize: 31,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  secondaryName: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  meta: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  date: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  location: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  message: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 22,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  primaryButton: {
    borderRadius: 18,
    marginTop: 28,
    minWidth: 150,
    paddingHorizontal: 26,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#1a1207',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
});
