import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { DataState } from '../components/DataState';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { PersonPhoto } from '../components/PersonPhoto';
import { GoldDivider, SceneShell } from '../components/scene';
import { colors, scene, spacing, typography } from '../theme';
import type { FamilyEvent, TreeChild } from '../types';
import { eventTypeArabicLabel } from '../utils/eventTypeLabels';
import { isFamilyEventPubliclyVisible } from '../utils/eventVisibility';

type HomeScreenProps = {
  memberGreeting?: string | null;
  memberBranchKey?: string | null;
  memberPhotoUrl?: string | null;
  memberTreeChildId?: number | null;
  /** Loaded tree children — presence marks use the member's branch only. */
  branchChildren?: TreeChild[];
  error: string | null;
  latestEvents?: FamilyEvent[];
  loading: boolean;
  onRetry: () => void;
  onOpenEvents?: () => void;
  onOpenMyCard?: () => void;
};

function stripMarkdownNoise(value?: string | null) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstNameOnly(full?: string | null) {
  const raw = String(full || '').trim();
  if (!raw) return '';
  return (raw.split(/\s+/)[0] || '').trim();
}

function personShortName(person?: string | null) {
  const tokens = String(person || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w !== 'بن' && w !== 'ابن' && w !== 'بنت');
  if (tokens.length >= 2) return `${tokens[0]} ${tokens[1]}`;
  return tokens[0] || '';
}

function normalizePersonKey(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function samePerson(a?: string | null, b?: string | null) {
  const left = normalizePersonKey(a);
  const right = normalizePersonKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftFirst = firstNameOnly(left);
  const rightFirst = firstNameOnly(right);
  if (leftFirst.length >= 2 && leftFirst === rightFirst) {
    return left.startsWith(right) || right.startsWith(left);
  }
  return left.includes(right) || right.includes(left);
}

function timestampOf(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function blessingLine(event: FamilyEvent) {
  const type = String(event.type || '').toLowerCase();
  if (type.includes('promotion')) return 'مبارك الترقية';
  if (type.includes('graduation')) return 'مبارك التخرج';
  if (type.includes('marriage') || type.includes('wedding') || type === 'contract') {
    return 'بارك الله لكما';
  }
  if (type.includes('birth') || type === 'aqiqa') return 'بارك الله في مولودكم';
  if (type.includes('retirement')) return 'بارك الله في تقاعدك';
  if (event.category === 'health') return 'نسأل الله لك العافية';
  if (event.category === 'condolence') return 'أحسن الله عزاءكم';
  const title = stripMarkdownNoise(event.title);
  if (title && title.length <= 28) return title;
  return eventTypeArabicLabel(event.type) || 'لحظة من أهلك';
}

function isUsableMoment(event: FamilyEvent) {
  if (event.category === 'condolence') return false;
  return Boolean(String(event.person || '').trim());
}

function aboutMember(event: FamilyEvent, memberGreeting?: string | null) {
  const member = String(memberGreeting || '').trim();
  if (!member) return false;
  const memberFirst = firstNameOnly(member);
  const person = String(event.person || '').trim();
  if (!person) return false;
  if (person === member) return true;
  if (memberFirst && person.split(/\s+/)[0] === memberFirst) return true;
  return person.includes(memberFirst) && memberFirst.length >= 2;
}

function sameBranchAsMember(event: FamilyEvent, branchKeyNorm: string) {
  if (!branchKeyNorm) return false;
  return String(event.branch || '')
    .trim()
    .toLowerCase()
    .includes(branchKeyNorm);
}

/** Soft kinship line — only when a real signal exists. Never invent. */
function kinshipHint(
  event: FamilyEvent,
  memberGreeting?: string | null,
  branchKeyNorm?: string,
) {
  if (aboutMember(event, memberGreeting)) return 'لحظتك';
  if (branchKeyNorm && sameBranchAsMember(event, branchKeyNorm)) return 'من أهلك';
  return '';
}

const PRESENCE_MAX = 5;
const PRESENCE_MIN_OTHERS = 2;

function buildPresenceMarks(input: {
  branchKey: string | null | undefined;
  momentPerson: string;
  memberGreeting?: string | null;
  children: TreeChild[];
}): { count: number; litIndex: number } | null {
  const key = String(input.branchKey || '')
    .trim()
    .toLowerCase();
  if (!key || !input.momentPerson.trim()) return null;

  const inBranch = input.children.filter(
    (row) =>
      String(row.branchKey || '')
        .trim()
        .toLowerCase() === key && String(row.name || '').trim(),
  );

  const unique: TreeChild[] = [];
  for (const row of inBranch) {
    if (unique.some((u) => samePerson(u.name, row.name))) continue;
    unique.push(row);
  }

  const others = unique.filter(
    (row) =>
      !samePerson(row.name, input.momentPerson) &&
      !samePerson(row.name, input.memberGreeting),
  );

  if (others.length < PRESENCE_MIN_OTHERS) return null;

  const slots = Math.min(PRESENCE_MAX, others.length + 1);
  const otherSlots = slots - 1;
  const pickedOthers = others.slice(0, otherSlots);
  const litIndex = Math.min(Math.floor(slots / 2), pickedOthers.length);
  return { count: pickedOthers.length + 1, litIndex };
}

/**
 * Presentation rule (no schema): family_events.imageUrl is a greeting/poster
 * attachment on Pulse — never the Hero. Attachment must not outrank kinship.
 */
export function HomeScreen({
  memberGreeting,
  memberBranchKey,
  memberPhotoUrl,
  memberTreeChildId,
  branchChildren = [],
  error,
  latestEvents = [],
  loading,
  onRetry,
  onOpenEvents,
  onOpenMyCard,
}: HomeScreenProps) {
  const [posterOpen, setPosterOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const publicEvents = useMemo(
    () =>
      latestEvents.filter((event) =>
        isFamilyEventPubliclyVisible({
          type: event.type,
          category: event.category,
          eventDate: event.eventDate,
          date: event.date,
          dateLabel: event.date,
          createdAt: event.createdAt,
          details: event.rawDetails ?? event.details,
          showAt: event.showAt,
          show_at: event.showAt,
          endAt: event.endAt,
          end_at: event.endAt,
          showBeforeDays: event.showBeforeDays,
          show_before_days: event.showBeforeDays,
          manualHidden: event.manualHidden,
          manual_hidden: event.manualHidden,
        }),
      ),
    [latestEvents],
  );

  const branchKeyNorm = String(memberBranchKey || '')
    .trim()
    .toLowerCase();

  const rankedMoments = useMemo(() => {
    const scored = publicEvents.filter(isUsableMoment).map((event) => {
      const sameBranch = sameBranchAsMember(event, branchKeyNorm);
      const aboutYou = aboutMember(event, memberGreeting);
      const happyBoost = event.category === 'happy' ? 1 : 0;
      const score = (aboutYou ? 8 : 0) + (sameBranch ? 4 : 0) + happyBoost;
      return { event, score, created: timestampOf(event.createdAt) };
    });
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.created - a.created;
    });
    return scored.map((row) => row.event);
  }, [publicEvents, branchKeyNorm, memberGreeting]);

  useEffect(() => {
    if (!focusId) return;
    if (!rankedMoments.some((event) => event.id === focusId)) {
      setFocusId(null);
    }
  }, [rankedMoments, focusId]);

  const moment =
    rankedMoments.find((event) => event.id === focusId) ?? rankedMoments[0] ?? null;
  const otherMoments = rankedMoments.filter((event) => event.id !== moment?.id);
  const totalMoments = rankedMoments.length;

  const loggedIn = Boolean(String(memberGreeting || '').trim());
  const greetingFirst = firstNameOnly(memberGreeting);
  const heroPerson = moment ? personShortName(moment.person) || moment.person : '';
  const heroBlessing = moment ? blessingLine(moment) : '';
  const posterUrl = String(moment?.imageUrl || '').trim();
  const kinship = moment ? kinshipHint(moment, memberGreeting, branchKeyNorm) : '';
  const canOpenCard = Boolean(memberTreeChildId && onOpenMyCard);

  const presence = useMemo(() => {
    if (!moment) return null;
    return buildPresenceMarks({
      branchKey: memberBranchKey,
      momentPerson: moment.person,
      memberGreeting,
      children: branchChildren,
    });
  }, [moment, memberBranchKey, memberGreeting, branchChildren]);

  const moreLabel =
    totalMoments === 2 && otherMoments[0]
      ? `أيضًا في أهلك · ${personShortName(otherMoments[0].person) || otherMoments[0].person}`
      : totalMoments >= 3
        ? `${totalMoments} لحظات جديدة في أهلك`
        : '';

  function onPressMore() {
    if (totalMoments === 2 && otherMoments[0]) {
      setFocusId(otherMoments[0].id);
      setPosterOpen(false);
      return;
    }
    if (totalMoments >= 3) {
      if (onOpenEvents) {
        onOpenEvents();
        return;
      }
      const idx = rankedMoments.findIndex((event) => event.id === moment?.id);
      const next = rankedMoments[(idx + 1) % rankedMoments.length];
      if (next) setFocusId(next.id);
    }
  }

  return (
    <SceneShell
      english="FAMILY PULSE"
      eyebrow="حضور العائلة"
      heroLead={
        <View style={styles.greetRow}>
          {loggedIn ? (
            <PersonPhoto
              name={greetingFirst}
              showFallback
              size="sm"
              uri={memberPhotoUrl}
            />
          ) : null}
          <Text style={styles.greetText}>
            {loggedIn && greetingFirst ? `السلام عليكم، ${greetingFirst}` : 'السلام عليكم'}
          </Text>
        </View>
      }
      heroExtra={
        !loading && !error ? (
          moment ? (
            <View style={styles.moment}>
              <Text style={styles.person}>{heroPerson}</Text>
              <GoldDivider />
              {kinship ? <Text style={styles.kinship}>{kinship}</Text> : null}
              <Text style={styles.blessing}>{heroBlessing}</Text>
              {presence ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  pointerEvents="none"
                  style={styles.presence}
                >
                  {Array.from({ length: presence.count }).map((_, index) => {
                    const lit = index === presence.litIndex;
                    return (
                      <View
                        key={`p-${index}`}
                        style={[styles.presenceDot, lit ? styles.presenceDotLit : null]}
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyMoment}>
              <Text style={styles.emptyTitle}>عائلتك معك</Text>
              <Text style={styles.emptyBody}>لا لحظة جديدة اليوم — وهذا طبيعي.</Text>
            </View>
          )
        ) : null
      }
      onRefresh={onRetry}
      refreshing={loading}
      title="أهلاً بك بين أهلك"
      variant="pulse"
    >
      <DataState error={error} loading={loading} onRetry={onRetry} />

      {!moment && !loading && !error && loggedIn && (memberBranchKey || canOpenCard) ? (
        <View style={styles.placeRow}>
          {memberBranchKey ? <Text style={styles.placeBranch}>فرع {memberBranchKey}</Text> : null}
          {memberBranchKey && canOpenCard ? <Text style={styles.placeSep}>·</Text> : null}
          {canOpenCard ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenMyCard}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.placeCard}>فتح بطاقتك</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {posterUrl ? (
        <Pressable
          accessibilityHint="فتح بطاقة التهنئة"
          accessibilityRole="button"
          onPress={() => setPosterOpen(true)}
          style={({ pressed }) => [styles.attachment, pressed && styles.pressed]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: posterUrl }}
            style={styles.attachmentThumb}
          />
          <View style={styles.attachmentText}>
            <Text style={styles.attachmentLabel}>بطاقة التهنئة</Text>
            <Text style={styles.attachmentAction}>فتح</Text>
          </View>
        </Pressable>
      ) : null}

      {moreLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPressMore}
          style={({ pressed }) => [styles.moreLink, pressed && styles.pressed]}
        >
          <Text style={styles.moreText}>{moreLabel}</Text>
        </Pressable>
      ) : null}

      {onOpenEvents ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenEvents}
          style={({ pressed }) => [styles.enterOccasion, pressed && styles.pressed]}
        >
          <Text style={styles.enterOccasionText}>دخول مجلس المناسبات</Text>
        </Pressable>
      ) : null}

      <ImageViewerModal
        onClose={() => setPosterOpen(false)}
        uri={posterUrl}
        visible={posterOpen && Boolean(posterUrl)}
      />
    </SceneShell>
  );
}

const styles = StyleSheet.create({
  greetRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'flex-start',
  },
  greetText: {
    color: 'rgba(232,213,168,0.92)',
    flexShrink: 1,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  moment: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  person: {
    color: scene.creamLift,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 46,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  kinship: {
    color: scene.goldSoft,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  blessing: {
    color: scene.gold,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 30,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  presence: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: 10,
  },
  presenceDot: {
    backgroundColor: scene.goldSoft,
    borderRadius: 999,
    height: 5,
    opacity: 0.28,
    width: 5,
  },
  presenceDotLit: {
    backgroundColor: scene.gold,
    height: 8,
    opacity: 0.95,
    width: 8,
  },
  emptyMoment: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  emptyTitle: {
    color: scene.goldSoft,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyBody: {
    color: 'rgba(232,213,168,0.8)',
    fontSize: typography.body,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  attachment: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    paddingVertical: 4,
  },
  attachmentThumb: {
    backgroundColor: colors.surfaceMuted,
    borderColor: scene.gold,
    borderRadius: 7,
    borderWidth: 1,
    height: 48,
    width: 36,
  },
  attachmentText: {
    alignItems: 'flex-end',
    gap: 2,
  },
  attachmentLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  attachmentAction: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  moreLink: {
    paddingVertical: 4,
  },
  moreText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  enterOccasion: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: scene.gold,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  enterOccasionText: {
    color: scene.green,
    fontSize: 14,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  placeRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: spacing.sm,
  },
  placeBranch: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  placeSep: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  placeCard: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.72,
  },
});
