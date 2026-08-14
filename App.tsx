import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AboutScreen } from './src/screens/AboutScreen';
import { AdditionsScreen } from './src/screens/AdditionsScreen';
import { BranchesScreen } from './src/screens/BranchesScreen';
import { EventsScreen } from './src/screens/EventsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MemoryScreen } from './src/screens/MemoryScreen';
import { SpecialCardModal } from './src/components/SpecialCardModal';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TreeScreen } from './src/screens/TreeScreen';
import { usePublicData } from './src/hooks/usePublicData';
import {
  formatFormalNotificationFromPayload,
  rememberPushPhone,
  registerPushToken,
  setupPushRegistration,
} from './src/services/pushNotifications';
import {
  fetchActiveSpecialCardsForTicker,
  fetchPendingSpecialCards,
  formatSpecialCardTickerItem,
  markSpecialCardSeen,
  type SpecialCard,
} from './src/services/specialCards';
import { loadMyRequests } from './src/services/myRequestsTrack';
import { selectPublicRows } from './src/services/supabase';
import { trackAppView } from './src/services/viewTracking';
import { colors, spacing, typography } from './src/theme';
import type { MemberRequest, PublicScreen } from './src/types';
import { isFamilyEventPubliclyVisible } from './src/utils/eventVisibility';
import { canonicalizePhone, memberProfilePhoneQuery } from './src/utils/phone';

I18nManager.allowRTL(true);

const MEMBER_PHONE_KEY = 'alzidan_member_phone_v1';

function cleanStoredPhone(value: string) {
  return canonicalizePhone(value);
}

function tripleNameFromPath(value: string) {
  const parts = String(value || '')
    .split('/')
    .map((part) => part.trim().replace(/\s*رحمه الله\s*/g, '').replace(/\s*\(رحمه الله\)\s*/g, ''))
    .filter(Boolean)
    .slice(-3)
    .reverse();
  const uniqueOrdered = parts.filter((part, index) => {
    if (index === 0) return true;
    return part !== parts[index - 1];
  });
  return uniqueOrdered.length ? uniqueOrdered.join(' بن ') : '';
}

type MemberProfileRow = {
  phone: string | null;
  branch_key: string;
  tree_child_id: number;
  display_name: string | null;
  status: string | null;
};

type BannerMessage = {
  id: string | number;
  message: string;
  show_days?: number;
  created_at?: string;
  is_active?: boolean;
};

function isActiveBannerMessage(message: BannerMessage) {
  if (message.is_active === false) return false;
  if (!message.created_at) return true;

  const createdAt = Date.parse(message.created_at);
  if (!Number.isFinite(createdAt)) return true;

  const showDays = Math.min(Math.max(Number(message.show_days || 7), 1), 7);
  return createdAt >= Date.now() - showDays * 24 * 60 * 60 * 1000;
}

async function fetchBannerMessages() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/banner_messages?select=id,message,show_days,is_active,created_at&is_active=eq.true&order=created_at.desc&limit=20`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) return [];

  const rows = (await response.json()) as BannerMessage[];
  return rows.filter((row) => row.message && isActiveBannerMessage(row));
}

async function fetchTickerSpeedSeconds() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return 30;

  const response = await fetch(
    `${url}/rest/v1/site_settings?select=value&key=eq.ticker_speed_mobile_seconds&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) return 30;

  const rows = (await response.json()) as Array<{ value?: string }>;
  const n = Number(rows?.[0]?.value || 30);

  if (!Number.isFinite(n)) return 30;
  if (n < 10) return 10;
  if (n > 50) return 50;
  return Math.round(n);
}

const tabs: Array<{ key: PublicScreen; label: string; icon: string }> = [
  { key: 'home', label: 'نبض', icon: '⌂' },
  { key: 'branches', label: 'الفروع', icon: '⌘' },
  { key: 'tree', label: 'الشجرة', icon: '♧' },
  { key: 'events', label: 'المناسبات', icon: '◇' },
  { key: 'memory', label: 'من الذاكرة', icon: '◈' },
  { key: 'profile', label: 'ملفي', icon: 'i' },
];

export default function App() {
  const [screen, setScreen] = useState<PublicScreen>('home');
  const publicData = usePublicData();
  const activeEvents = publicData.events.filter((event) =>
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
  const [bannerMessages, setBannerMessages] = useState<BannerMessage[]>([]);
  const [tickerSpeedSeconds, setTickerSpeedSeconds] = useState(30);
  const [selectedBranchKey, setSelectedBranchKey] = useState<string | null>(null);
  const [focusedTreeChildId, setFocusedTreeChildId] = useState<number | null>(null);
  const [additionsIntent, setAdditionsIntent] = useState<'person' | 'correction'>('person');
  const [memberGreeting, setMemberGreeting] = useState<string | null>(null);
  const [memberBranchKey, setMemberBranchKey] = useState<string | null>(null);
  const [memberPhoneForRequests, setMemberPhoneForRequests] = useState('');
  const [memberRequests, setMemberRequests] = useState<MemberRequest[]>([]);
  const [specialCards, setSpecialCards] = useState<SpecialCard[]>([]);
  const [specialCardIndex, setSpecialCardIndex] = useState(0);
  const [specialCardVisible, setSpecialCardVisible] = useState(false);
  const [specialCardTickerItems, setSpecialCardTickerItems] = useState<string[]>([]);

  useEffect(() => {
    if (!__DEV__) return;
    const deaths = activeEvents.filter(
      (event) => String(event.type || '').toLowerCase() === 'death' || event.category === 'condolence',
    );
    console.log('[homeTicker:activeEvents]', {
      total: activeEvents.length,
      deaths: deaths.length,
      deathPreview: deaths.slice(0, 3).map((event) => ({ id: event.id, person: event.person })),
      specialCardTickerItems: specialCardTickerItems.length,
      bannerMessages: bannerMessages.length,
    });
  }, [activeEvents, specialCardTickerItems.length, bannerMessages.length]);

  useEffect(() => setupPushRegistration(), []);

  useEffect(() => {
    trackAppView('app/mobile').catch(() => undefined);
  }, []);

  useEffect(() => {
    if (screen !== 'memory') return;
    trackAppView('app/mobile/memory').catch(() => undefined);
  }, [screen]);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const formatted = formatFormalNotificationFromPayload({
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data as Record<string, unknown>,
      });

      console.log('PUSH_RECEIVED_FORMAL', {
        title: formatted.title,
        body: formatted.body,
        typeLabel: formatted.typeLabel,
      });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const formatted = formatFormalNotificationFromPayload({
        title: response.notification.request.content.title,
        body: response.notification.request.content.body,
        data: response.notification.request.content.data as Record<string, unknown>,
      });

      console.log('PUSH_RESPONSE_FORMAL', {
        title: formatted.title,
        body: formatted.body,
        typeLabel: formatted.typeLabel,
      });

      setScreen('events');
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    AsyncStorage.getItem(MEMBER_PHONE_KEY)
      .then(async (stored) => {
        const phone = cleanStoredPhone(stored || '');
        if (!phone) {
          if (alive) {
            setMemberGreeting(null);
            setMemberBranchKey(null);
            setMemberPhoneForRequests('');
          }
          return;
        }

        const query = memberProfilePhoneQuery(phone);
        const rows = query ? await selectPublicRows<MemberProfileRow>(query) : [];
        const profile = rows[0];
        if (!profile) {
          if (alive) {
            setMemberGreeting(null);
            setMemberBranchKey(null);
            setMemberPhoneForRequests('');
          }
          return;
        }

        const child = publicData.children.find((row) => row.id === profile.tree_child_id);
        const name = child?.name ? tripleNameFromPath(child.name) : profile.display_name || null;
        if (alive) {
          setMemberGreeting(name);
          setMemberBranchKey(profile.branch_key || null);
          setMemberPhoneForRequests(phone);
        }
        rememberPushPhone(phone)
          .then(() => registerPushToken('member_phone'))
          .catch(() => {});
      })
      .catch(() => {
        if (alive) {
          setMemberGreeting(null);
          setMemberBranchKey(null);
          setMemberPhoneForRequests('');
        }
      });

    return () => {
      alive = false;
    };
  }, [publicData.children, screen]);

  const reloadMyRequests = useCallback(async () => {
    const rows = await loadMyRequests(memberPhoneForRequests);
    setMemberRequests(rows);
  }, [memberPhoneForRequests]);

  useEffect(() => {
    void reloadMyRequests();
  }, [reloadMyRequests, screen]);

  useEffect(() => {
    let mounted = true;

    fetchBannerMessages()
      .then((messages) => {
        if (mounted) setBannerMessages(messages);
      })
      .catch((error) => {
        console.warn('تعذر تحميل الأخبار العامة:', error);
      });

    fetchTickerSpeedSeconds()
      .then((seconds) => {
        if (mounted) setTickerSpeedSeconds(seconds);
      })
      .catch((error) => {
        console.warn('تعذر تحميل سرعة الشريط:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);



  useEffect(() => {
    let alive = true;

    fetchPendingSpecialCards()
      .then((cards: SpecialCard[]) => {
        if (!alive || !cards.length) return;
        setSpecialCards(cards);
        setSpecialCardIndex(0);
        setSpecialCardVisible(true);
      })
      .catch((error: unknown) => {
        console.warn('تعذر تحميل البطاقة الخاصة:', error);
      });

    fetchActiveSpecialCardsForTicker()
      .then((cards: SpecialCard[]) => {
        if (!alive) return;
        const items = cards.map(formatSpecialCardTickerItem).map((item) => item.trim()).filter(Boolean);
        if (__DEV__) {
          console.log('[homeTicker:specialCards]', {
            fetched: cards.length,
            tickerItems: items.length,
            preview: items.slice(0, 3),
          });
        }
        setSpecialCardTickerItems(items);
      })
      .catch((error: unknown) => {
        console.warn('تعذر تحميل عناوين البطاقة الخاصة للشريط:', error);
      });

    return () => {
      alive = false;
    };
  }, []);

  const reloadPublished = useCallback(async () => {
    await Promise.all([
      publicData.reload(),
      fetchBannerMessages()
        .then(setBannerMessages)
        .catch(() => undefined),
      fetchTickerSpeedSeconds()
        .then(setTickerSpeedSeconds)
        .catch(() => undefined),
      fetchActiveSpecialCardsForTicker()
        .then((cards) => {
          const items = cards
            .map(formatSpecialCardTickerItem)
            .map((item) => item.trim())
            .filter(Boolean);
          setSpecialCardTickerItems(items);
          const aliveIds = new Set(cards.map((card) => String(card.id)));
          setSpecialCards((current) => current.filter((card) => aliveIds.has(String(card.id))));
        })
        .catch(() => undefined),
      reloadMyRequests(),
    ]);
  }, [publicData.reload, reloadMyRequests]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void reloadPublished();
    });
    return () => sub.remove();
  }, [reloadPublished]);

  const currentSpecialCard = specialCards[specialCardIndex] ?? null;
  const remainingSpecialCards = Math.max(specialCards.length - specialCardIndex - 1, 0);

  useEffect(() => {
    if (!specialCards.length || specialCardIndex >= specialCards.length) {
      setSpecialCardVisible(false);
    }
  }, [specialCardIndex, specialCards.length]);

  const closeSpecialCard = () => {
    const card = currentSpecialCard;
    setSpecialCardVisible(false);
    if (card?.id && card.show_once_per_day !== false) {
      markSpecialCardSeen(card.id).catch((error) => {
        console.warn('تعذر حفظ حالة البطاقة الخاصة:', error);
      });
    }
  };

  const showNextSpecialCard = () => {
    if (!remainingSpecialCards) return;
    setSpecialCardIndex((index) => index + 1);
    setSpecialCardVisible(true);
  };

  const activeBranchKey = useMemo(
    () => selectedBranchKey ?? publicData.branches[0]?.id ?? null,
    [publicData.branches, selectedBranchKey],
  );

  const openTree = (branchKey?: string, treeChildId?: number | null) => {
    if (branchKey) setSelectedBranchKey(branchKey);
    setFocusedTreeChildId(treeChildId ?? null);
    setScreen('tree');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'branches':
        return (
          <BranchesScreen
            branches={publicData.branches}
            error={publicData.error}
            loading={publicData.loading}
            onOpenTree={openTree}
            onRetry={reloadPublished}
          />
        );
      case 'tree':
        return (
          <TreeScreen
            branchKey={activeBranchKey}
            branches={publicData.branches}
            childrenRows={publicData.children}
            error={publicData.error}
            loading={publicData.loading}
            onRetry={reloadPublished}
            parents={publicData.parents}
            focusedTreeChildId={focusedTreeChildId}
            onSelectBranch={setSelectedBranchKey}
          />
        );
      case 'events':
        return (
          <EventsScreen
            branches={publicData.branches}
            error={publicData.error}
            events={activeEvents}
            loading={publicData.loading}
            onRetry={reloadPublished}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            branches={publicData.branches}
            childrenRows={publicData.children}
            onOpenMemberCard={(branchKey, treeChildId) => openTree(branchKey, treeChildId)}
            onMemberSessionChange={(phone) => {
              const cleaned = cleanStoredPhone(phone || '');
              setMemberPhoneForRequests(cleaned);
              if (!cleaned) {
                setMemberGreeting(null);
          setMemberBranchKey(null);
                setMemberRequests([]);
              }
            }}
          />
        );
      case 'memory':
        return <MemoryScreen branches={publicData.branches} />;
      case 'additions':
        return <AdditionsScreen branches={publicData.branches} intent={additionsIntent} />;
      case 'about':
        return <AboutScreen />;
      default:
        return (
          <HomeScreen
            error={publicData.error}
            latestEvents={activeEvents}
            memberGreeting={memberGreeting}
            memberBranchKey={memberBranchKey}
            loading={publicData.loading}
            onRetry={reloadPublished}
            onOpenEvents={() => setScreen('events')}
          />
        );
    }
  };

  return (
    <>
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <StatusBar style="dark" />
          <View style={styles.app}>
            <View style={[styles.header, screen === 'home' && styles.headerCompact]}>
              <View style={[styles.brandMark, screen === 'home' && styles.brandMarkCompact]}>
                <Text style={[styles.brandLetter, screen === 'home' && styles.brandLetterCompact]}>ز</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, screen === 'home' && styles.titleCompact]}>عائلة الزيدان</Text>
                {screen === 'home' ? null : (
                  <Text style={styles.subtitle}>صلة، توثيق، ومشاركة</Text>
                )}
              </View>
            </View>

            <View style={styles.content}>{renderScreen()}</View>

          {!specialCardVisible && remainingSpecialCards > 0 && (
            <Pressable style={styles.nextSpecialCardButton} onPress={showNextSpecialCard}>
              <Text style={styles.nextSpecialCardText}>
                🎉 تبقى {remainingSpecialCards} بطاقات تهنئة - عرض التالية
              </Text>
            </Pressable>
          )}

          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const active = screen === tab.key;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={tab.key}
                  onPress={() => setScreen(tab.key)}
                  style={({ pressed }) => [
                    styles.tab,
                    active && styles.activeTab,
                    pressed && styles.pressedTab,
                  ]}
                >
                  <Text style={[styles.tabIcon, active && styles.activeTabText]}>{tab.icon}</Text>
                  <Text style={[styles.tabLabel, active && styles.activeTabText]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>

      <SpecialCardModal
        card={currentSpecialCard}
        visible={specialCardVisible}
        onClose={closeSpecialCard}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerCompact: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandMarkCompact: {
    borderRadius: 12,
    height: 32,
    width: 32,
  },
  brandLetter: {
    color: colors.surface,
    fontSize: 25,
    fontWeight: '800',
  },
  brandLetterCompact: {
    fontSize: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  titleCompact: {
    fontSize: typography.body,
    fontWeight: '700',
    opacity: 0.72,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row-reverse',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    gap: 2,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  activeTab: {
    backgroundColor: colors.primarySoft,
  },
  pressedTab: {
    opacity: 0.7,
  },
  tabIcon: {
    color: colors.textMuted,
    fontSize: 19,
    fontWeight: '700',
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  nextSpecialCardButton: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    bottom: 74,
    elevation: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  nextSpecialCardText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  activeTabText: {
    color: colors.primary,
  },
});
