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
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TreeScreen } from './src/screens/TreeScreen';
import { usePublicData } from './src/hooks/usePublicData';
import { registerPushToken } from './src/services/pushNotifications';
import { colors, spacing, typography } from './src/theme';
import type { PublicScreen } from './src/types';

I18nManager.allowRTL(true);

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

  useEffect(() => {
    registerPushToken().catch((error) => {
      console.warn('تعذر تسجيل إشعارات التطبيق:', error);
    });
  }, []);

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


  const activeBranchKey = useMemo(
    () => selectedBranchKey ?? publicData.branches[0]?.id ?? null,
    [publicData.branches, selectedBranchKey],
  );

  const openTree = (branchKey?: string) => {
    if (branchKey) setSelectedBranchKey(branchKey);
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
        return <ProfileScreen branches={publicData.branches} />;
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
            bannerMessages={bannerMessages.map((item) => item.message)}
            tickerSpeedSeconds={tickerSpeedSeconds}
            loading={publicData.loading}
            membersCount={publicData.children.length}
            onOpenBranches={() => setScreen('branches')}
            onOpenEvents={() => setScreen('events')}
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
  activeTabText: {
    color: colors.primary,
  },
});
