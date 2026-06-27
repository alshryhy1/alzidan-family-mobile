import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import moment from 'moment-hijri';

import { ActionButton } from '../components/ActionButton';
import { DataState } from '../components/DataState';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing, typography } from '../theme';
import type { FamilyEvent } from '../types';


const countdownTypes = new Set([
  'birth',
  'marriage',
  'graduation',
  'promotion',
  'new_house',
  'gathering',
  'meeting',
  'general',
]);

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function normalizeEventDateText(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\\\-.]/g, '/')
    .trim();
}

function parseEventDay(event: FamilyEvent) {
  const rawGregorian = normalizeEventDateText(event.eventDate || '');

  const ymdMatch = rawGregorian.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdMatch) {
    const [, yearText, monthText, dayText] = ymdMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (year >= 1900) {
      const parsed = Date.parse(`${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      if (Number.isFinite(parsed)) {
        const date = new Date(parsed);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      }
    }

    if (year >= 1300 && year < 1900) {
      const converted = moment(`${year}/${month}/${day}`, 'iYYYY/iM/iD').toDate();
      if (converted instanceof Date && Number.isFinite(converted.getTime())) {
        return new Date(converted.getFullYear(), converted.getMonth(), converted.getDate()).getTime();
      }
    }
  }

  const rawHijri = normalizeEventDateText(event.date || '');
  const hijriMatch = rawHijri.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/);
  if (hijriMatch) {
    const [, first, month, third] = hijriMatch;
    const firstNumber = Number(first);
    const year = firstNumber >= 1300 ? first : third;
    const day = firstNumber >= 1300 ? third : first;
    const converted = moment(`${year}/${month}/${day}`, 'iYYYY/iM/iD').toDate();
    if (converted instanceof Date && Number.isFinite(converted.getTime())) {
      return new Date(converted.getFullYear(), converted.getMonth(), converted.getDate()).getTime();
    }
  }

  return null;
}

function eventDaysFromNow(event: FamilyEvent) {
  const day = parseEventDay(event);
  if (day === null) return null;
  return Math.round((day - startOfToday()) / (24 * 60 * 60 * 1000));
}

function countdownText(event: FamilyEvent) {
  const diffDays = eventDaysFromNow(event);
  if (diffDays === null) return '';
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'غداً';
  if (diffDays === 2) return 'بعد يومين';
  if (diffDays >= 3 && diffDays <= 10) return `بعد ${diffDays} أيام`;
  return `بعد ${diffDays} يوماً`;
}

function isCountdownEvent(event: FamilyEvent) {
  const diffDays = eventDaysFromNow(event);
  return Boolean(
    event.category === 'happy' &&
      event.type &&
      countdownTypes.has(event.type) &&
      diffDays !== null &&
      diffDays >= 0 &&
      diffDays <= 7,
  );
}

function sortUpcomingEvents(events: FamilyEvent[]) {
  return [...events]
    .filter(isCountdownEvent)
    .sort((a, b) => (parseEventDay(a) ?? 0) - (parseEventDay(b) ?? 0));
}

type HomeScreenProps = {
  branchesCount: number;
  error: string | null;
  latestEvent: FamilyEvent | null;
  latestEvents?: FamilyEvent[];
  upcomingEvents?: FamilyEvent[];
  bannerMessages?: string[];
  tickerSpeedSeconds?: number;
  loading: boolean;
  membersCount: number;
  onOpenBranches: () => void;
  onOpenEvents: () => void;
  onOpenTree: () => void;
  onRetry: () => void;
};

export function HomeScreen({
  branchesCount,
  error,
  latestEvent,
  latestEvents = latestEvent ? [latestEvent] : [],
  upcomingEvents = [],
  bannerMessages = [],
  tickerSpeedSeconds = 3,
  loading,
  membersCount,
  onOpenBranches,
  onOpenEvents,
  onOpenTree,
  onRetry,
}: HomeScreenProps) {
  const tickerX = useRef(new Animated.Value(0)).current;
  const [tickerWidth, setTickerWidth] = useState(0);
  const fallbackTickerText =
    'الحمد لله الذي بنعمته تتم الصالحات — تم بحمد الله اكتمال تطبيق عائلة الزيدان وسيكون في هذا الشريط أخبار العائلة';
  const latestEventText = latestEvent
    ? `${latestEvent.title}: ${latestEvent.person}${latestEvent.date ? ` — ${latestEvent.date}` : ''}`
    : '';
  const bannerText = bannerMessages.length ? bannerMessages.join('     •     ') : '';
  const tickerText = bannerText || latestEventText || fallbackTickerText;
  const sortedUpcomingEvents = sortUpcomingEvents(upcomingEvents);
  const nearestUpcomingEvent = sortedUpcomingEvents[0] ?? null;
  const upcomingIds = new Set(sortedUpcomingEvents.map((event) => event.id));
  const visibleNewsEvents = latestEvents.filter((event) => !upcomingIds.has(event.id));

  useEffect(() => {
    if (!tickerWidth) return;
    tickerX.setValue(-(tickerWidth + spacing.lg));
    const animation = Animated.loop(
      Animated.timing(tickerX, {
        duration: Math.max(1000, Math.min(120000, Number(tickerSpeedSeconds || 30) * 1000)),
        easing: Easing.linear,
        toValue: 0,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [tickerText, tickerWidth, tickerX, tickerSpeedSeconds]);

  return (
    <Screen
      title="أهلًا بكم"
      description="استعرض بيانات عائلة الزيدان العامة من المصدر المعتمد."
      onRefresh={onRetry}
      refreshing={loading}
    >
      <View style={styles.ticker}>
        <Text style={styles.tickerLabel}>آخر خبر:</Text>
        <View style={styles.tickerViewport}>
          <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: tickerX }] }]}>
            <Text
              numberOfLines={1}
              onLayout={(event) => {
                const w = event.nativeEvent.layout.width;
                console.log('TICKER_WIDTH=', w);
                setTickerWidth(w);
              }}
              style={styles.tickerText}
            >
              {tickerText}
            </Text>
            <Text numberOfLines={1} style={styles.tickerText}>
              {tickerText}
            </Text>
          </Animated.View>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>ذرية مطلق بن زيدان</Text>
        <Text style={styles.heroTitle}>شجرة العائلة في مكان واحد</Text>
        <Text style={styles.heroBody}>
          استعرض الفروع، تعرف على تسلسل الشجرة، وتابع أخبار ومناسبات العائلة.
        </Text>
        <View style={styles.actions}>
          <ActionButton label="استعراض الشجرة" onPress={onOpenTree} />
          <ActionButton label="عرض الفروع" onPress={onOpenBranches} variant="secondary" />
        </View>
      </View>

      <DataState error={error} loading={loading} onRetry={onRetry} />

      {!loading && !error && nearestUpcomingEvent ? (
        <SectionCard eyebrow="خلال 7 أيام القادمة" title="المناسبات القريبة">
          <View style={styles.countdownCard}>
            <View style={styles.countdownHeader}>
              <Text style={styles.countdownBadge}>{nearestUpcomingEvent.title}</Text>
              <Text style={styles.countdownValue}>{countdownText(nearestUpcomingEvent)}</Text>
            </View>
            <Text style={styles.countdownPerson}>{nearestUpcomingEvent.person}</Text>
            <Text style={styles.countdownDate}>
              {nearestUpcomingEvent.date || nearestUpcomingEvent.eventDate || 'دون تاريخ'}
            </Text>
          </View>

          {sortedUpcomingEvents.slice(1, 7).map((event) => (
            <View key={event.id} style={styles.upcomingItem}>
              <Text style={styles.upcomingCountdown}>{countdownText(event)}</Text>
              <View style={styles.upcomingText}>
                <Text style={styles.upcomingTitle}>{event.title}</Text>
                <Text style={styles.upcomingPerson}>{event.person}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {!loading && !error && visibleNewsEvents.length ? (
        <SectionCard eyebrow="آخر الأخبار النشطة" title="الأخبار والمناسبات الظاهرة حالياً">
          {visibleNewsEvents.slice(0, 3).map((event) => (
            <View key={event.id} style={styles.latestEventItem}>
              <View style={styles.latestEventHeader}>
                <Text style={styles.latestEventBadge}>{event.categoryLabel}</Text>
                <Text style={styles.latestEventDate}>{event.date || 'دون تاريخ'}</Text>
              </View>
              <Text style={styles.latestEventPerson}>{event.person}</Text>
              {event.details ? (
                <Text numberOfLines={3} style={styles.latestEventDetails}>
                  {event.details}
                </Text>
              ) : null}
            </View>
          ))}
          <View style={styles.actions}>
            <ActionButton label="عرض كل المناسبات" onPress={onOpenEvents} variant="secondary" />
          </View>
        </SectionCard>
      ) : null}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{branchesCount}</Text>
          <Text style={styles.statLabel}>فروع رئيسية</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{membersCount}</Text>
          <Text style={styles.statLabel}>سجلًا في الشجرة</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{latestEvents.length}</Text>
          <Text style={styles.statLabel}>مناسبات نشطة</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ticker: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tickerLabel: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  tickerViewport: {
    flex: 1,
    height: 20,
    overflow: 'hidden',
  },
  tickerTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    position: 'absolute',
    right: 0,
  },
  tickerText: {
    color: colors.text,
    flexShrink: 0,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: 28,
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroEyebrow: {
    color: '#DABF8A',
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroTitle: {
    color: colors.white,
    fontSize: typography.display,
    fontWeight: '900',
    lineHeight: 40,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroBody: {
    color: '#DCE8E3',
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  latestEventItem: {
    borderBottomColor: 'rgba(15,23,42,0.08)',
    borderBottomWidth: 1,
    gap: 6,
    marginBottom: 14,
    paddingBottom: 14,
  },
  latestEventHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  latestEventBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    writingDirection: 'rtl',
  },
  latestEventDate: {
    color: colors.textMuted,
    fontSize: typography.caption,
    writingDirection: 'rtl',
  },
  latestEventPerson: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  latestEventDetails: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  countdownCard: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  countdownHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  countdownBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    writingDirection: 'rtl',
  },
  countdownValue: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  countdownPerson: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  countdownDate: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  upcomingItem: {
    alignItems: 'center',
    borderTopColor: 'rgba(15,23,42,0.08)',
    borderTopWidth: 1,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  upcomingCountdown: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    minWidth: 84,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  upcomingText: {
    flex: 1,
  },
  upcomingTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  upcomingPerson: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stats: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: 18,
    flex: 1,
    gap: 4,
    padding: spacing.md,
  },
  statNumber: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
