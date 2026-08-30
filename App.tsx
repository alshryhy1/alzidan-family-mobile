import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  I18nManager,
  Linking,
  LogBox,
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
import { FamilySpaceMotionLab } from './src/screens/FamilySpaceMotionLab';
import { HomeScreen } from './src/screens/HomeScreen';
import { MemoryScreen } from './src/screens/MemoryScreen';
import { PersonEncounterScreen } from './src/screens/PersonEncounterScreen';
import { SpecialCardModal } from './src/components/SpecialCardModal';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { GivingScreen } from './src/screens/GivingScreen';
import { WomenAdminScreen } from './src/screens/WomenAdminScreen';
import { FamilyAdminScreen } from './src/screens/FamilyAdminScreen';
import { DelegateInboxScreen } from './src/screens/DelegateInboxScreen';
import { TreeScreen } from './src/screens/TreeScreen';
import { usePublicData } from './src/hooks/usePublicData';
import {
  formatFormalNotificationFromPayload,
  rememberPushPhone,
  registerPushToken,
  setupPushRegistration,
} from './src/services/pushNotifications';
import { resumeTrustedDevice } from './src/services/deviceAuth';
import {
  fetchActiveSpecialCardsForTicker,
  fetchPendingSpecialCards,
  formatSpecialCardTickerItem,
  markSpecialCardSeen,
  type SpecialCard,
} from './src/services/specialCards';
import { getPulseSessionId, pulseHeartbeat } from './src/services/pulsePresence';
import { loadMyRequests } from './src/services/myRequestsTrack';
import { loadKinshipForViewer, loadMemberLineageChildren, loadMemberViewerPerson } from './src/services/publicData';
import { trackAppView } from './src/services/viewTracking';
import { spacing, typography, type ThemePalette } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { DeviceLockGate } from './src/components/DeviceLockGate';
import { ForceUpdateGate } from './src/components/ForceUpdateGate';
import type { MemberRequest, PublicScreen, TreeChild } from './src/types';
import { isFamilyEventPubliclyVisible } from './src/utils/eventVisibility';
import { kinshipLabelForPerson } from './src/utils/maternalKinship';
import { canonicalizePhone } from './src/utils/phone';
import { resolveEncounterMode } from './src/utils/personEncounter';
import { collectBranchTreeStats } from './src/utils/treeStats';

I18nManager.allowRTL(true);

/** Expo Go + simulator: expected limits — must not cover the UI during visual review. */
LogBox.ignoreLogs([
  'expo-notifications',
  'Android Push notifications',
  'functionality is not fully supported in Expo Go',
  'push_requires_physical_device',
  '[PUSH] registerPushToken finished with failure',
]);

function screenFromOpenUrl(url: string | null): PublicScreen | null {
  const raw = String(url || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('://events') || raw.includes('/events')) return 'events';
  return null;
}

function screenFromPushData(data: Record<string, unknown> | null): PublicScreen {
  const mode = String(data?.mode || data?.notification_type || data?.type || '').toLowerCase();
  const screen = String(data?.screen || '').toLowerCase();
  if (screen === 'womenadmin' || mode === 'women_manager_new_request') return 'womenAdmin';
  if (screen === 'delegate' || mode === 'branch_delegate_new_request') return 'delegateInbox';
  if (screen === 'admin' || mode === 'admin_new_request') return 'familyAdmin';
  if (mode === 'status_changed' || mode === 'inbox_share') return 'profile';
  return 'events';
}

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
  { key: 'events', label: 'المناسبات', icon: '◇' },
  { key: 'memory', label: 'من الذاكرة', icon: '◈' },
  { key: 'profile', label: 'ملفي', icon: 'i' },
];

const APP_VIEW_PATH: Partial<Record<PublicScreen, string>> = {
  home: 'app/mobile/pulse',
  branches: 'app/mobile/branches',
  tree: 'app/mobile/tree',
  events: 'app/mobile/events',
  memory: 'app/mobile/memory',
  profile: 'app/mobile/profile',
  about: 'app/mobile/about',
  additions: 'app/mobile/additions',
  person: 'app/mobile/person',
  giving: 'app/mobile/giving',
  womenAdmin: 'app/mobile/women-admin',
  familyAdmin: 'app/mobile/family-admin',
  delegateInbox: 'app/mobile/delegate-inbox',
};

/** Person Encounter is the active visual slice — open on home with tabs, not motion lab. */
const FAMILY_SPACE_DEFAULT = false;

function AppChrome() {
  const { palette: p, notifyPhoneChanged } = useTheme();
  const styles = useMemo(() => appStyles(p), [p]);
  const [screen, setScreen] = useState<PublicScreen>(FAMILY_SPACE_DEFAULT ? 'familyLab' : 'home');
  const [legacyChrome, setLegacyChrome] = useState(!FAMILY_SPACE_DEFAULT);
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
  const [encounterTreeChildId, setEncounterTreeChildId] = useState<number | null>(null);
  const [encounterReturnScreen, setEncounterReturnScreen] = useState<PublicScreen>('tree');
  const [additionsIntent, setAdditionsIntent] = useState<'person' | 'correction'>('person');
  const [memberGreeting, setMemberGreeting] = useState<string | null>(null);
  const [memberBranchKey, setMemberBranchKey] = useState<string | null>(null);
  const [memberTreeChildId, setMemberTreeChildId] = useState<number | null>(null);
  const [memberViewerPerson, setMemberViewerPerson] = useState<TreeChild | null>(null);
  const [maternalKinshipById, setMaternalKinshipById] = useState<Record<number, string>>({});
  const [memberPhoneForRequests, setMemberPhoneForRequests] = useState('');
  const [lineageChildren, setLineageChildren] = useState<TreeChild[] | null>(null);
  const [memberRequests, setMemberRequests] = useState<MemberRequest[]>([]);
  const [specialCards, setSpecialCards] = useState<SpecialCard[]>([]);
  const [specialCardIndex, setSpecialCardIndex] = useState(0);
  const [specialCardVisible, setSpecialCardVisible] = useState(false);
  const [specialCardTickerItems, setSpecialCardTickerItems] = useState<string[]>([]);
  const [pulseOnline, setPulseOnline] = useState<number | null>(null);

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
    const path = APP_VIEW_PATH[screen];
    if (!path) return;
    trackAppView(path).catch(() => undefined);
  }, [screen]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let sub: { remove: () => void } | undefined;

    (async () => {
      const sessionId = await getPulseSessionId();
      const tick = async () => {
        if (AppState.currentState === 'background') return;
        const online = await pulseHeartbeat(sessionId);
        if (!cancelled) setPulseOnline(online);
      };
      await tick();
      if (cancelled) return;
      interval = setInterval(() => {
        void tick();
      }, 45000);
      sub = AppState.addEventListener('change', (next) => {
        if (next === 'active') void tick();
      });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      sub?.remove();
    };
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

      setScreen(screenFromPushData(response.notification.request.content.data as Record<string, unknown>));
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    const openFromUrl = (url: string | null) => {
      const next = screenFromOpenUrl(url);
      if (!next) return;
      setLegacyChrome(true);
      setScreen(next);
    };

    Linking.getInitialURL()
      .then(openFromUrl)
      .catch(() => undefined);

    const sub = Linking.addEventListener('url', ({ url }) => openFromUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;

    resumeTrustedDevice()
      .then(async (session) => {
        const phone = session?.phone || '';
        if (!phone) {
          if (alive) {
            setMemberGreeting(null);
            setMemberBranchKey(null);
            setMemberTreeChildId(null);
            setMemberViewerPerson(null);
            setMemberPhoneForRequests('');
          }
          return;
        }

        const hiddenViewer = await loadMemberViewerPerson(phone);
        const child =
          publicData.children.find((row) => row.id === Number(session?.treeChildId || 0)) || hiddenViewer;
        const name = child?.name
          ? tripleNameFromPath(child.name)
          : session?.displayName || null;
        if (alive) {
          setMemberGreeting(name);
          setMemberBranchKey(session?.branchKey || hiddenViewer?.branchKey || null);
          setMemberTreeChildId(
            Number.isFinite(Number(session?.treeChildId))
              ? Number(session?.treeChildId)
              : hiddenViewer?.id || null,
          );
          setMemberViewerPerson(hiddenViewer || child || null);
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
          setMemberTreeChildId(null);
          setMemberViewerPerson(null);
          setMemberPhoneForRequests('');
        }
      });

    return () => {
      alive = false;
    };
  }, [publicData.children, screen, memberPhoneForRequests]);

  useEffect(() => {
    let alive = true;
    const phone = String(memberPhoneForRequests || '').trim();
    if (!phone) {
      setLineageChildren(null);
      return () => {
        alive = false;
      };
    }
    loadMemberLineageChildren(phone)
      .then((rows) => {
        if (!alive) return;
        setLineageChildren(rows.length ? rows : null);
      })
      .catch(() => {
        if (alive) setLineageChildren(null);
      });
    return () => {
      alive = false;
    };
  }, [memberPhoneForRequests]);

  const includePubliclyHiddenPeople = Boolean(lineageChildren && lineageChildren.length);
  const treeChildren = useMemo(() => {
    if (!lineageChildren?.length) return publicData.children;
    const byId = new Map<number, (typeof publicData.children)[number]>();
    publicData.children.forEach((row) => byId.set(Number(row.id), row));
    lineageChildren.forEach((row) => {
      const id = Number(row.id);
      if (!id) return;
      const prev = byId.get(id);
      byId.set(id, {
        ...(prev || row),
        ...row,
        parentName: String(row.parentName || prev?.parentName || ''),
        name: String(row.name || prev?.name || ''),
        branchKey: String(row.branchKey || prev?.branchKey || ''),
      });
    });
    return Array.from(byId.values());
  }, [lineageChildren, publicData.children]);
  const branches = useMemo(() => {
    if (!includePubliclyHiddenPeople) return publicData.branches;
    return publicData.branches.map((branch) => {
      const branchChildren = treeChildren.filter((child) => child.branchKey === branch.id);
      return {
        ...branch,
        membersCount: collectBranchTreeStats(branchChildren, branch.id, {
          includePubliclyHidden: true,
        }).living,
      };
    });
  }, [includePubliclyHiddenPeople, publicData.branches, treeChildren]);

  const reloadMyRequests = useCallback(async () => {
    const rows = await loadMyRequests(memberPhoneForRequests);
    setMemberRequests(rows);
  }, [memberPhoneForRequests]);

  useEffect(() => {
    void reloadMyRequests();
  }, [reloadMyRequests, screen]);

  useEffect(() => {
    let alive = true;
    if (memberTreeChildId == null) {
      setMaternalKinshipById({});
      return () => {
        alive = false;
      };
    }
    const viewer =
      memberViewerPerson && Number(memberViewerPerson.id) === Number(memberTreeChildId)
        ? memberViewerPerson
        : treeChildren.find((row) => Number(row.id) === Number(memberTreeChildId)) ||
          memberViewerPerson || {
            id: memberTreeChildId,
            branchKey: memberBranchKey || '',
            parentName: '',
            name: '',
            birthOrder: null,
            birthDateGregorian: null,
            birthDateHijri: null,
            birthYear: null,
            city: null,
            area: null,
            isDeceased: null,
            gender: null,
          };
    loadKinshipForViewer(viewer, treeChildren)
      .then((map) => {
        if (alive) setMaternalKinshipById(map);
      })
      .catch(() => {
        if (alive) setMaternalKinshipById((prev) => prev);
      });
    return () => {
      alive = false;
    };
  }, [memberTreeChildId, memberViewerPerson, memberBranchKey, treeChildren]);

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
    () => selectedBranchKey ?? branches[0]?.id ?? null,
    [branches, selectedBranchKey],
  );

  const openTree = (branchKey?: string, treeChildId?: number | null) => {
    if (branchKey) setSelectedBranchKey(branchKey);
    setFocusedTreeChildId(treeChildId ?? null);
    setScreen('tree');
  };

  const openPersonEncounter = (
    branchKey: string,
    treeChildId: number,
    returnScreen: PublicScreen = 'tree',
  ) => {
    if (branchKey) setSelectedBranchKey(branchKey);
    setEncounterTreeChildId(treeChildId);
    setEncounterReturnScreen(returnScreen);
    setLegacyChrome(returnScreen !== 'familyLab');
    setScreen('person');
  };

  const closePersonEncounter = () => {
    setEncounterTreeChildId(null);
    const next = encounterReturnScreen === 'person' ? 'tree' : encounterReturnScreen;
    setLegacyChrome(next !== 'familyLab');
    setScreen(next);
  };

  const encounterPerson = useMemo(() => {
    if (encounterTreeChildId == null) return null;
    const fromPublic = treeChildren.find(
      (row) => Number(row.id) === Number(encounterTreeChildId),
    );
    const fromViewer =
      memberViewerPerson && Number(memberViewerPerson.id) === Number(encounterTreeChildId)
        ? memberViewerPerson
        : null;
    if (fromPublic && fromViewer) {
      return {
        ...fromPublic,
        photoUrl: fromPublic.photoUrl || fromViewer.photoUrl || null,
      };
    }
    return fromPublic || fromViewer || null;
  }, [encounterTreeChildId, treeChildren, memberViewerPerson]);

  const encounterViewer = useMemo(() => {
    if (memberViewerPerson) {
      const fromPublic = treeChildren.find(
        (row) => Number(row.id) === Number(memberViewerPerson.id),
      );
      if (fromPublic) {
        return {
          ...fromPublic,
          ...memberViewerPerson,
          photoUrl: memberViewerPerson.photoUrl || fromPublic.photoUrl || null,
        };
      }
      return memberViewerPerson;
    }
    if (memberTreeChildId == null) return null;
    return treeChildren.find((row) => Number(row.id) === Number(memberTreeChildId)) || null;
  }, [memberViewerPerson, memberTreeChildId, treeChildren]);

  const encounterMode = useMemo(() => {
    if (!encounterPerson) return 'visitor' as const;
    return resolveEncounterMode({
      hasMemberSession: Boolean(memberPhoneForRequests && memberTreeChildId != null),
      viewerTreeChildId: memberTreeChildId,
      targetTreeChildId: encounterPerson.id,
    });
  }, [encounterPerson, memberPhoneForRequests, memberTreeChildId]);

  const renderScreen = () => {
    switch (screen) {
      case 'branches':
        return (
          <BranchesScreen
            branches={branches}
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
            branches={branches}
            childrenRows={treeChildren}
            error={publicData.error}
            loading={publicData.loading}
            onRetry={reloadPublished}
            parents={publicData.parents}
            focusedTreeChildId={focusedTreeChildId}
            onSelectBranch={setSelectedBranchKey}
            onOpenEncounter={openPersonEncounter}
            onBackToHouses={() => setScreen('branches')}
            includePubliclyHiddenPeople={includePubliclyHiddenPeople}
          />
        );
      case 'person':
        if (!encounterPerson) {
          return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={{ color: p.text, textAlign: 'center', writingDirection: 'rtl' }}>
                تعذر فتح لقاء الشخص.
              </Text>
              <Pressable onPress={closePersonEncounter} style={{ marginTop: 16 }}>
                <Text style={{ color: p.primary, fontWeight: '800' }}>رجوع</Text>
              </Pressable>
            </View>
          );
        }
        return (
          <PersonEncounterScreen
            mode={encounterMode}
            person={encounterPerson}
            viewer={encounterViewer}
            branches={branches}
            childrenRows={treeChildren}
            events={activeEvents}
            maternalLabel={kinshipLabelForPerson(
              maternalKinshipById,
              encounterPerson,
              treeChildren,
            )}
            kinshipById={maternalKinshipById}
            memberPhone={memberPhoneForRequests}
            includePubliclyHiddenPeople={includePubliclyHiddenPeople}
            onClose={closePersonEncounter}
          />
        );
      case 'events':
        return (
          <EventsScreen
            branches={branches}
            error={publicData.error}
            events={activeEvents}
            loading={publicData.loading}
            memberBranchKey={memberBranchKey}
            memberGreeting={memberGreeting}
            memberPhone={memberPhoneForRequests}
            onRetry={reloadPublished}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            branches={branches}
            childrenRows={treeChildren}
            viewerPerson={memberViewerPerson}
            onOpenMemberCard={(branchKey, treeChildId) =>
              openPersonEncounter(branchKey, treeChildId, 'profile')
            }
            onOpenGiving={() => setScreen('giving')}
            onOpenWomenAdmin={() => setScreen('womenAdmin')}
            onOpenFamilyAdmin={() => setScreen('familyAdmin')}
            onOpenDelegateInbox={() => setScreen('delegateInbox')}
            onPhotoSaved={() => {
              void reloadPublished();
            }}
            onMemberSessionChange={(phone) => {
              const cleaned = cleanStoredPhone(phone || '');
              setMemberPhoneForRequests(cleaned);
              notifyPhoneChanged(cleaned || null);
              if (!cleaned) {
                setMemberGreeting(null);
                setMemberBranchKey(null);
                setMemberTreeChildId(null);
                setMemberViewerPerson(null);
              setMaternalKinshipById({});
              setMemberRequests([]);
              }
            }}
          />
        );
      case 'giving':
        return <GivingScreen onBack={() => setScreen('profile')} />;
      case 'womenAdmin':
        return (
          <WomenAdminScreen
            managerPhone={memberPhoneForRequests}
            onBack={() => setScreen('profile')}
          />
        );
      case 'familyAdmin':
        return (
          <FamilyAdminScreen
            adminPhone={memberPhoneForRequests}
            onBack={() => setScreen('profile')}
          />
        );
      case 'delegateInbox':
        return (
          <DelegateInboxScreen
            delegatePhone={memberPhoneForRequests}
            onBack={() => setScreen('profile')}
          />
        );
      case 'memory':
        return <MemoryScreen branches={branches} />;
      case 'additions':
        return <AdditionsScreen branches={branches} intent={additionsIntent} />;
      case 'about':
        return <AboutScreen />;
      case 'familyLab':
        return (
          <FamilySpaceMotionLab
            onOpenPulse={() => {
              setLegacyChrome(true);
              setScreen('home');
            }}
          />
        );
      default:
        return (
          <HomeScreen
            branchChildren={treeChildren}
            error={publicData.error}
            memberGreeting={memberGreeting}
            memberBranchKey={memberBranchKey}
            memberPhotoUrl={encounterViewer?.photoUrl || null}
            memberTreeChildId={memberTreeChildId}
            loading={publicData.loading}
            onRetry={reloadPublished}
            pulseOnline={pulseOnline}
            onOpenMyCard={
              memberTreeChildId != null && (memberBranchKey || encounterViewer?.branchKey)
                ? () =>
                    openPersonEncounter(
                      memberBranchKey || encounterViewer?.branchKey || '',
                      memberTreeChildId,
                      'home',
                    )
                : undefined
            }
          />
        );
    }
  };

  return (
    <>
      <SafeAreaProvider>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <StatusBar style="light" />
          <View style={styles.app}>
            <View
              style={[
                styles.header,
                styles.headerHidden,
              ]}
            >
              <View style={[styles.brandMark, screen === 'home' && styles.brandMarkPulse]}>
                <Text style={[styles.brandLetter, screen === 'home' && styles.brandLetterPulse]}>ز</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, screen === 'home' && styles.titlePulse]}>عائلة الزيدان</Text>
                {screen === 'home' || screen === 'familyLab' ? null : (
                  <Text style={styles.subtitle}>صلة، توثيق، ومشاركة</Text>
                )}
              </View>
            </View>

            <View style={styles.content}>{renderScreen()}</View>

          {!specialCardVisible && remainingSpecialCards > 0 && legacyChrome && screen !== 'familyLab' && screen !== 'person' && screen !== 'giving' && screen !== 'womenAdmin' && screen !== 'familyAdmin' && screen !== 'delegateInbox' && (
            <Pressable style={styles.nextSpecialCardButton} onPress={showNextSpecialCard}>
              <Text style={styles.nextSpecialCardText}>
                🎉 تبقى {remainingSpecialCards} بطاقات تهنئة - عرض التالية
              </Text>
            </Pressable>
          )}

          {legacyChrome && screen !== 'familyLab' && screen !== 'person' && screen !== 'giving' && screen !== 'womenAdmin' && screen !== 'familyAdmin' && screen !== 'delegateInbox' ? (
          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const tabScreen = screen === 'tree' ? 'branches' : screen;
              const active = tabScreen === tab.key;
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
          ) : null}

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

export default function App() {
  return (
    <ThemeProvider>
      <ForceUpdateGate>
        <DeviceLockGate>
          <AppChrome />
        </DeviceLockGate>
      </ForceUpdateGate>
    </ThemeProvider>
  );
}

function appStyles(p: ThemePalette) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: p.background,
  },
  app: {
    flex: 1,
    backgroundColor: p.background,
  },
  header: {
    alignItems: 'center',
    backgroundColor: p.surface,
    borderBottomColor: p.border,
    borderBottomWidth: 1,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerPulse: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    gap: 6,
    paddingVertical: 6,
  },
  headerHidden: {
    display: 'none',
    height: 0,
    overflow: 'hidden',
    paddingVertical: 0,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: p.primary,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandMarkPulse: {
    backgroundColor: p.primarySoft,
    borderRadius: 10,
    height: 24,
    opacity: 0.9,
    width: 24,
  },
  brandLetter: {
    color: p.surface,
    fontSize: 25,
    fontWeight: '800',
  },
  brandLetterPulse: {
    color: p.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: p.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  titlePulse: {
    color: p.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    opacity: 0.55,
  },
  subtitle: {
    color: p.textMuted,
    fontSize: typography.caption,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: p.background,
    borderTopColor: 'rgba(196,163,90,0.35)',
    borderTopWidth: 1,
    flexDirection: 'row-reverse',
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    gap: 2,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  activeTab: {
    backgroundColor: p.tabActiveWash,
  },
  pressedTab: {
    opacity: 0.7,
  },
  tabIcon: {
    color: p.textMuted,
    fontSize: 19,
    fontWeight: '700',
  },
  tabLabel: {
    color: p.textMuted,
    fontSize: 10,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  nextSpecialCardButton: {
    alignSelf: 'center',
    backgroundColor: p.primary,
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
    color: p.surface,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  activeTabText: {
    color: p.primaryDark,
    fontWeight: '800',
  },
  });
}
