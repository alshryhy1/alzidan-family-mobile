import { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { OccasionInteractCard } from '../components/OccasionInteractCard';
import { PersonPhoto } from '../components/PersonPhoto';
import { loadSelfPathFacts } from '../services/publicData';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Branch, FamilyEvent, TreeChild } from '../types';
import { kinshipLabelForPerson } from '../utils/maternalKinship';
import { isPublicLineageHiddenPerson } from '../utils/personVisibility';
import {
  findDirectSons,
  findPersonOccasions,
  leafPersonName,
  occasionOwnerDisplayName,
  publicLineageChain,
  resolveProvenKinshipLabel,
  resolveSharedAncestorBadge,
  type EncounterMode,
} from '../utils/personEncounter';
import {
  buildSelfPathRings,
  siblingsInGraph,
  type SelfPathRing,
} from '../utils/selfPath';

type Props = {
  mode: EncounterMode;
  person: TreeChild;
  viewer: TreeChild | null;
  branches: Branch[];
  childrenRows: TreeChild[];
  events: FamilyEvent[];
  maternalLabel?: string | null;
  kinshipById?: Record<number, string>;
  memberPhone?: string | null;
  includePubliclyHiddenPeople?: boolean;
  onClose: () => void;
};

function branchLabel(branches: Branch[], branchKey: string) {
  const found = branches.find((b) => b.id === branchKey);
  return found?.name || branchKey;
}

function modeTitle(mode: EncounterMode) {
  if (mode === 'visitor') return 'لقاء عام';
  if (mode === 'self') return 'حسابك';
  return 'لقاء شخصي';
}

function OrnamentDivider() {
  const styles = useThemedStyles(encounterStyles);
  return (
    <View style={styles.ornamentRow}>
      <View style={styles.ornamentLine} />
      <Text style={styles.ornamentMark}>❖</Text>
      <View style={styles.ornamentLine} />
    </View>
  );
}

export function PersonEncounterScreen({
  mode,
  person,
  viewer,
  branches,
  childrenRows,
  events,
  maternalLabel,
  kinshipById,
  memberPhone,
  includePubliclyHiddenPeople = false,
  onClose,
}: Props) {
  const p = useThemePalette();
  const styles = useThemedStyles(encounterStyles);
  const insets = useSafeAreaInsets();
  const name = leafPersonName(person.name);
  const branch = branchLabel(branches, person.branchKey);
  const lineage = publicLineageChain(person.name, mode === 'self' ? 8 : 3);
  const [resumeTick, setResumeTick] = useState(0);
  const [selfPathRings, setSelfPathRings] = useState<SelfPathRing[]>([]);
  const [selfPathLoading, setSelfPathLoading] = useState(false);
  const maternal =
    maternalLabel || kinshipLabelForPerson(kinshipById, person, childrenRows) || null;
  const kinship =
    mode === 'member'
      ? resolveProvenKinshipLabel(viewer, person, maternal, childrenRows)
      : null;
  const directSons =
    mode === 'visitor' || mode === 'member'
      ? findDirectSons(childrenRows, person, {
          includePubliclyHidden: includePubliclyHiddenPeople,
        })
      : [];
  const linkedSons = useMemo(() => {
    if (mode !== 'self' || !kinshipById) return [];
    const ids = Object.keys(kinshipById)
      .map(Number)
      .filter((id) => kinshipById[id] === 'ابنك');
    return ids
      .map((id) => childrenRows.find((row) => Number(row.id) === id))
      .filter((row): row is TreeChild => Boolean(row));
  }, [mode, kinshipById, childrenRows]);
  const sons = mode === 'self' ? linkedSons : directSons;
  const occasions = useMemo(
    () => findPersonOccasions(events, person, childrenRows),
    [events, person, childrenRows],
  );
  const liveOccasion = occasions[0] || null;

  const selfInfoRows = useMemo(() => {
    if (mode !== 'self') return [];
    return [
      person.city ? { label: 'المدينة', value: person.city } : null,
      person.area ? { label: 'الحي / القرية', value: person.area } : null,
      person.birthDateHijri
        ? { label: 'الميلاد الهجري', value: person.birthDateHijri }
        : null,
      person.birthDateGregorian
        ? { label: 'الميلاد الميلادي', value: person.birthDateGregorian }
        : null,
    ].filter((row): row is { label: string; value: string } => Boolean(row));
  }, [mode, person]);

  const sharedPathLabel =
    mode === 'member' && !kinship ? resolveSharedAncestorBadge(viewer, person) : null;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setResumeTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    if (mode !== 'self') {
      setSelfPathRings([]);
      setSelfPathLoading(false);
      return () => {
        alive = false;
      };
    }
    const siblingNames = siblingsInGraph(person, childrenRows)
      .filter((row) => !isPublicLineageHiddenPerson(row))
      .map((row) => leafPersonName(row.name))
      .filter(Boolean);
    setSelfPathRings(
      buildSelfPathRings(person, {
        siblingNames,
        childNames: [],
        externalOffspringNames: [],
        branchLabel: branch,
      }),
    );
    setSelfPathLoading(true);
    loadSelfPathFacts(person, childrenRows, memberPhone)
      .then((facts) => {
        if (!alive) return;
        const selfLeaf = leafPersonName(person.name);
        const sisterNames = (facts.sisterNames || []).filter(
          (name) => name && name !== selfLeaf,
        );
        const sisterSet = new Set(sisterNames);
        setSelfPathRings(
          buildSelfPathRings(person, {
            motherName: facts.motherName,
            spousePartnerName: facts.spousePartnerName,
            spouseRole: facts.spouseRole,
            siblingNames: siblingNames.filter((name) => !sisterSet.has(name)),
            sisterNames,
            childNames: facts.childNames,
            daughterNames: facts.daughterNames,
            externalOffspringNames: facts.externalOffspringNames,
            branchLabel: branch,
          }),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setSelfPathLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, person.id, person.name, person.parentName, person.branchKey, branch, childrenRows, memberPhone, resumeTick]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* —— Hero (deep green) —— */}
        <LinearGradient
          colors={[p.heroDeep, p.heroMid, p.heroLift]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.heroPattern} pointerEvents="none">
            {Array.from({ length: 18 }).map((_, i) => (
              <Text key={i} style={[styles.patternGlyph, { opacity: 0.04 + (i % 3) * 0.01 }]}>
                ❖
              </Text>
            ))}
          </View>

          <View style={styles.heroTop}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.backChip, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.backChipText}>رجوع</Text>
            </Pressable>
            <View style={styles.brandBlock}>
              <View style={styles.brandMark}>
                <Text style={styles.brandLetter}>ز</Text>
              </View>
              <View>
                <Text style={styles.brandAr}>عائلة الزيدان</Text>
                <Text style={styles.brandEn}>AL-ZIDAN</Text>
              </View>
            </View>
            <View style={styles.modeChip}>
              <Text style={styles.modeChipText}>{modeTitle(mode)}</Text>
            </View>
          </View>

          <Text style={styles.encounterLabel}>
            {mode === 'self' ? 'بطاقتك' : 'بطاقة الشخص'}
          </Text>

          <View style={styles.monogramWrap}>
            <PersonPhoto name={name} showFallback size="lg" uri={person.photoUrl} />
          </View>

          <Text style={styles.heroName}>{name}</Text>

          {kinship ? (
            <View style={styles.kinshipRow}>
              <View style={styles.kinshipLine} />
              <Text style={styles.kinshipText}>{kinship}</Text>
              <View style={styles.kinshipLine} />
            </View>
          ) : mode === 'visitor' ? (
            <Text style={styles.heroSub}>من عائلة الزيدان</Text>
          ) : mode === 'self' ? (
            <Text style={styles.heroSub}>مكانك في العائلة</Text>
          ) : (
            <Text style={styles.heroSub}>من فرع {branch}</Text>
          )}

          {sharedPathLabel ? (
            <View style={styles.pathBadge}>
              <Text style={styles.pathBadgeText}>{sharedPathLabel}</Text>
            </View>
          ) : branch ? (
            <View style={styles.pathBadge}>
              <Text style={styles.pathBadgeText}>فرع {branch}</Text>
            </View>
          ) : null}

          <View style={styles.heroCurve}>
            <View style={styles.heroCurveGold} />
          </View>
        </LinearGradient>

        {/* —— Cream body —— */}
        <View style={styles.body}>
          <View style={styles.bodyPattern} pointerEvents="none">
            {Array.from({ length: 12 }).map((_, i) => (
              <Text key={i} style={styles.bodyGlyph}>
                ❖
              </Text>
            ))}
          </View>

          {mode === 'self' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>مسار الذات</Text>
              <OrnamentDivider />
              {selfPathLoading && !selfPathRings.length ? (
                <Text style={styles.loadingNote}>جاري تحميل مسارك في العائلة...</Text>
              ) : (
                <View style={styles.lineageCol}>
                  {selfPathRings.map((item, index) => (
                    <View key={item.key} style={styles.lineageNode}>
                      <Text style={styles.ringCaption}>{item.ring}</Text>
                      <View style={styles.lineageHex}>
                        <Text style={styles.lineageHexText}>{item.detail}</Text>
                      </View>
                      {index < selfPathRings.length - 1 ? (
                        <View style={styles.lineageStem}>
                          <View style={styles.lineageDot} />
                          <View style={styles.lineageBar} />
                          <View style={styles.lineageDot} />
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : lineage.length > 1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>مكانه في العائلة</Text>
              <OrnamentDivider />
              <View style={styles.lineageCol}>
                {lineage.map((part, index) => (
                  <View key={`${part}-${index}`} style={styles.lineageNode}>
                    <View style={styles.lineageHex}>
                      <Text style={styles.lineageHexText}>{part}</Text>
                    </View>
                    {index < lineage.length - 1 ? (
                      <View style={styles.lineageStem}>
                        <View style={styles.lineageDot} />
                        <View style={styles.lineageBar} />
                        <View style={styles.lineageDot} />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {mode !== 'self' && sons.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{mode === 'self' ? 'أبناؤك' : 'عائلته'}</Text>
              <OrnamentDivider />
              <View style={styles.familyList}>
                {sons.map((son) => (
                  <View key={son.id} style={styles.familyCard}>
                    <PersonPhoto name={leafPersonName(son.name)} size="sm" uri={son.photoUrl} />
                    <Text style={styles.familyName}>
                      {leafPersonName(son.name)}
                      {mode === 'self' ? ' — ابنك' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {mode === 'self' && selfInfoRows.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>معلوماتك</Text>
              <OrnamentDivider />
              <View style={styles.infoCard}>
                {selfInfoRows.map((row) => (
                  <View key={row.label} style={styles.infoRow}>
                    <Text style={styles.infoValue}>{row.value}</Text>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {liveOccasion ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {mode === 'self'
                  ? 'مناسباتك'
                  : mode === 'member'
                    ? 'مناسبة تجمعكما'
                    : 'مناسبة عامة'}
              </Text>
              <OrnamentDivider />
              <View style={styles.occasionCard}>
                <Text style={styles.occasionIcon}>◈</Text>
                <View style={styles.occasionText}>
                  <Text style={styles.occasionTitle}>
                    {liveOccasion.title || liveOccasion.person}
                  </Text>
                  {liveOccasion.date ? (
                    <Text style={styles.occasionMeta}>{liveOccasion.date}</Text>
                  ) : null}
                </View>
              </View>
              {mode === 'member' || mode === 'self' ? (
                <View style={styles.interactWrap}>
                  <OccasionInteractCard
                    occasionId={Number(liveOccasion.id)}
                    eventType={String(
                      liveOccasion.type || liveOccasion.category || 'occasion',
                    )}
                    person={
                      occasionOwnerDisplayName(liveOccasion) ||
                      liveOccasion.person ||
                      undefined
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function encounterStyles(p: ThemePalette) {
  return {
  root: {
    backgroundColor: p.cream,
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  hero: {
    overflow: 'hidden',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  heroPattern: {
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 28,
    justifyContent: 'space-around',
    left: 0,
    padding: 12,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  patternGlyph: {
    color: p.gold,
    fontSize: 22,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backChip: {
    borderColor: p.gold,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backChipText: {
    color: p.goldSoft,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  brandBlock: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,163,90,0.15)',
    borderColor: p.gold,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  brandLetter: {
    color: p.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  brandAr: {
    color: p.goldSoft,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  brandEn: {
    color: p.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.8,
    textAlign: 'right',
  },
  modeChip: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: p.gold,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modeChipText: {
    color: p.goldSoft,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  encounterLabel: {
    color: p.gold,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  encounterLabelEn: {
    color: p.goldSoft,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: spacing.md,
    opacity: 0.75,
    textAlign: 'center',
  },
  monogramWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monogramOuter: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,163,90,0.12)',
    borderColor: p.gold,
    borderRadius: 999,
    borderWidth: 2,
    height: 118,
    justifyContent: 'center',
    width: 118,
  },
  monogramInner: {
    alignItems: 'center',
    backgroundColor: p.greenDeep,
    borderColor: p.goldSoft,
    borderRadius: 999,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  monogramLetter: {
    color: p.gold,
    fontSize: 44,
    fontWeight: '900',
  },
  heroName: {
    color: p.cream,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroSub: {
    color: p.goldSoft,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: 6,
    opacity: 0.9,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  kinshipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 10,
  },
  kinshipLine: {
    backgroundColor: p.gold,
    height: 1,
    opacity: 0.55,
    width: 36,
  },
  kinshipText: {
    color: p.gold,
    fontSize: typography.title,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  pathBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15,42,36,0.55)',
    borderColor: p.gold,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: spacing.md,
    maxWidth: '92%',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  pathBadgeText: {
    color: p.goldSoft,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroCurve: {
    height: 18,
    marginBottom: -18,
    marginTop: spacing.lg,
  },
  heroCurveGold: {
    backgroundColor: p.gold,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    height: 4,
    opacity: 0.85,
  },
  body: {
    backgroundColor: p.cream,
    gap: spacing.lg,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  bodyPattern: {
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 40,
    justifyContent: 'space-around',
    left: 0,
    opacity: 0.035,
    padding: 20,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bodyGlyph: {
    color: p.green,
    fontSize: 28,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: p.greenDeep,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  ornamentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  ornamentLine: {
    backgroundColor: p.gold,
    flex: 1,
    height: StyleSheet.hairlineWidth,
    maxWidth: 90,
    opacity: 0.7,
  },
  ornamentMark: {
    color: p.gold,
    fontSize: 12,
  },
  lineageCol: {
    alignItems: 'center',
    gap: 0,
  },
  lineageNode: {
    alignItems: 'center',
    width: '100%',
  },
  lineageHex: {
    backgroundColor: p.green,
    borderColor: p.gold,
    borderRadius: 16,
    borderWidth: 1.5,
    minWidth: '70%',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  lineageHexText: {
    color: p.cream,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  ringCaption: {
    color: p.gold,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  loadingNote: {
    color: p.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  lineageStem: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  lineageBar: {
    backgroundColor: p.gold,
    flex: 1,
    width: 2,
  },
  lineageDot: {
    backgroundColor: p.gold,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  familyList: {
    gap: spacing.sm,
  },
  familyCard: {
    alignItems: 'center',
    backgroundColor: p.surface,
    borderColor: p.gold,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  familyStar: {
    color: p.gold,
    fontSize: 14,
  },
  familyName: {
    color: p.greenDeep,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  infoCard: {
    backgroundColor: p.surface,
    borderColor: p.gold,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  infoRow: {
    borderTopColor: 'rgba(196,163,90,0.35)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  infoLabel: {
    color: p.textMuted,
    fontSize: typography.caption,
    writingDirection: 'rtl',
  },
  infoValue: {
    color: p.greenDeep,
    fontSize: typography.body,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  occasionCard: {
    alignItems: 'center',
    backgroundColor: p.surface,
    borderColor: p.gold,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    padding: spacing.md,
  },
  occasionIcon: {
    color: p.gold,
    fontSize: 22,
  },
  occasionText: {
    flex: 1,
    gap: 2,
  },
  occasionTitle: {
    color: p.greenDeep,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  occasionMeta: {
    color: p.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  interactWrap: {
    marginTop: spacing.xs,
  },
  };
}
