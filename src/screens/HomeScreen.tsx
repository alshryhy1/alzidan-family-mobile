import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import moment from 'moment-hijri';

import { ActionButton } from '../components/ActionButton';
import { DataState } from '../components/DataState';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';
import type { FamilyEvent, MemberRequest } from '../types';
import { formatVisitTimeRangeAr } from '../utils/formatVisitTimeAr';
import { isFamilyEventPubliclyVisible } from '../utils/eventVisibility';
import { buildHomeTickerItems, logHomeTickerCandidates } from '../utils/homeTicker';

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
  memberGreeting?: string | null;
  memberRequests?: MemberRequest[];
  branchesCount: number;
  error: string | null;
  latestEvent: FamilyEvent | null;
  latestEvents?: FamilyEvent[];
  upcomingEvents?: FamilyEvent[];
  bannerMessages?: string[];
  specialCardTickerItems?: string[];
  tickerSpeedSeconds?: number;
  loading: boolean;
  membersCount: number;
  onOpenEvents: () => void;
  onOpenProfile: () => void;
  onOpenAdditions: (intent: 'person' | 'correction') => void;
  onRetry: () => void;
};

function requestStatusLabel(status: string) {
  const value = String(status || '').trim();
  if (value === 'approved') return 'مقبول';
  if (value === 'rejected') return 'مرفوض';
  return 'بانتظار المراجعة';
}

function requestStatusStyle(status: string) {
  const value = String(status || '').trim();
  if (value === 'approved') return { bg: '#DCFCE7', text: '#14532D' };
  if (value === 'rejected') return { bg: '#FEE2E2', text: '#7F1D1D' };
  return { bg: '#FEF3C7', text: '#78350F' };
}

function formatDateShort(value?: string) {
  if (!value) return '';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleDateString('ar-SA');
}

function requestKindLabel(kind: string) {
  const value = String(kind || '').trim().toLowerCase();
  if (value === 'event_card' || value === 'family_event' || value === 'event_request') return 'مناسبة';
  if (value === 'tree_card' || value === 'add_person') return 'إضافة فرد';
  if (value === 'tree_edit') return 'تصحيح بيانات';
  if (value === 'memory_card' || value === 'memory') return 'ذكرى';
  if (value === 'special_card') return 'طلب بطاقة';
  return 'طلب';
}

function timestampOf(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function momentPlaceLine(event: FamilyEvent) {
  if (event.category === 'health') {
    const parts = [
      event.hospitalName ? `المستشفى: ${event.hospitalName}` : '',
      event.hospitalDepartment ? `القسم: ${event.hospitalDepartment}` : '',
    ].filter(Boolean);
    if (
      event.contactMethod === 'visit' &&
      (event.visitDateFrom || event.visitDateTo || event.visitTimeFrom || event.visitTimeTo)
    ) {
      const visit = [
        event.visitDateFrom && event.visitDateTo
          ? `من ${event.visitDateFrom} إلى ${event.visitDateTo}`
          : event.visitDateFrom || event.visitDateTo || '',
        formatVisitTimeRangeAr(event.visitTimeFrom, event.visitTimeTo),
      ]
        .filter(Boolean)
        .join(' – ');
      if (visit) parts.push(`الزيارة: ${visit}`);
    }
    return parts.join('\n');
  }
  return '';
}

export function HomeScreen({
  memberGreeting,
  memberRequests = [],
  branchesCount,
  error,
  latestEvent,
  latestEvents = latestEvent ? [latestEvent] : [],
  upcomingEvents = [],
  bannerMessages = [],
  specialCardTickerItems = [],
  tickerSpeedSeconds = 3,
  loading,
  membersCount,
  onOpenEvents,
  onOpenProfile,
  onOpenAdditions,
  onRetry,
}: HomeScreenProps) {
  const tickerX = useRef(new Animated.Value(0)).current;
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const fallbackTickerText =
    'الحمد لله الذي بنعمته تتم الصالحات — تم بحمد الله اكتمال تطبيق عائلة الزيدان وسيكون في هذا الشريط أخبار العائلة';
  const tickerGap = spacing.lg;
  const publicLatestEvents = latestEvents.filter((event) =>
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
  );
  const tickerBuild = buildHomeTickerItems({
    events: publicLatestEvents,
    bannerMessages,
    specialCardTickerItems,
    maxFamilyEvents: 6,
  });
  logHomeTickerCandidates('HomeScreen', tickerBuild, {
    latestEventsCount: publicLatestEvents.length,
  });
  const tickerItems = tickerBuild.items;
  const tickerText = tickerItems.length ? tickerItems.join('     •     ') : fallbackTickerText;
  const needsScroll = segmentWidth > viewportWidth + 8;
  const tickerStep = segmentWidth + tickerGap;
  const sortedUpcomingEvents = sortUpcomingEvents(publicLatestEvents);
  const nearestUpcomingEvent = sortedUpcomingEvents[0] ?? null;
  const upcomingIds = new Set(sortedUpcomingEvents.map((event) => event.id));
  const visibleNewsEvents = publicLatestEvents.filter((event) => !upcomingIds.has(event.id));
  const livingEvent = nearestUpcomingEvent ?? visibleNewsEvents[0] ?? null;
  const sortedMemberRequests = [...memberRequests].sort(
    (a, b) => timestampOf(b.createdAt) - timestampOf(a.createdAt),
  );
  const pendingNow = memberRequests.filter((item) => item.status === 'pending').length;
  const approvedRequestsCount = memberRequests.filter((item) => item.status === 'approved').length;
  const rejectedRequestsCount = memberRequests.filter((item) => item.status === 'rejected').length;

  useEffect(() => {
    setSegmentWidth(0);
    tickerX.setValue(0);
  }, [tickerText, tickerX]);

  useEffect(() => {
    if (!needsScroll || !tickerStep || !viewportWidth) {
      tickerX.setValue(0);
      return;
    }
    let alive = true;
    let anim: Animated.CompositeAnimation | null = null;
    // Speed scales with content length (closer to web marquee behavior).
    // tickerSpeedSeconds remains an optional global scale (default 30 ≈ baseline).
    const speedScale = Math.max(0.5, Math.min(2.5, 30 / Math.max(Number(tickerSpeedSeconds) || 30, 1)));
    const pxPerSecond = 42 * speedScale;
    const duration = Math.max(
      6000,
      Math.min(180000, Math.round((tickerStep / pxPerSecond) * 1000)),
    );
    const run = () => {
      if (!alive) return;
      tickerX.setValue(0);
      anim = Animated.timing(tickerX, {
        duration,
        easing: Easing.linear,
        toValue: -tickerStep,
        useNativeDriver: true,
      });
      anim.start(({ finished }) => {
        if (!alive || !finished) return;
        tickerX.setValue(0);
        run();
      });
    };
    run();
    return () => {
      alive = false;
      anim?.stop();
    };
  }, [needsScroll, tickerStep, tickerText, tickerX, viewportWidth, tickerSpeedSeconds]);

  const greetingName = String(memberGreeting || '').trim();
  const placeLine = livingEvent ? momentPlaceLine(livingEvent) : '';
  const whenLine = livingEvent
    ? nearestUpcomingEvent
      ? [countdownText(nearestUpcomingEvent), nearestUpcomingEvent.date || nearestUpcomingEvent.eventDate]
          .filter(Boolean)
          .join(' · ')
      : livingEvent.date || livingEvent.eventDate || ''
    : '';

  return (
    <Screen
      title={greetingName ? `مرحباً ${greetingName}` : 'أهلًا بكم'}
      description={greetingName ? undefined : 'أخبار العائلة ومناسباتها في مكان هادئ.'}
      onRefresh={onRetry}
      refreshing={loading}
    >
      <View style={styles.ticker}>
        <View
          pointerEvents="none"
          style={styles.tickerMeasureHost}
        >
          <Text
            onLayout={(event) => {
              const measuredWidth = Math.ceil(event.nativeEvent.layout.width);
              setSegmentWidth((currentWidth) =>
                Math.abs(currentWidth - measuredWidth) > 0.5 ? measuredWidth : currentWidth,
              );
            }}
            style={styles.tickerText}
          >
            {tickerText}
          </Text>
        </View>
        <View
          onLayout={(event) => {
            const width = Math.round(event.nativeEvent.layout.width);
            setViewportWidth((current) => (Math.abs(current - width) > 0.5 ? width : current));
          }}
          style={styles.tickerViewport}
        >
          {needsScroll ? (
            <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: tickerX }] }]}>
              <View style={styles.tickerSegment}>
                <Text
                  numberOfLines={1}
                  style={[styles.tickerText, segmentWidth ? { width: segmentWidth } : null]}
                >
                  {tickerText}
                </Text>
              </View>
              <View
                importantForAccessibility="no-hide-descendants"
                style={[styles.tickerSegment, { marginLeft: tickerGap }]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.tickerText, segmentWidth ? { width: segmentWidth } : null]}
                >
                  {tickerText}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <Text numberOfLines={1} style={[styles.tickerText, styles.tickerTextStatic]}>
              {tickerText}
            </Text>
          )}
        </View>
      </View>

      <DataState error={error} loading={loading} onRetry={onRetry} />

      {!loading && !error ? (
        <View style={styles.momentCard}>
          {livingEvent ? (
            <>
              <Text style={styles.momentEyebrow}>
                {nearestUpcomingEvent ? 'القادم في العائلة' : livingEvent.categoryLabel || 'اليوم في العائلة'}
              </Text>
              <Text style={styles.momentTitle}>{livingEvent.title}</Text>
              {livingEvent.person ? <Text style={styles.momentPerson}>{livingEvent.person}</Text> : null}
              {whenLine ? <Text style={styles.momentMeta}>{whenLine}</Text> : null}
              {placeLine ? <Text style={styles.momentMeta}>{placeLine}</Text> : null}
              {livingEvent.details && !nearestUpcomingEvent ? (
                <Text numberOfLines={3} style={styles.momentDetails}>
                  {livingEvent.details}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.momentEyebrow}>اليوم في العائلة</Text>
              <Text style={styles.momentTitle}>لا توجد مناسبة ظاهرة الآن</Text>
              <Text style={styles.momentMeta}>عند صدور خبر جديد سيظهر هنا.</Text>
            </>
          )}
          <ActionButton label="عرض المناسبات" onPress={onOpenEvents} variant="secondary" />
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={styles.requestsShell}>
          <Pressable
            onPress={() => setRequestsOpen((value) => !value)}
            style={({ pressed }) => [styles.requestsHeader, pressed && styles.pressed]}
          >
            <Text style={styles.requestsCaret}>{requestsOpen ? '⌃' : '⌄'}</Text>
            <View style={styles.requestsHeaderText}>
              <Text style={styles.requestsTitle}>طلباتي</Text>
              <Text style={styles.requestsSummary}>
                بانتظار {pendingNow} · مقبول {approvedRequestsCount} · مرفوض {rejectedRequestsCount}
              </Text>
            </View>
          </Pressable>

          {requestsOpen ? (
            <View style={styles.requestsList}>
              {sortedMemberRequests.length ? (
                sortedMemberRequests.slice(0, 5).map((item) => {
                  const statusUi = requestStatusStyle(item.status);
                  return (
                    <View key={item.id} style={styles.requestItem}>
                      <View style={styles.requestHead}>
                        <View style={[styles.requestStatusPill, { backgroundColor: statusUi.bg }]}>
                          <Text style={[styles.requestStatusText, { color: statusUi.text }]}>
                            {requestStatusLabel(item.status)}
                          </Text>
                        </View>
                        <Text style={styles.requestKind}>{requestKindLabel(item.kind)}</Text>
                      </View>
                      <Text style={styles.requestMeta}>
                        {formatDateShort(item.createdAt) || 'تاريخ الإرسال غير متاح'}
                      </Text>
                      {item.status === 'rejected' ? (
                        <Text style={styles.requestMeta}>{item.rejectionReason || 'لم يذكر سبب'}</Text>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.requestsEmpty}>لا توجد طلبات حتى الآن.</Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.shortcutsRow}>
        <Pressable
          onPress={() => onOpenAdditions('person')}
          style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
        >
          <Text style={styles.shortcutLabel}>أضف فردًا</Text>
        </Pressable>
        <Pressable
          onPress={() => onOpenAdditions('correction')}
          style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
        >
          <Text style={styles.shortcutLabel}>صحّح بيانات</Text>
        </Pressable>
        <Pressable onPress={onOpenProfile} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
          <Text style={styles.shortcutLabel}>بطاقتي</Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{branchesCount}</Text>
          <Text style={styles.statLabel}>فروع</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{membersCount}</Text>
          <Text style={styles.statLabel}>في الشجرة</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{publicLatestEvents.length}</Text>
          <Text style={styles.statLabel}>مناسبات ظاهرة</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ticker: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 48,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  tickerMeasureHost: {
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    zIndex: -1,
  },
  tickerViewport: {
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  tickerSegment: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    height: 32,
    justifyContent: 'center',
  },
  tickerTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    height: 32,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  tickerText: {
    color: colors.text,
    flexGrow: 0,
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 20,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  tickerTextStatic: {
    maxWidth: '100%',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  momentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  momentEyebrow: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  momentTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  momentPerson: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  momentMeta: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  momentDetails: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestsShell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  requestsHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  requestsHeaderText: {
    flex: 1,
    gap: 2,
  },
  requestsTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestsSummary: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestsCaret: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  requestsList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  requestItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    gap: 4,
    padding: spacing.sm,
  },
  requestHead: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  requestKind: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  requestStatusPill: {
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  requestStatusText: {
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  requestMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestsEmpty: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  shortcutsRow: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
  },
  shortcut: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  shortcutLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.75,
  },
  stats: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  statNumber: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
