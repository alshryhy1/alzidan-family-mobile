import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DataState } from '../components/DataState';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';
import type { FamilyEvent } from '../types';
import { eventTypeArabicLabel } from '../utils/eventTypeLabels';
import { isFamilyEventPubliclyVisible } from '../utils/eventVisibility';

type HomeScreenProps = {
  memberGreeting?: string | null;
  memberBranchKey?: string | null;
  error: string | null;
  latestEvents?: FamilyEvent[];
  loading: boolean;
  onRetry: () => void;
  onOpenEvents?: () => void;
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

/**
 * Presentation rule (no schema): family_events.imageUrl is a greeting/poster
 * attachment on Pulse — never the Hero. Attachment must not outrank kinship.
 */
export function HomeScreen({
  memberGreeting,
  memberBranchKey,
  error,
  latestEvents = [],
  loading,
  onRetry,
  onOpenEvents,
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
      const sameBranch =
        !!branchKeyNorm &&
        String(event.branch || '')
          .trim()
          .toLowerCase()
          .includes(branchKeyNorm);
      const aboutYou = aboutMember(event, memberGreeting);
      const happyBoost = event.category === 'happy' ? 1 : 0;
      // You → kinship → (soft) happy → newest. Image never boosts rank.
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
  const others = rankedMoments.filter((event) => event.id !== moment?.id);
  const totalMoments = rankedMoments.length;

  const greetingFirst = firstNameOnly(memberGreeting) || 'بك';
  const heroPerson = moment ? personShortName(moment.person) || moment.person : '';
  const heroBlessing = moment ? blessingLine(moment) : '';
  const posterUrl = String(moment?.imageUrl || '').trim();

  const moreLabel =
    totalMoments === 2 && others[0]
      ? `أيضًا في أهلك · ${personShortName(others[0].person) || others[0].person}`
      : totalMoments >= 3
        ? `${totalMoments} لحظات جديدة في أهلك`
        : '';

  function onPressMore() {
    if (totalMoments === 2 && others[0]) {
      setFocusId(others[0].id);
      setPosterOpen(false);
      return;
    }
    if (totalMoments >= 3) {
      if (onOpenEvents) {
        onOpenEvents();
        return;
      }
      // Cycle quietly if events tab handler is absent
      const idx = rankedMoments.findIndex((event) => event.id === moment?.id);
      const next = rankedMoments[(idx + 1) % rankedMoments.length];
      if (next) setFocusId(next.id);
    }
  }

  return (
    <Screen title="" onRefresh={onRetry} refreshing={loading}>
      <View style={styles.space}>
        <View style={styles.hello}>
          <Text style={styles.salam}>السلام عليكم، {greetingFirst}</Text>
          <Text style={styles.welcome}>أهلاً بك بين أهلك.</Text>
        </View>

        <DataState error={error} loading={loading} onRetry={onRetry} />

        {!loading && !error ? (
          moment ? (
            <View style={styles.moment}>
              <Text style={styles.person}>{heroPerson}</Text>
              <Text style={styles.blessing}>{heroBlessing}</Text>

              {posterUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPosterOpen(true)}
                  style={({ pressed }) => [styles.posterLink, pressed && styles.pressed]}
                >
                  <Text style={styles.posterLinkLabel}>بطاقة التهنئة</Text>
                  <Text style={styles.posterLinkAction}>فتح</Text>
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
            </View>
          ) : (
            <View style={styles.emptyMoment}>
              <Text style={styles.emptyTitle}>عائلتك معك</Text>
              <Text style={styles.emptyBody}>لا لحظة جديدة اليوم — وهذا طبيعي.</Text>
            </View>
          )
        ) : null}
      </View>

      <ImageViewerModal
        caption={heroPerson ? `${heroPerson} · ${heroBlessing}` : undefined}
        onClose={() => setPosterOpen(false)}
        uri={posterUrl}
        visible={posterOpen && Boolean(posterUrl)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  space: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  hello: {
    gap: 6,
  },
  salam: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  welcome: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  moment: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  person: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  blessing: {
    color: colors.textMuted,
    fontSize: typography.title,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  posterLink: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: spacing.md,
    paddingVertical: 4,
  },
  posterLinkLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  posterLinkAction: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  moreLink: {
    marginTop: spacing.lg,
    paddingVertical: 4,
  },
  moreText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.7,
  },
  emptyMoment: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    color: colors.primaryDark,
    fontSize: typography.heading,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
