/**
 * Family Space — scene composition (not a name list).
 * One continuous stage: place → approach → path. No bottom tabs.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../theme';

type Phase = 'place' | 'extend' | 'approach' | 'path' | 'search';

type Props = {
  onOpenPulse?: () => void;
};

const { width: W, height: H } = Dimensions.get('window');

export function FamilySpaceMotionLab({ onOpenPulse }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('place');
  const [query, setQuery] = useState('');

  // 0 place · 1 approach · path overlays
  const t = useRef(new Animated.Value(0)).current;
  const pathT = useRef(new Animated.Value(0)).current;
  const extendT = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const to = phase === 'approach' || phase === 'path' ? 1 : 0;
    const toPath = phase === 'path' ? 1 : 0;
    const toExtend = phase === 'extend' ? 1 : 0;
    Animated.parallel([
      Animated.timing(t, { toValue: to, duration: 380, useNativeDriver: true }),
      Animated.timing(pathT, { toValue: toPath, duration: 420, useNativeDriver: true }),
      Animated.timing(extendT, { toValue: toExtend, duration: 340, useNativeDriver: true }),
    ]).start();
  }, [phase, t, pathT, extendT]);

  const away = phase === 'approach' || phase === 'path';

  // Mohammed flies from his place slot toward stage center
  const mohammedX = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -W * 0.08],
  });
  const mohammedY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -H * 0.12],
  });
  const mohammedScale = t.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const placeFade = t.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const heroShift = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });
  const heroFade = t.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.15],
  });
  const meaningOp = t.interpolate({
    inputRange: [0.55, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const howOp = t.interpolate({
    inputRange: [0.75, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const pathOp = pathT;
  const surroundOp = t.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 0.55],
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.chrome}>
        <Pressable
          disabled={!away}
          onPress={() => setPhase('place')}
          style={({ pressed }) => [styles.anchorWrap, away && styles.anchorLit, pressed && away && { opacity: 0.6 }]}
        >
          <Text style={[styles.anchor, away && styles.anchorOn]}>حسن · عائلتي</Text>
        </Pressable>
        {phase !== 'search' ? (
          <Pressable onPress={() => setPhase('search')}>
            <Text style={styles.cue}>من تبحث عنه؟</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setPhase('place')}>
            <Text style={styles.cue}>إغلاق</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.stage}>
        {phase === 'search' ? (
          <View style={styles.search}>
            <Text style={styles.searchTitle}>من تبحث عنه؟</Text>
            <TextInput
              autoFocus
              placeholder="اكتب اسمًا…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={query}
              onChangeText={setQuery}
            />
            <Pressable onPress={() => setPhase('approach')} style={styles.hit}>
              <Text style={styles.hitName}>محمد خميس</Text>
              <Text style={styles.hitKin}>ابن خالك</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Hero — person in scene, not diagram node */}
            <Animated.View
              style={[
                styles.heroBlock,
                { opacity: heroFade, transform: [{ translateY: heroShift }] },
              ]}
            >
              <Text style={styles.hero}>حسن خميس</Text>
              <Text style={styles.branch}>فرع مزيد</Text>
            </Animated.View>

            {/* Spatial constellation — NOT a vertical directory */}
            <View style={styles.constellation}>
              <Animated.View
                pointerEvents={away ? 'none' : 'auto'}
                style={[styles.slot, styles.slotSulaiman, { opacity: placeFade }]}
              >
                <Text style={styles.nameL}>سليمان</Text>
                <Text style={styles.kin}>خالك</Text>
              </Animated.View>

              {/* Mohammed stays visible while flying to center */}
              <Animated.View
                style={[
                  styles.slot,
                  styles.slotMohammed,
                  {
                    transform: [
                      { translateX: mohammedX },
                      { translateY: mohammedY },
                      { scale: mohammedScale },
                    ],
                  },
                ]}
              >
                <Pressable onPress={() => setPhase('approach')} disabled={away}>
                  <Text style={[styles.nameM, away && styles.nameFocus]}>محمد خميس</Text>
                  {away ? (
                    <Animated.Text style={[styles.kin, styles.kinFocus, { opacity: meaningOp }]}>
                      ابن خالك
                    </Animated.Text>
                  ) : (
                    <Text style={styles.kin}>ابن خالك</Text>
                  )}
                </Pressable>
              </Animated.View>

              <Animated.View
                pointerEvents={away ? 'none' : 'auto'}
                style={[styles.slot, styles.slotAbdullah, { opacity: placeFade }]}
              >
                <Text style={styles.nameS}>عبدالله</Text>
                <Text style={styles.kin}>عمك</Text>
              </Animated.View>
            </View>

            {/* Extend — spatial widen, not a menu */}
            <Animated.View
              pointerEvents={phase === 'place' ? 'auto' : phase === 'extend' ? 'auto' : 'none'}
              style={[
                styles.extendZone,
                {
                  opacity:
                    phase === 'extend'
                      ? extendT
                      : phase === 'place'
                        ? 1
                        : placeFade,
                },
              ]}
            >
              {phase === 'place' ? (
                <Pressable onPress={() => setPhase('extend')}>
                  <Text style={styles.extend}>امتد إلى عائلتك</Text>
                </Pressable>
              ) : null}
              {phase === 'extend' ? (
                <View style={styles.extendBody}>
                  <Text style={styles.extendLead}>ما بعد بيتك القريب</Text>
                  <Pressable onPress={() => setPhase('approach')} style={styles.extendPerson}>
                    <Text style={styles.nameS}>فهد</Text>
                    <Text style={styles.kin}>ابن عمك</Text>
                  </Pressable>
                  <Pressable onPress={() => setPhase('approach')} style={styles.extendPerson}>
                    <Text style={styles.nameM}>محمد خميس</Text>
                    <Text style={styles.kin}>ابن خالك</Text>
                  </Pressable>
                  <Pressable onPress={() => setPhase('place')}>
                    <Text style={styles.backNear}>عد إلى مكانك</Text>
                  </Pressable>
                </View>
              ) : null}
            </Animated.View>

            {/* Approach meaning + quiet surround (not sections) */}
            {away ? (
              <View style={styles.focusChrome} pointerEvents="box-none">
                <Animated.View style={[styles.surround, { opacity: surroundOp }]}>
                  <Text style={styles.surroundName}>سليمان</Text>
                  <Text style={styles.surroundName}>…</Text>
                </Animated.View>

                {phase === 'approach' ? (
                  <Animated.View style={{ opacity: howOp }}>
                    <Pressable onPress={() => setPhase('path')} style={styles.how}>
                      <Text style={styles.howText}>كيف وصلنا؟</Text>
                    </Pressable>
                  </Animated.View>
                ) : null}

                {phase === 'path' ? (
                  <Animated.View style={[styles.path, { opacity: pathOp }]}>
                    <Text style={styles.pathLine}>حسن</Text>
                    <Text style={styles.pathSoft}>أنت</Text>
                    <Text style={styles.pathLine}>سليمان</Text>
                    <Text style={styles.pathSoft}>خالك</Text>
                    <Text style={styles.pathLine}>محمد</Text>
                    <Text style={styles.pathSoft}>ابن خالك</Text>
                    <Pressable onPress={() => setPhase('approach')} style={styles.settle}>
                      <Text style={styles.settleText}>حسنًا</Text>
                    </Pressable>
                  </Animated.View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* Optional pulse only — never a tab strip */}
      {!away && phase === 'place' && onOpenPulse ? (
        <Pressable onPress={onOpenPulse} style={styles.pulseOnly}>
          <Text style={styles.pulseText}>نبض العائلة</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  chrome: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  anchorWrap: {
    opacity: 0.28,
    paddingVertical: 4,
  },
  anchorLit: {
    opacity: 0.9,
  },
  anchor: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  anchorOn: {
    color: colors.primaryDark,
  },
  cue: {
    color: colors.textMuted,
    fontSize: typography.caption,
    opacity: 0.5,
    writingDirection: 'rtl',
  },
  stage: {
    flex: 1,
  },
  heroBlock: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    zIndex: 2,
  },
  hero: {
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  branch: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  constellation: {
    flex: 1,
    minHeight: 280,
    position: 'relative',
  },
  slot: {
    alignItems: 'flex-end',
    position: 'absolute',
  },
  slotSulaiman: {
    right: 8,
    top: 8,
  },
  slotMohammed: {
    right: 28,
    top: 88,
    zIndex: 5,
  },
  slotAbdullah: {
    left: 24,
    top: 168,
  },
  nameL: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  nameM: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  nameS: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  kin: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  nameFocus: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  kinFocus: {
    fontSize: typography.title,
    textAlign: 'center',
  },
  extendZone: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  extend: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontStyle: 'italic',
    opacity: 0.5,
    textAlign: 'center',
  },
  extendBody: {
    alignItems: 'flex-end',
    gap: spacing.md,
    width: '100%',
  },
  extendLead: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginBottom: spacing.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  extendPerson: {
    alignItems: 'flex-end',
    gap: 2,
  },
  backNear: {
    alignSelf: 'center',
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: spacing.md,
    opacity: 0.55,
  },
  focusChrome: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 100,
  },
  surround: {
    flexDirection: 'row-reverse',
    gap: 28,
    marginTop: spacing.xl,
    opacity: 0.5,
  },
  surroundName: {
    color: colors.textMuted,
    fontSize: typography.caption,
    writingDirection: 'rtl',
  },
  how: {
    marginTop: spacing.xl,
    paddingVertical: 10,
  },
  howText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  path: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  pathLine: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  pathSoft: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
  },
  settle: {
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  settleText: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  search: {
    flex: 1,
    paddingTop: spacing.md,
  },
  searchTitle: {
    color: colors.primaryDark,
    fontSize: typography.heading,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    color: colors.text,
    fontSize: typography.title,
    marginBottom: spacing.xl,
    paddingVertical: 10,
    writingDirection: 'rtl',
  },
  hit: {
    alignItems: 'flex-end',
    gap: 4,
  },
  hitName: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  hitKin: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontStyle: 'italic',
    writingDirection: 'rtl',
  },
  pulseOnly: {
    alignSelf: 'center',
    opacity: 0.35,
    paddingVertical: 6,
  },
  pulseText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
});
