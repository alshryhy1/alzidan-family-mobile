import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AboutScreen } from './src/screens/AboutScreen';
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
  registerPushToken,
} from './src/services/pushNotifications';
import { fetchActiveSpecialCard, markSpecialCardSeen, type SpecialCard } from './src/services/specialCards';
import { selectPublicRows } from './src/services/supabase';
import { colors, spacing, typography } from './src/theme';
import type { MemberRequest, PublicScreen } from './src/types';

I18nManager.allowRTL(true);

const MEMBER_PHONE_KEY = 'alzidan_member_phone_v1';

function cleanStoredPhone(value: string) {
  return String(value || '').replace(/[^\d]/g, '');
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
  { key: 'home', label: 'الرئيسية', icon: '⌂' },
  { key: 'branches', label: 'الفروع', icon: '⌘' },
  { key: 'tree', label: 'الشجرة', icon: '♧' },
  { key: 'events', label: 'المناسبات', icon: '◇' },
  { key: 'memory', label: 'من الذاكرة', icon: '◈' },
  { key: 'profile', label: 'ملفي', icon: 'i' },
];

function getEventVisibilityDays(event: import('./src/types').FamilyEvent) {
  const n = Number(event.showDays);
  if (!Number.isFinite(n)) return 7;
  if (n < 1) return 1;
  if (n > 7) return 7;
  return n;
}

function isActiveFamilyEvent(event: import('./src/types').FamilyEvent) {
  if (!event.createdAt) return true;
  const createdAt = Date.parse(event.createdAt);
  if (!Number.isFinite(createdAt)) return true;
  const maxAgeMs = getEventVisibilityDays(event) * 24 * 60 * 60 * 1000;
  return createdAt >= Date.now() - maxAgeMs;
}

export default function App() {
  const [screen, setScreen] = useState<PublicScreen>('home');
  const publicData = usePublicData();
  const activeEvents = publicData.events.filter(isActiveFamilyEvent);
  const [bannerMessages, setBannerMessages] = useState<BannerMessage[]>([]);
  const [tickerSpeedSeconds, setTickerSpeedSeconds] = useState(30);
  const [selectedBranchKey, setSelectedBranchKey] = useState<string | null>(null);
  const [focusedTreeChildId, setFocusedTreeChildId] = useState<number | null>(null);
  const [memberGreeting, setMemberGreeting] = useState<string | null>(null);
  const [memberPhoneForRequests, setMemberPhoneForRequests] = useState('');
  const [memberRequests, setMemberRequests] = useState<MemberRequest[]>([]);
  const [specialCards, setSpecialCards] = useState<SpecialCard[]>([]);
  const [specialCardIndex, setSpecialCardIndex] = useState(0);
  const [specialCardVisible, setSpecialCardVisible] = useState(false);

  useEffect(() => {
    registerPushToken().catch((error) => {
      console.warn('تعذر تسجيل إشعارات التطبيق:', error);
    });
  }, []);

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
          if (alive) setMemberGreeting(null);
          if (alive) {
            setMemberPhoneForRequests('');
            setMemberRequests([]);
          }
          return;
        }

        const rows = await selectPublicRows<MemberProfileRow>(
          `member_profiles?select=phone,branch_key,tree_child_id,display_name,status&phone=eq.${encodeURIComponent(phone)}&status=eq.active&limit=1`,
        );
        const profile = rows[0];
        if (!profile) {
          if (alive) setMemberGreeting(null);
          if (alive) {
            setMemberPhoneForRequests('');
            setMemberRequests([]);
          }
          return;
        }

        const child = publicData.children.find((row) => row.id === profile.tree_child_id);
        const name = child?.name ? tripleNameFromPath(child.name) : profile.display_name || null;
        if (alive) {
          setMemberGreeting(name);
          setMemberPhoneForRequests(phone);
        }
      })
      .catch(() => {
        if (alive) {
          setMemberGreeting(null);
          setMemberPhoneForRequests('');
          setMemberRequests([]);
        }
      });

    return () => {
      alive = false;
    };
  }, [publicData.children]);

  useEffect(() => {
    let alive = true;

    if (!memberPhoneForRequests) {
      setMemberRequests([]);
      return () => {
        alive = false;
      };
    }

    type ApprovalRequestRow = {
      id?: string | number | null;
      request_id?: string | null;
      kind?: string | null;
      status?: string | null;
      branch_key?: string | null;
      created_at?: string | null;
      reviewed_at?: string | null;
      approved_at?: string | null;
      rejected_at?: string | null;
      decided_at?: string | null;
      processed_at?: string | null;
      updated_at?: string | null;
      reject_reason?: string | null;
      rejection_reason?: string | null;
      decision_reason?: string | null;
      admin_note?: string | null;
      review_note?: string | null;
      notes?: string | null;
    };

    const pickString = (...values: Array<unknown>) => {
      for (const value of values) {
        const text = String(value || '').trim();
        if (text) return text;
      }
      return '';
    };

    selectPublicRows<ApprovalRequestRow>(
      `approval_requests?select=*&phone=eq.${encodeURIComponent(memberPhoneForRequests)}&order=created_at.desc&limit=20`,
    )
      .then((rows) => {
        if (!alive) return;

        const normalized = rows
          .filter((row) => {
            const kind = String(row.kind || '');
            return kind === 'event_card' || kind === 'tree_card';
          })
          .map<MemberRequest>((row) => {
            const id = pickString(row.id, row.request_id) || Math.random().toString(36).slice(2);
            const status = String(row.status || 'pending').trim() || 'pending';
            const decisionDate = pickString(
              row.reviewed_at,
              row.approved_at,
              row.rejected_at,
              row.decided_at,
              row.processed_at,
              row.updated_at,
            );
            const rejectionReason = pickString(
              row.reject_reason,
              row.rejection_reason,
              row.decision_reason,
              row.admin_note,
              row.review_note,
              row.notes,
            );

            return {
              id,
              requestId: pickString(row.request_id, row.id),
              kind: String(row.kind || ''),
              status,
              branchKey: pickString(row.branch_key) || undefined,
              createdAt: pickString(row.created_at) || undefined,
              decisionDate: decisionDate || undefined,
              rejectionReason: rejectionReason || undefined,
            };
          });

        setMemberRequests(normalized);
      })
      .catch(() => {
        if (alive) setMemberRequests([]);
      });

    return () => {
      alive = false;
    };
  }, [memberPhoneForRequests]);

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

    fetchActiveSpecialCard()
      .then((card: SpecialCard | null) => {
        if (!alive || !card) return;
        setSpecialCards([card]);
        setSpecialCardIndex(0);
        setSpecialCardVisible(true);
      })
      .catch((error: unknown) => {
        console.warn('تعذر تحميل البطاقة الخاصة:', error);
      });

    return () => {
      alive = false;
    };
  }, []);

  const currentSpecialCard = specialCards[specialCardIndex] ?? null;
  const remainingSpecialCards = Math.max(specialCards.length - specialCardIndex - 1, 0);

  const closeSpecialCard = () => {
    const card = currentSpecialCard;
    setSpecialCardVisible(false);
    if (card && card.id) {
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
            onRetry={publicData.reload}
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
            onRetry={publicData.reload}
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
            onRetry={publicData.reload}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            branches={publicData.branches}
            childrenRows={publicData.children}
            onOpenMemberCard={(branchKey, treeChildId) => openTree(branchKey, treeChildId)}
          />
        );
      case 'memory':
        return <MemoryScreen />;
      case 'about':
        return <AboutScreen />;
      default:
        return (
          <HomeScreen
            branchesCount={publicData.branches.length}
            error={publicData.error}
            latestEvent={activeEvents[0] ?? null}
            latestEvents={activeEvents}
            upcomingEvents={publicData.events}
            affinityStats={publicData.affinityStats}
            bannerMessages={bannerMessages.map((item) => item.message)}
            tickerSpeedSeconds={tickerSpeedSeconds}
            memberGreeting={memberGreeting}
            memberRequests={memberRequests}
            loading={publicData.loading}
            membersCount={publicData.children.length}
            onOpenBranches={() => setScreen('branches')}
            onOpenEvents={() => setScreen('events')}
            onOpenProfile={() => setScreen('profile')}
            onOpenTree={() => openTree()}
            onRetry={publicData.reload}
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.app}>
          <View style={styles.header}>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>ز</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>عائلة الزيدان</Text>
              <Text style={styles.subtitle}>صلة، توثيق، ومشاركة</Text>
            </View>
          </View>

          <View style={styles.content}>{renderScreen()}</View>

          <SpecialCardModal
            card={currentSpecialCard}
            visible={specialCardVisible}
            onClose={closeSpecialCard}
          />

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
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandLetter: {
    color: colors.surface,
    fontSize: 25,
    fontWeight: '800',
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
