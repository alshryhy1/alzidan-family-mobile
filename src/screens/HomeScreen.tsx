import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment-hijri';

import { ActionButton } from '../components/ActionButton';
import { DataState } from '../components/DataState';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing, typography } from '../theme';
import type { FamilyEvent, MemberRequest, PublicAffinityStats } from '../types';


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

function normalizeTickerText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

type HomeScreenProps = {
  memberGreeting?: string | null;
  memberRequests?: MemberRequest[];
  branchesCount: number;
  affinityStats: PublicAffinityStats;
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
  onOpenProfile: () => void;
  onOpenTree: () => void;
  onRetry: () => void;
};

function requestStatusLabel(status: string) {
  const value = String(status || '').trim();
  if (value === 'approved') return 'تمت الموافقة';
  if (value === 'rejected') return 'مرفوض';
  return 'تحت المراجعة';
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
  if (kind === 'event_card') return 'مناسبة';
  if (kind === 'tree_card') return 'تصحيح شجرة';
  return 'طلب';
}

function timestampOf(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildWeeklyInsightText({
  submittedThisWeek,
  decidedThisWeek,
  pendingNow,
  upcomingThisWeek,
  latestNewsThisWeek,
}: {
  submittedThisWeek: number;
  decidedThisWeek: number;
  pendingNow: number;
  upcomingThisWeek: number;
  latestNewsThisWeek: number;
}) {
  if (pendingNow > 0) {
    return `لديك ${pendingNow} طلب${pendingNow > 1 ? 'ات' : ''} قيد المراجعة حالياً.`;
  }
  if (submittedThisWeek > 0 && decidedThisWeek === 0) {
    return 'تم إرسال طلبات هذا الأسبوع وبانتظار صدور القرار.';
  }
  if (upcomingThisWeek > 0) {
    return `هناك ${upcomingThisWeek} مناسبة قريبة خلال الأيام القادمة.`;
  }
  if (latestNewsThisWeek > 0) {
    return `تمت إضافة ${latestNewsThisWeek} خبر هذا الأسبوع.`;
  }
  return 'الأسبوع هادئ حالياً، يمكنك متابعة صفحة المناسبات للاطلاع على الجديد.';
}

function isWithinLast7Days(value?: string) {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const today = startOfToday();
  const sevenDaysAgo = today - 6 * 24 * 60 * 60 * 1000;
  return parsed >= sevenDaysAgo && parsed <= today + 24 * 60 * 60 * 1000 - 1;
}

function isWithinPrevious7Days(value?: string) {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const today = startOfToday();
  const currentWeekStart = today - 6 * 24 * 60 * 60 * 1000;
  const previousWeekStart = currentWeekStart - 7 * 24 * 60 * 60 * 1000;
  const previousWeekEnd = currentWeekStart - 1;
  return parsed >= previousWeekStart && parsed <= previousWeekEnd;
}

function trendText(current: number, previous: number) {
  const diff = current - previous;
  if (diff > 0) return `↑ +${diff}`;
  if (diff < 0) return `↓ ${diff}`;
  return '→ 0';
}

export function HomeScreen({
  memberGreeting,
  memberRequests = [],
  branchesCount,
  affinityStats,
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
  onOpenProfile,
  onOpenTree,
  onRetry,
}: HomeScreenProps) {
  const screenScrollRef = useRef<ScrollView | null>(null);
  const wasLoadingRef = useRef(false);
  const tickerX = useRef(new Animated.Value(0)).current;
  const [tickerWidth, setTickerWidth] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const fallbackTickerText =
    'الحمد لله الذي بنعمته تتم الصالحات — تم بحمد الله اكتمال تطبيق عائلة الزيدان وسيكون في هذا الشريط أخبار العائلة';
  const eventTickerItems = latestEvents
    .slice(0, 6)
    .map((event) => `${event.title}: ${event.person}${event.date ? ` — ${event.date}` : ''}`);
  const tickerItems = [...bannerMessages, ...eventTickerItems].map(normalizeTickerText).filter(Boolean);
  const tickerText = tickerItems.length ? tickerItems.join('     •     ') : fallbackTickerText;
  const tickerStep = tickerWidth + spacing.lg;
  const sortedUpcomingEvents = sortUpcomingEvents(upcomingEvents);
  const nearestUpcomingEvent = sortedUpcomingEvents[0] ?? null;
  const upcomingIds = new Set(sortedUpcomingEvents.map((event) => event.id));
  const visibleNewsEvents = latestEvents.filter((event) => !upcomingIds.has(event.id));
  const topInsideBranches = affinityStats.topInsideBranches.slice(0, 5);
  const sortedMemberRequests = [...memberRequests].sort((a, b) => timestampOf(b.createdAt) - timestampOf(a.createdAt));
  const latestMemberRequests = sortedMemberRequests.slice(0, 3);
  const approvedRequestsCount = memberRequests.filter((item) => item.status === 'approved').length;
  const rejectedRequestsCount = memberRequests.filter((item) => item.status === 'rejected').length;
  const submittedThisWeek = memberRequests.filter((item) => isWithinLast7Days(item.createdAt)).length;
  const submittedPreviousWeek = memberRequests.filter((item) => isWithinPrevious7Days(item.createdAt)).length;
  const decidedThisWeek = memberRequests.filter(
    (item) =>
      (item.status === 'approved' || item.status === 'rejected') &&
      isWithinLast7Days(item.decisionDate),
  ).length;
  const decidedPreviousWeek = memberRequests.filter(
    (item) =>
      (item.status === 'approved' || item.status === 'rejected') &&
      isWithinPrevious7Days(item.decisionDate),
  ).length;
  const pendingNow = memberRequests.filter((item) => item.status === 'pending').length;
  const upcomingThisWeek = sortedUpcomingEvents.length;
  const latestNewsThisWeek = visibleNewsEvents.filter((event) => isWithinLast7Days(event.createdAt)).length;
  const weeklyInsightText = buildWeeklyInsightText({
    decidedThisWeek,
    latestNewsThisWeek,
    pendingNow,
    submittedThisWeek,
    upcomingThisWeek,
  });
  const [requestsShortcutActive, setRequestsShortcutActive] = useState(false);
  const [todayShortcutActive, setTodayShortcutActive] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showWeeklyDetails, setShowWeeklyDetails] = useState(false);
  const [showAffinityDetails, setShowAffinityDetails] = useState(false);
  const [requestsSectionY, setRequestsSectionY] = useState(0);
  const [todaySectionY, setTodaySectionY] = useState(0);
  const visibleMemberRequests = showAllRequests ? latestMemberRequests : latestMemberRequests.slice(0, 1);

  const scrollToY = (y: number) => {
    const safeY = Math.max(0, y - spacing.sm);
    screenScrollRef.current?.scrollTo({ animated: true, y: safeY });
  };

  const focusRequestsSection = () => {
    setRequestsShortcutActive(true);
    if (requestsSectionY > 0) scrollToY(requestsSectionY);
  };

  const focusTodaySection = () => {
    setTodayShortcutActive(true);
    if (todaySectionY > 0) scrollToY(todaySectionY);
  };

  useEffect(() => {
    if (!requestsShortcutActive) return;
    const timer = setTimeout(() => setRequestsShortcutActive(false), 1600);
    return () => clearTimeout(timer);
  }, [requestsShortcutActive]);

  useEffect(() => {
    if (!todayShortcutActive) return;
    const timer = setTimeout(() => setTodayShortcutActive(false), 1600);
    return () => clearTimeout(timer);
  }, [todayShortcutActive]);

  useEffect(() => {
    if (!tickerStep) return;
    tickerX.setValue(-tickerStep);
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
  }, [tickerText, tickerStep, tickerX, tickerSpeedSeconds]);

  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
      return;
    }

    if (!error && (wasLoadingRef.current || !lastUpdatedAt)) {
      setLastUpdatedAt(new Date());
    }

    wasLoadingRef.current = false;
  }, [error, lastUpdatedAt, loading]);

  const lastUpdatedLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <Screen
      scrollRef={screenScrollRef}
      title={memberGreeting ? '' : 'أهلًا بكم'}
      description={memberGreeting ? undefined : 'استعرض بيانات عائلة الزيدان العامة من المصدر المعتمد.'}
      onRefresh={onRetry}
      refreshing={loading}
    >
      {memberGreeting ? (
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.memberTitleLine}>
          <Text style={styles.memberTitleHello}>مرحباً: </Text>
          <Text style={styles.memberTitleName}>{memberGreeting}</Text>
        </Text>
      ) : null}

      <View style={styles.refreshMetaBar}>
        <Text style={styles.refreshMetaText}>
          {loading ? 'جاري تحديث البيانات...' : `آخر تحديث: ${lastUpdatedLabel}`}
        </Text>
      </View>

      <View style={styles.ticker}>
        <Text style={styles.tickerLabel}>آخر خبر:</Text>
        <View style={styles.tickerViewport}>
          <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: tickerX }] }]}>
            <Text
              ellipsizeMode="clip"
              numberOfLines={1}
              onLayout={(event) => {
                const measuredWidth = Math.ceil(event.nativeEvent.layout.width);
                setTickerWidth((currentWidth) =>
                  Math.abs(currentWidth - measuredWidth) > 1 ? measuredWidth : currentWidth,
                );
              }}
              style={styles.tickerText}
            >
              {tickerText}
            </Text>
            <Text ellipsizeMode="clip" numberOfLines={1} style={styles.tickerText}>
              {tickerText}
            </Text>
            <Text ellipsizeMode="clip" numberOfLines={1} style={styles.tickerText}>
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

      <SectionCard eyebrow="اختصارات" title="وصول سريع">
        <View style={styles.shortcutsGrid}>
          <Pressable onPress={onOpenProfile} style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.75 }]}>
            <Text style={styles.shortcutIcon}>i</Text>
            <Text style={styles.shortcutLabel}>بطاقتي</Text>
          </Pressable>

          <Pressable
            onPress={focusRequestsSection}
            style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.shortcutIcon}>◈</Text>
            <Text style={styles.shortcutLabel}>طلباتي</Text>
          </Pressable>

          <Pressable onPress={onOpenBranches} style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.75 }]}> 
            <Text style={styles.shortcutIcon}>⌘</Text>
            <Text style={styles.shortcutLabel}>متابعة الفروع</Text>
          </Pressable>

          <Pressable onPress={focusTodaySection} style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.75 }]}> 
            <Text style={styles.shortcutIcon}>★</Text>
            <Text style={styles.shortcutLabel}>اليوم في العائلة</Text>
          </Pressable>
        </View>

        {requestsShortcutActive || todayShortcutActive ? (
          <View style={styles.shortcutHint}>
            <Text style={styles.shortcutHintText}>
              {requestsShortcutActive ? 'تم إبراز قسم "حالة طلباتي" أسفل الصفحة.' : 'تم إبراز بطاقة "اليوم في العائلة".'}
            </Text>
          </View>
        ) : null}
      </SectionCard>

      <DataState error={error} loading={loading} onRetry={onRetry} />

      {!loading && !error ? (
        <View
          onLayout={(event) => {
            setRequestsSectionY(event.nativeEvent.layout.y);
          }}
        >
        <SectionCard eyebrow="متابعة شخصية" title="حالة طلباتي">
          <View style={styles.requestSummaryRow}>
            <View style={[styles.requestSummaryChip, styles.requestSummaryChipPending]}>
              <Text style={styles.requestSummaryChipValue}>{pendingNow}</Text>
              <Text style={styles.requestSummaryChipLabel}>قيد المراجعة</Text>
            </View>

            <View style={[styles.requestSummaryChip, styles.requestSummaryChipApproved]}>
              <Text style={styles.requestSummaryChipValue}>{approvedRequestsCount}</Text>
              <Text style={styles.requestSummaryChipLabel}>تمت الموافقة</Text>
            </View>

            <View style={[styles.requestSummaryChip, styles.requestSummaryChipRejected]}>
              <Text style={styles.requestSummaryChipValue}>{rejectedRequestsCount}</Text>
              <Text style={styles.requestSummaryChipLabel}>مرفوض</Text>
            </View>
          </View>

          <View style={[styles.requestsBlock, requestsShortcutActive && styles.requestsBlockHighlighted]}>
          {visibleMemberRequests.length ? (
            visibleMemberRequests.map((item) => {
              const statusUi = requestStatusStyle(item.status);
              const statusText = requestStatusLabel(item.status);
              const decisionDate = formatDateShort(item.decisionDate);
              const createdAt = formatDateShort(item.createdAt);

              return (
                <View key={item.id} style={styles.requestItem}>
                  <View style={styles.requestHead}>
                    <Text style={styles.requestKind}>{requestKindLabel(item.kind)}</Text>
                    <Text style={styles.requestId}>{item.requestId}</Text>
                  </View>

                  <View style={[styles.requestStatusPill, { backgroundColor: statusUi.bg }]}> 
                    <Text style={[styles.requestStatusText, { color: statusUi.text }]}>{statusText}</Text>
                  </View>

                  <View style={styles.requestMetaRow}>
                    <Text style={styles.requestMetaValue}>{createdAt || 'غير متاح'}</Text>
                    <Text style={styles.requestMetaLabel}>تاريخ الإرسال</Text>
                  </View>

                  <View style={styles.requestMetaRow}>
                    <Text style={styles.requestMetaValue}>{decisionDate || 'بانتظار القرار'}</Text>
                    <Text style={styles.requestMetaLabel}>تاريخ القرار</Text>
                  </View>

                  {item.status === 'rejected' ? (
                    <View style={styles.requestMetaRow}>
                      <Text style={styles.requestMetaValue}>{item.rejectionReason || 'لم يذكر سبب'}</Text>
                      <Text style={styles.requestMetaLabel}>سبب الرفض</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.requestsEmptyCard}>
              <Text style={styles.requestsEmptyTitle}>لا توجد طلبات حتى الآن</Text>
              <Text style={styles.requestsEmptyBody}>عند إرسال أول طلب سيظهر هنا مع حالة المتابعة.</Text>
            </View>
          )}

          {latestMemberRequests.length > 1 ? (
            <Pressable
              onPress={() => setShowAllRequests((value) => !value)}
              style={({ pressed }) => [styles.inlineToggle, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.inlineToggleText}>{showAllRequests ? 'إظهار أقل' : 'عرض آخر 3 طلبات'}</Text>
            </Pressable>
          ) : null}

          </View>
        </SectionCard>
        </View>
      ) : null}

      {!loading && !error ? (
        <View
          onLayout={(event) => {
            setTodaySectionY(event.nativeEvent.layout.y);
          }}
        >
        <SectionCard eyebrow="اليوم في العائلة" title="بطاقة واحدة لليوم">
          <View style={[styles.todayCard, todayShortcutActive && styles.todayCardHighlighted]}>
            {nearestUpcomingEvent ? (
              <>
                <View style={styles.countdownHeader}>
                  <Text style={styles.countdownBadge}>{nearestUpcomingEvent.title}</Text>
                  <Text style={styles.countdownValue}>{countdownText(nearestUpcomingEvent)}</Text>
                </View>
                <Text style={styles.countdownPerson}>{nearestUpcomingEvent.person}</Text>
                <Text style={styles.countdownDate}>{nearestUpcomingEvent.date || nearestUpcomingEvent.eventDate || 'دون تاريخ'}</Text>
              </>
            ) : visibleNewsEvents.length ? (
              <>
                <View style={styles.latestEventHeader}>
                  <Text style={styles.latestEventBadge}>{visibleNewsEvents[0].categoryLabel}</Text>
                  <Text style={styles.latestEventDate}>{visibleNewsEvents[0].date || 'دون تاريخ'}</Text>
                </View>
                <Text style={styles.latestEventPerson}>{visibleNewsEvents[0].person}</Text>
                {visibleNewsEvents[0].details ? (
                  <Text numberOfLines={3} style={styles.latestEventDetails}>{visibleNewsEvents[0].details}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.todayStatTitle}>إحصائية اليوم</Text>
                <Text style={styles.todayStatText}>عدد السجلات الموثقة في الشجرة: {membersCount}</Text>
              </>
            )}

            <View style={styles.actions}>
              <ActionButton label="عرض كل المناسبات" onPress={onOpenEvents} variant="secondary" />
            </View>
          </View>
        </SectionCard>
        </View>
      ) : null}

      {!loading && !error ? (
        <SectionCard eyebrow="نظرة سريعة" title="ملخص أسبوعي">
          <View style={styles.weeklyMiniRow}>
            <Text style={styles.weeklyMiniValue}>طلبات هذا الأسبوع: {submittedThisWeek}</Text>
            <Text style={styles.weeklyMiniDot}>•</Text>
            <Text style={styles.weeklyMiniValue}>المعلّق الآن: {pendingNow}</Text>
          </View>

          <Pressable
            onPress={() => setShowWeeklyDetails((value) => !value)}
            style={({ pressed }) => [styles.inlineToggle, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.inlineToggleText}>{showWeeklyDetails ? 'إخفاء تفاصيل الملخص' : 'عرض تفاصيل الملخص'}</Text>
          </Pressable>

          {showWeeklyDetails ? (
            <>
              <View style={styles.weeklyGrid}>
                <View style={styles.weeklyCard}>
                  <Text style={styles.weeklyLabel}>طلبات جديدة</Text>
                  <Text style={styles.weeklyValue}>{submittedThisWeek}</Text>
                  <Text style={styles.weeklySub}>خلال 7 أيام</Text>
                </View>

                <View style={styles.weeklyCard}>
                  <Text style={styles.weeklyLabel}>قرارات صادرة</Text>
                  <Text style={styles.weeklyValue}>{decidedThisWeek}</Text>
                  <Text style={styles.weeklySub}>موافقة أو رفض</Text>
                </View>

                <View style={styles.weeklyCard}>
                  <Text style={styles.weeklyLabel}>قيد المراجعة</Text>
                  <Text style={styles.weeklyValue}>{pendingNow}</Text>
                  <Text style={styles.weeklySub}>حاليًا</Text>
                </View>

                <View style={styles.weeklyCard}>
                  <Text style={styles.weeklyLabel}>فعاليات قريبة</Text>
                  <Text style={styles.weeklyValue}>{upcomingThisWeek}</Text>
                  <Text style={styles.weeklySub}>حتى نهاية الأسبوع</Text>
                </View>
              </View>

              <View style={styles.weeklyNewsBar}>
                <Text style={styles.weeklyNewsText}>الأخبار المضافة هذا الأسبوع: {latestNewsThisWeek}</Text>
              </View>

              <View style={styles.weeklyTrendRow}>
                <View style={styles.weeklyTrendChip}>
                  <Text style={styles.weeklyTrendTitle}>الطلبات الجديدة</Text>
                  <Text style={styles.weeklyTrendValue}>{trendText(submittedThisWeek, submittedPreviousWeek)}</Text>
                  <Text style={styles.weeklyTrendHint}>مقارنة بالأسبوع السابق</Text>
                </View>

                <View style={styles.weeklyTrendChip}>
                  <Text style={styles.weeklyTrendTitle}>القرارات الصادرة</Text>
                  <Text style={styles.weeklyTrendValue}>{trendText(decidedThisWeek, decidedPreviousWeek)}</Text>
                  <Text style={styles.weeklyTrendHint}>مقارنة بالأسبوع السابق</Text>
                </View>
              </View>

              <View style={styles.weeklyInsightBox}>
                <Text style={styles.weeklyInsightText}>{weeklyInsightText}</Text>
              </View>
            </>
          ) : null}

        </SectionCard>
      ) : null}

      {!loading && !error ? (
        <SectionCard eyebrow="تحديث مباشر" title="نسب المصاهرة العامة">
          <View style={styles.weeklyMiniRow}>
            <Text style={styles.weeklyMiniValue}>إجمالي: {affinityStats.total}</Text>
            <Text style={styles.weeklyMiniDot}>•</Text>
            <Text style={styles.weeklyMiniValue}>داخل العائلة: {affinityStats.insidePct}%</Text>
          </View>

          <Pressable
            onPress={() => setShowAffinityDetails((value) => !value)}
            style={({ pressed }) => [styles.inlineToggle, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.inlineToggleText}>{showAffinityDetails ? 'إخفاء تفاصيل النسب' : 'عرض تفاصيل النسب'}</Text>
          </Pressable>

          {showAffinityDetails ? (
            <>
              <View style={styles.affinityGrid}>
                <View style={styles.affinityCard}>
                  <Text style={styles.affinityLabel}>إجمالي المصاهرات</Text>
                  <Text style={styles.affinityValue}>{affinityStats.total}</Text>
                  <Text style={styles.affinitySub}>سجلات فعالة</Text>
                </View>
                <View style={styles.affinityCard}>
                  <Text style={styles.affinityLabel}>داخل العائلة</Text>
                  <Text style={styles.affinityValue}>{affinityStats.insidePct}%</Text>
                  <Text style={styles.affinitySub}>{affinityStats.insideCount} سجل</Text>
                </View>
                <View style={styles.affinityCard}>
                  <Text style={styles.affinityLabel}>خارج العائلة</Text>
                  <Text style={styles.affinityValue}>{affinityStats.outsidePct}%</Text>
                  <Text style={styles.affinitySub}>{affinityStats.outsideCount} سجل</Text>
                </View>
                <View style={styles.affinityCard}>
                  <Text style={styles.affinityLabel}>غير محدد</Text>
                  <Text style={styles.affinityValue}>{affinityStats.unknownPct}%</Text>
                  <Text style={styles.affinitySub}>{affinityStats.unknownCount} سجل</Text>
                </View>
              </View>

              <View style={styles.affinityList}>
                <Text style={styles.affinityListTitle}>أعلى فروع المصاهرة الداخلية</Text>
                {topInsideBranches.length ? (
                  topInsideBranches.map((item) => (
                    <View key={item.name} style={styles.affinityRow}>
                      <Text style={styles.affinityRowValue}>{item.count}</Text>
                      <Text style={styles.affinityRowName}>{item.name}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.affinityEmpty}>لا توجد بيانات كافية حالياً.</Text>
                )}
              </View>
            </>
          ) : null}
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
  memberTitleLine: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  memberTitleHello: {
    color: '#DC2626',
  },
  memberTitleName: {
    color: colors.primary,
  },
  refreshMetaBar: {
    alignItems: 'flex-end',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  refreshMetaText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
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
    direction: 'ltr',
    flexDirection: 'row',
    gap: spacing.lg,
    left: 0,
    position: 'absolute',
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
  shortcutsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  shortcut: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 78,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    width: '48%',
  },
  shortcutIcon: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  shortcutLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  shortcutHint: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shortcutHintText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inlineToggle: {
    alignSelf: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  inlineToggleText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestsBlock: {
    gap: spacing.sm,
  },
  requestsBlockHighlighted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.sm,
  },
  todayCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  todayCardHighlighted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  todayStatTitle: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  todayStatText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
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
  requestItem: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  requestHead: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  requestKind: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  requestId: {
    color: colors.textMuted,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  requestStatusPill: {
    alignSelf: 'flex-end',
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  requestStatusText: {
    fontSize: 12,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  requestMetaRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  requestMetaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 96,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestMetaValue: {
    color: colors.text,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestsEmptyCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  requestsEmptyTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestsEmptyBody: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestSummaryRow: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  requestSummaryChip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  requestSummaryChipPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  requestSummaryChipApproved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  requestSummaryChipRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  requestSummaryChipValue: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  requestSummaryChipLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
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
  weeklyGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  weeklyMiniRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.xs,
  },
  weeklyMiniValue: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  weeklyMiniDot: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  weeklyCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    minWidth: 130,
    padding: spacing.sm,
    gap: 4,
  },
  weeklyLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  weeklyValue: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  weeklySub: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  weeklyNewsBar: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  weeklyNewsText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  weeklyInsightBox: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  weeklyInsightText: {
    color: '#7C2D12',
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  weeklyTrendRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  weeklyTrendChip: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  weeklyTrendTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  weeklyTrendValue: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  weeklyTrendHint: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  affinityGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  affinityCard: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 4,
    minWidth: 130,
    padding: spacing.sm,
  },
  affinityLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  affinityValue: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  affinitySub: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  affinityList: {
    marginTop: spacing.sm,
  },
  affinityListTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    marginBottom: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  affinityRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15,23,42,0.08)',
    borderBottomWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  affinityRowName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  affinityRowValue: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'left',
  },
  affinityEmpty: {
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
