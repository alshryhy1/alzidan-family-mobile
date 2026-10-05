import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DataState } from '../components/DataState';
import { PersonPhoto } from '../components/PersonPhoto';
import { PulseLiveBoard } from '../components/PulseLiveBoard';
import { SceneShell } from '../components/scene';
import { loadPulseFamilyBoard } from '../services/pulseBoard';
import { loadPulseWeather } from '../services/pulseWeather';
import { speakArabic } from '../services/familySpeech';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import type { FamilyEvent, TreeChild } from '../types';
import type { PulseBoardNotice } from '../utils/pulseNotices';
import type { PulseWeatherSnap } from '../utils/pulseFocus';
import { occasionRelationLabel, rankHomeOccasions } from '../utils/personEncounter';
import { phonesMatch } from '../utils/phone';
import { hijriToday, listTodayRemembrances } from '../utils/todayRemembrance';
import {
  loadRemembranceGreetings,
  remembranceGreeterLine,
  sendRemembranceGreeting,
  type RemembranceGreeting,
} from '../services/remembranceGreetings';
import {
  familyBoardCategoryLabel,
  familyBoardKindLabel,
  familyBoardMetaLine,
  loadFamilyBoardPosts,
  type FamilyBoardPost,
} from '../services/familyBoard';
import { resolvePulseSeason } from '../utils/pulseSeason';
import { sinceVisitSummary, type SinceVisitItem } from '../utils/sinceLastVisit';

type HomeScreenProps = {
  memberGreeting?: string | null;
  memberBranchKey?: string | null;
  memberPhotoUrl?: string | null;
  memberTreeChildId?: number | null;
  branchChildren?: TreeChild[];
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  onOpenMyCard?: () => void;
  pulseOnline?: number | null;
  sinceLastVisit?: SinceVisitItem[];
  onOpenSinceVisit?: (item: SinceVisitItem) => void;
  onOpenFamilyBoard?: () => void;
  events?: FamilyEvent[];
  kinshipById?: Record<number, string>;
  onOpenEvent?: (eventId: string) => void;
  memberPhone?: string | null;
  onOpenPerson?: (branchKey: string, treeChildId: number) => void;
};

function firstNameOnly(full?: string | null) {
  const raw = String(full || '').trim();
  if (!raw) return '';
  return (raw.split(/\s+/)[0] || '').trim();
}

export function HomeScreen({
  memberGreeting,
  memberBranchKey,
  memberPhotoUrl,
  memberTreeChildId,
  branchChildren = [],
  error,
  loading,
  onRetry,
  onOpenMyCard,
  pulseOnline = null,
  sinceLastVisit = [],
  onOpenSinceVisit,
  onOpenFamilyBoard,
  events = [],
  kinshipById,
  onOpenEvent,
  memberPhone,
  onOpenPerson,
}: HomeScreenProps) {
  const p = useThemePalette();
  const styles = useMemo(() => homeStyles(p), [p]);
  const [weather, setWeather] = useState<PulseWeatherSnap | null>(null);
  const [notices, setNotices] = useState<PulseBoardNotice[]>([]);
  const [delegates, setDelegates] = useState<PulseBoardNotice[]>([]);
  const [boardPosts, setBoardPosts] = useState<FamilyBoardPost[]>([]);
  const [greetings, setGreetings] = useState<RemembranceGreeting[]>([]);
  const [greetNote, setGreetNote] = useState('');
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const loggedIn = Boolean(String(memberGreeting || '').trim());
  const greetingFirst = firstNameOnly(memberGreeting);
  const canOpenCard = Boolean(memberTreeChildId && onOpenMyCard);

  const memberCity = useMemo(() => {
    if (memberTreeChildId == null) return null;
    const row = branchChildren.find((child) => child.id === memberTreeChildId);
    return String(row?.city || '').trim() || null;
  }, [branchChildren, memberTreeChildId]);

  const viewer = useMemo(
    () =>
      memberTreeChildId == null
        ? null
        : branchChildren.find((child) => child.id === memberTreeChildId) || null,
    [branchChildren, memberTreeChildId],
  );
  const homeOccasions = useMemo(
    () => rankHomeOccasions(events, memberBranchKey).slice(0, 3),
    [events, memberBranchKey],
  );
  const todayKey = useMemo(() => hijriToday(new Date(clock)).key, [clock]);
  const remembrances = useMemo(
    () =>
      listTodayRemembrances({
        people: branchChildren,
        viewer,
        maternalById: kinshipById,
        now: new Date(clock),
      }),
    [branchChildren, viewer, kinshipById, clock],
  );

  const season = useMemo(() => resolvePulseSeason(new Date(clock)), [clock]);

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadRemembranceGreetings(todayKey)
      .then((rows) => {
        if (!cancelled) setGreetings(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  async function sendGreeting(personId: number, kind: 'birth' | 'death', phrase: string) {
    const key = `${personId}:${kind}`;
    setSendingKey(key);
    setGreetNote('');
    try {
      const saved = await sendRemembranceGreeting({
        personId,
        kind,
        dayKey: todayKey,
        phrase,
        senderPhone: memberPhone || '',
        senderName: memberGreeting || '',
      });
      setGreetings((current) => {
        const rest = current.filter(
          (row) => !(row.personId === personId && row.kind === kind && phonesMatch(row.senderPhone, saved.senderPhone)),
        );
        return [...rest, saved];
      });
    } catch (error) {
      setGreetNote(error instanceof Error ? error.message : 'تعذر إيصال التهنئة الآن.');
    } finally {
      setSendingKey(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadPulseWeather(memberCity)
      .then((snap) => {
        if (!cancelled) setWeather(snap);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [memberCity]);

  useEffect(() => {
    let cancelled = false;
    function loadBoard() {
      loadPulseFamilyBoard()
        .then((board) => {
          if (cancelled) return;
          setNotices(board.notices);
          setDelegates(board.delegates);
        })
        .catch(() => undefined);
    }
    loadBoard();
    const id = setInterval(loadBoard, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    function loadFamilyBoard() {
      loadFamilyBoardPosts()
        .then((rows) => {
          if (!cancelled) setBoardPosts(rows.slice(0, 4));
        })
        .catch(() => undefined);
    }
    loadFamilyBoard();
    const id = setInterval(loadFamilyBoard, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loading]);

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
      onRefresh={onRetry}
      refreshing={loading}
      title="أهلاً بك بين أهلك"
      variant="pulse"
    >
      <DataState error={error} loading={loading} onRetry={onRetry} />

      <View style={styles.creamStage}>
        {remembrances.length ? (
          <View style={styles.sinceBox}>
            <Text style={styles.sinceTitle}>ذكرى اليوم</Text>
            {remembrances.map((row) => {
              const rowKey = `${row.personId}:${row.kind}`;
              const mine = greetings.some(
                (item) =>
                  item.personId === row.personId &&
                  item.kind === row.kind &&
                  phonesMatch(item.senderPhone, memberPhone),
              );
              const greeters = remembranceGreeterLine(
                row.kind,
                greetings.filter((item) => item.personId === row.personId && item.kind === row.kind),
                row.title === 'اليوم ميلادك',
              );
              const self = row.title === 'اليوم ميلادك';
              return (
                <View key={rowKey} style={styles.sinceRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onOpenPerson?.(row.branchKey, row.personId)}
                    style={styles.sinceText}
                  >
                    <Text style={styles.sinceItemTitle}>{row.title}</Text>
                    {row.subtitle ? <Text style={styles.sinceItemSub}>{row.subtitle}</Text> : null}
                    {greeters ? <Text style={styles.sinceItemSub}>{greeters}</Text> : null}
                  </Pressable>
                  {self ? null : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={mine || sendingKey === rowKey}
                      onPress={() => sendGreeting(row.personId, row.kind, row.phrase)}
                      style={({ pressed }) => [styles.rememberBtn, mine && styles.rememberBtnOn, pressed && styles.pressed]}
                    >
                      <Text style={[styles.rememberBtnText, mine && styles.rememberBtnTextOn]}>
                        {mine ? 'وصلت' : sendingKey === rowKey ? '...' : row.phrase}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {greetNote ? <Text style={styles.sinceItemSub}>{greetNote}</Text> : null}
          </View>
        ) : null}

        <View style={styles.sinceBox}>
          <Text style={styles.sinceTitle}>عند أهلك</Text>
          {homeOccasions.length ? (
            homeOccasions.map((event) => {
              const relation = occasionRelationLabel(event, viewer, branchChildren, kinshipById);
              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  onPress={() => onOpenEvent?.(event.id)}
                  style={({ pressed }) => [styles.sinceRow, pressed && styles.pressed]}
                >
                  <View style={styles.sinceText}>
                    <Text style={styles.sinceItemTitle}>
                      {event.categoryLabel}
                      {event.person ? ` · ${event.person}` : ''}
                    </Text>
                    {relation ? <Text style={styles.sinceItemSub}>{relation}</Text> : null}
                  </View>
                  <Text style={styles.sinceGo}>عرض</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.sinceEmpty}>المجلس هادئ.</Text>
          )}
        </View>

        <View style={styles.sinceBox}>
            <Text style={styles.sinceTitle}>منذ آخر زيارة</Text>
            <Pressable
              accessibilityLabel="اسمع ما فاتك"
              onPress={() => speakArabic(sinceVisitSummary(sinceLastVisit))}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.sinceSummary}>{sinceVisitSummary(sinceLastVisit)}</Text>
            </Pressable>
            {sinceLastVisit.length ? (
              sinceLastVisit.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => onOpenSinceVisit?.(item)}
                  style={({ pressed }) => [styles.sinceRow, pressed && styles.pressed]}
                >
                  <View style={styles.sinceText}>
                    <Text style={styles.sinceItemTitle}>{item.title}</Text>
                    {item.subtitle ? <Text style={styles.sinceItemSub}>{item.subtitle}</Text> : null}
                  </View>
                  <Text style={styles.sinceGo}>عرض</Text>
                </Pressable>
              ))
            ) : null}
          </View>

        <View style={styles.boardBox}>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenFamilyBoard}
            style={({ pressed }) => [styles.boardHead, pressed && styles.pressed]}
          >
            <Text style={styles.boardTitle}>وش عند الزيدان؟</Text>
            <Text style={styles.boardGo}>الكل</Text>
          </Pressable>
          <Text style={styles.boardSub}>اليوم داخل العائلة</Text>
          {boardPosts.length ? (
            boardPosts.map((post) => (
              <Pressable
                key={post.id}
                accessibilityRole="button"
                onPress={onOpenFamilyBoard}
                style={({ pressed }) => [
                  styles.boardRow,
                  post.urgent && styles.boardRowUrgent,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sinceText}>
                  <Text style={styles.sinceItemTitle}>{post.title}</Text>
                  <Text style={styles.sinceItemSub}>
                    {familyBoardKindLabel(post.kind)} · {familyBoardCategoryLabel(post.category)}
                    {familyBoardMetaLine(post) ? ` · ${familyBoardMetaLine(post)}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.sinceEmpty}>ما فيه شيء اليوم. كن أول من ينشر.</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onOpenFamilyBoard}
            style={({ pressed }) => [styles.boardAdd, pressed && styles.pressed]}
          >
            <Text style={styles.boardAddText}>أضف عرض أو طلب</Text>
          </Pressable>
        </View>

        {!loading && !error ? (
          <PulseLiveBoard
            delegates={delegates}
            model={{
              online: pulseOnline,
              weather,
              season,
            }}
            notices={notices}
            tone="stage"
          />
        ) : null}

        <View style={styles.creamFoot}>
          {loggedIn && (memberBranchKey || canOpenCard) ? (
            <View style={styles.placeRow}>
              {memberBranchKey ? (
                <Text style={styles.placeBranch}>فرع {memberBranchKey}</Text>
              ) : null}
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
        </View>
      </View>
    </SceneShell>
  );
}

function homeStyles(p: ThemePalette) {
  return StyleSheet.create({
  creamStage: {
    flexGrow: 1,
    gap: spacing.md,
    minHeight: 280,
  },
  creamFoot: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.md,
  },
  sinceBox: {
    backgroundColor: p.creamLift,
    borderColor: 'rgba(196,163,90,0.4)',
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sinceTitle: {
    color: p.green,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sinceSummary: {
    color: p.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sinceRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(23,63,53,0.06)',
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sinceText: {
    flex: 1,
    gap: 2,
  },
  sinceItemTitle: {
    color: p.ink,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sinceItemSub: {
    color: p.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rememberBtn: {
    backgroundColor: 'rgba(196,163,90,0.18)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rememberBtnOn: {
    backgroundColor: 'rgba(23,63,53,0.08)',
  },
  rememberBtnText: {
    color: p.green,
    fontSize: 12,
    fontWeight: '800',
  },
  rememberBtnTextOn: {
    color: p.textMuted,
  },
  sinceGo: {
    color: p.gold,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  sinceEmpty: {
    color: p.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  boardBox: {
    backgroundColor: p.creamLift,
    borderColor: 'rgba(196,163,90,0.45)',
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  boardHead: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  boardTitle: {
    color: p.green,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  boardGo: {
    color: p.gold,
    fontSize: 13,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  boardSub: {
    color: p.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  boardRow: {
    backgroundColor: 'rgba(23,63,53,0.06)',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  boardRowUrgent: {
    backgroundColor: 'rgba(160,70,60,0.1)',
  },
  boardAdd: {
    alignItems: 'center',
    backgroundColor: p.greenDeep,
    borderRadius: 14,
    marginTop: 2,
    paddingVertical: 12,
  },
  boardAddText: {
    color: p.creamLift,
    fontSize: 13,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
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
  placeRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: spacing.sm,
  },
  placeBranch: {
    color: p.text,
    fontSize: typography.body,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  placeSep: {
    color: p.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  placeCard: {
    color: p.primary,
    fontSize: typography.body,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.72,
  },
  });
}
