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

function themeColors(theme?: string | null) {
  if (theme === 'navy') return ['#07111f', '#10233f', '#d7b56d'] as const;
  if (theme === 'green') return ['#071a12', '#123d2b', '#d7b56d'] as const;
  if (theme === 'rose') return ['#231018', '#4a1d2d', '#f3c7d3'] as const;
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
  };
  return map[type] ?? '✨';
}

function dateText(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function SpecialCardModal({ card, visible, onClose }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const photoScale = useRef(new Animated.Value(0.55)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const goldFlash = useRef(new Animated.Value(0)).current;
  const edgeMove = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    scale.setValue(0.86);
    photoScale.setValue(0.55);
    buttonPulse.setValue(1);
    goldFlash.setValue(0);
    edgeMove.setValue(0);

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
    ]).start(() => {
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
    });
  }, [buttonPulse, edgeMove, fade, goldFlash, photoScale, scale, visible]);

  if (!card) return null;

  const [start, end, accent] = themeColors(card.theme);
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

        <Text style={[styles.family, { color: accent }]}>عائلة الزيدان</Text>

        <View style={[styles.badge, { borderColor: accent }]}>
          <Text style={[styles.badgeText, { color: accent }]}>
            {typeIcon(card.type)} {typeLabel(card.type)}
          </Text>
        </View>

        <Text style={styles.title}>{card.title}</Text>

        {!!card.subtitle && <Text style={styles.subtitle}>{card.subtitle}</Text>}

        {!!card.image_url && (
          <Animated.View style={[styles.photoFrame, { borderColor: accent, transform: [{ scale: photoScale }] }]}>
            <Image source={{ uri: card.image_url }} style={styles.personPhoto} />
          </Animated.View>
        )}

        <View style={[styles.nameBox, { borderColor: accent }]}>
          <Text style={[styles.personName, { color: accent }]}>{card.person_name}</Text>
          {!!card.secondary_person && (
            <Text style={styles.secondaryName}>{card.secondary_person}</Text>
          )}
        </View>

        {!!card.degree_name && <Text style={styles.meta}>{card.degree_name}</Text>}
        {!!card.university && <Text style={styles.meta}>{card.university}</Text>}
        {!!formattedDate && <Text style={styles.date}>{formattedDate}</Text>}
        {!!card.location && <Text style={styles.location}>📍 {card.location}</Text>}

        {!!card.message && <Text style={styles.message}>{card.message}</Text>}

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
