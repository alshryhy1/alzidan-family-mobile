import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DataState } from '../components/DataState';
import { PersonPhoto } from '../components/PersonPhoto';
import { PulseLiveBoard } from '../components/PulseLiveBoard';
import { SceneShell } from '../components/scene';
import { loadPulseFamilyBoard } from '../services/pulseBoard';
import { loadPulseWeather } from '../services/pulseWeather';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import type { TreeChild } from '../types';
import type { PulseBoardNotice } from '../utils/pulseNotices';
import type { PulseWeatherSnap } from '../utils/pulseFocus';
import { resolvePulseSeason } from '../utils/pulseSeason';

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
}: HomeScreenProps) {
  const p = useThemePalette();
  const styles = useMemo(() => homeStyles(p), [p]);
  const [weather, setWeather] = useState<PulseWeatherSnap | null>(null);
  const [notices, setNotices] = useState<PulseBoardNotice[]>([]);
  const [delegates, setDelegates] = useState<PulseBoardNotice[]>([]);
  const [clock, setClock] = useState(() => Date.now());

  const loggedIn = Boolean(String(memberGreeting || '').trim());
  const greetingFirst = firstNameOnly(memberGreeting);
  const canOpenCard = Boolean(memberTreeChildId && onOpenMyCard);

  const memberCity = useMemo(() => {
    if (memberTreeChildId == null) return null;
    const row = branchChildren.find((child) => child.id === memberTreeChildId);
    return String(row?.city || '').trim() || null;
  }, [branchChildren, memberTreeChildId]);

  const season = useMemo(() => resolvePulseSeason(new Date(clock)), [clock]);

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

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
    justifyContent: 'space-between',
    minHeight: 280,
  },
  creamFoot: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.md,
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
