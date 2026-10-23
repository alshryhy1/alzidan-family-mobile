import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { SceneSection, SceneShell } from '../components/scene';
import {
  AID_SITUATIONS,
  aidStatusLabel,
  loadMyAidRequests,
  loadPublishedAidRequests,
  submitAidRequest,
  type AidSituation,
  type MyAidRequest,
  type PublishedAidRequest,
} from '../services/aidRequest';
import { loadSelfPathFacts } from '../services/publicData';
import { spacing, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { TreeChild } from '../types';
import { canonicalizePhone } from '../utils/phone';

type Pane = 'help' | 'request' | 'mine';

type AidRequestScreenProps = {
  memberPhone?: string | null;
  viewerPerson?: TreeChild | null;
  childrenRows?: TreeChild[];
  initialPane?: Pane;
  onBack: () => void;
};

export function AidRequestScreen({
  memberPhone,
  viewerPerson = null,
  childrenRows = [],
  initialPane = 'help',
  onBack,
}: AidRequestScreenProps) {
  const p = useThemePalette();
  const styles = useThemedStyles(aidStyles);
  const phone = canonicalizePhone(memberPhone || '');
  const [pane, setPane] = useState<Pane>(initialPane === 'request' && phone ? 'request' : initialPane);
  const [situation, setSituation] = useState<AidSituation>('other');
  const [situationLocked, setSituationLocked] = useState(false);
  const [situationLoading, setSituationLoading] = useState(false);
  const [needText, setNeedText] = useState('');
  const [hideName, setHideName] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [published, setPublished] = useState<PublishedAidRequest[]>([]);
  const [mine, setMine] = useState<MyAidRequest[]>([]);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const pub = await loadPublishedAidRequests();
      setPublished(pub);
      if (phone) {
        const rows = await loadMyAidRequests(phone);
        setMine(rows);
      } else {
        setMine([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل.');
    }
  }, [phone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    if (!viewerPerson?.id) {
      setSituationLocked(false);
      setSituationLoading(false);
      return () => {
        alive = false;
      };
    }
    setSituationLoading(true);
    loadSelfPathFacts(viewerPerson, childrenRows, phone)
      .then((facts) => {
        if (!alive) return;
        if (facts.aidSituation === 'widow' || facts.aidSituation === 'divorced') {
          setSituation(facts.aidSituation);
          setSituationLocked(true);
        } else {
          setSituation('other');
          setSituationLocked(false);
        }
      })
      .catch(() => {
        if (!alive) return;
        setSituationLocked(false);
      })
      .finally(() => {
        if (alive) setSituationLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [viewerPerson, childrenRows, phone]);

  const send = async () => {
    if (!phone) {
      setStatus('سجّل الدخول من ملفي برقم عضو مسجّل أولاً.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      await submitAidRequest({
        phone,
        situation,
        needText,
        hideName,
      });
      setNeedText('');
      setStatus('وصل طلبك للإدارة بسرية. بعد الاعتماد يُنشر بلا اسم للمساعدة عبر صندوق العائلة.');
      setPane('mine');
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'تعذر الإرسال.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SceneShell
      english="AID"
      eyebrow="سرية · صندوق العائلة"
      heroLead={
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text style={styles.back}>رجوع</Text>
        </Pressable>
      }
      onRefresh={() => void refresh()}
      subtitle={
        pane === 'help'
          ? 'طلبات معتمدة بلا اسم. المساعدة عبر إدارة العائلة وليس بتحويل باسم المستفيدة.'
          : pane === 'request'
            ? 'طلبك يصل للإدارة فقط. عند النشر يُخفى اسمك افتراضياً.'
            : 'متابعة حالة طلباتك.'
      }
      title={pane === 'help' ? 'فرص مساعدة' : pane === 'request' ? 'طلب مساعدة' : 'طلباتي'}
      variant="identity"
    >
      <View style={styles.tabs}>
        {(
          [
            { id: 'help' as const, label: 'فرص مساعدة' },
            { id: 'request' as const, label: 'أقدّم طلباً' },
            { id: 'mine' as const, label: 'طلباتي' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setPane(tab.id)}
            style={[styles.tab, pane === tab.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, pane === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pane === 'help' ? (
        <SceneSection>
          <Text style={styles.note}>
            إن أردت المساعدة: تواصل مع الإدارة حسب الملاحظة تحت كل طلب. لا تطلب اسم المستفيدة للتحويل.
          </Text>
          {!published.length ? (
            <Text style={styles.empty}>لا توجد فرص مساعدة منشورة حالياً.</Text>
          ) : (
            published.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardKicker}>{row.situationLabel}</Text>
                <Text style={styles.cardTitle}>{row.title}</Text>
                <Text style={styles.cardBody}>{row.body}</Text>
                {row.branchKey ? <Text style={styles.meta}>الفرع: {row.branchKey}</Text> : null}
                <Text style={styles.contact}>{row.contactNote}</Text>
              </View>
            ))
          )}
        </SceneSection>
      ) : null}

      {pane === 'request' ? (
        <SceneSection>
          {!phone ? (
            <Text style={styles.note}>من ملفي → اربط جهازك برقم عضو مسجّل ثم عد إلى هنا.</Text>
          ) : (
            <>
              <Text style={styles.fieldLabel}>الحالة</Text>
              {situationLoading ? (
                <Text style={styles.hint}>جاري قراءة حالتك من ملف الزواج…</Text>
              ) : situationLocked ? (
                <>
                  <View style={[styles.chip, styles.chipActive, styles.lockedChip]}>
                    <Text style={[styles.chipText, styles.chipTextActive]}>
                      {AID_SITUATIONS.find((s) => s.id === situation)?.label || situation}
                    </Text>
                  </View>
                  <Text style={styles.hint}>من ملفك في الشجرة — لا حاجة للاختيار.</Text>
                </>
              ) : (
                <>
                  <View style={styles.chips}>
                    {AID_SITUATIONS.map((item) => {
                      const on = situation === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setSituation(item.id)}
                          style={[styles.chip, on && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextActive]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.hint}>
                    {AID_SITUATIONS.find((s) => s.id === situation)?.hint}
                  </Text>
                </>
              )}

              <Text style={styles.fieldLabel}>الاحتياج</Text>
              <TextInput
                multiline
                onChangeText={setNeedText}
                placeholder="مثال: مساعدة إيجار لشهرين…"
                placeholderTextColor={p.textMuted}
                style={styles.input}
                textAlign="right"
                value={needText}
              />

              <View style={styles.switchRow}>
                <Switch
                  onValueChange={setHideName}
                  trackColor={{ false: '#D4C4A8', true: '#C4A35A' }}
                  value={hideName}
                />
                <Text style={styles.switchLabel}>إخفاء اسمي عند النشر</Text>
              </View>
              <Text style={styles.hint}>
                حتى لو أُلغي الإخفاء، التحويل البنكي للعامة يكون عبر صندوق العائلة لا باسمك.
              </Text>

              <ActionButton
                label={busy ? 'جاري الإرسال…' : 'إرسال للإدارة'}
                onPress={() => {
                  if (!busy) void send();
                }}
              />
            </>
          )}
        </SceneSection>
      ) : null}

      {pane === 'mine' ? (
        <SceneSection>
          {!phone ? (
            <Text style={styles.note}>سجّل الدخول لعرض طلباتك.</Text>
          ) : !mine.length ? (
            <Text style={styles.empty}>لا طلبات بعد.</Text>
          ) : (
            mine.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardKicker}>
                  {row.situationLabel} · {aidStatusLabel(row.status)}
                </Text>
                <Text style={styles.cardBody}>{row.needText}</Text>
                <Text style={styles.meta}>
                  {row.hideName ? 'الاسم مخفي عند النشر' : 'قد يظهر الاسم عند النشر'}
                </Text>
              </View>
            ))
          )}
        </SceneSection>
      ) : null}

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </SceneShell>
  );
}

function aidStyles(p: ThemePalette) {
  return {
    back: {
      color: p.goldSoft,
      fontSize: 14,
      fontWeight: '800' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    tabs: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      marginBottom: spacing.md,
    },
    tab: {
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: p.surface || '#FFFDF8',
    },
    tabActive: {
      backgroundColor: 'rgba(196,163,90,0.18)',
      borderColor: '#C4A35A',
    },
    tabText: {
      color: p.textMuted,
      fontSize: 13,
      fontWeight: '700' as const,
    },
    tabTextActive: {
      color: p.primary,
    },
    note: {
      color: p.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 12,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    empty: {
      color: p.textMuted,
      fontSize: 14,
      textAlign: 'right' as const,
    },
    fieldLabel: {
      color: p.text,
      fontSize: 13,
      fontWeight: '800' as const,
      marginBottom: 8,
      textAlign: 'right' as const,
    },
    chips: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      marginBottom: 8,
    },
    chip: {
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipActive: {
      backgroundColor: 'rgba(196,163,90,0.2)',
      borderColor: '#C4A35A',
    },
    lockedChip: {
      alignSelf: 'flex-end' as const,
      marginBottom: 8,
    },
    chipText: {
      color: p.textMuted,
      fontWeight: '700' as const,
    },
    chipTextActive: {
      color: p.primary,
    },
    hint: {
      color: p.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    input: {
      backgroundColor: p.surface || '#FFFDF8',
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 14,
      borderWidth: 1,
      color: p.text,
      minHeight: 110,
      padding: 14,
      textAlignVertical: 'top' as const,
      writingDirection: 'rtl' as const,
      marginBottom: 12,
    },
    switchRow: {
      alignItems: 'center' as const,
      flexDirection: 'row-reverse' as const,
      gap: 10,
      marginBottom: 6,
    },
    switchLabel: {
      color: p.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '700' as const,
      textAlign: 'right' as const,
    },
    card: {
      borderColor: 'rgba(196,163,90,0.28)',
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 12,
      padding: 14,
      backgroundColor: p.surface || '#FFFDF8',
    },
    cardKicker: {
      color: p.primary,
      fontSize: 12,
      fontWeight: '800' as const,
      marginBottom: 6,
      textAlign: 'right' as const,
    },
    cardTitle: {
      color: p.text,
      fontSize: 17,
      fontWeight: '800' as const,
      marginBottom: 6,
      textAlign: 'right' as const,
    },
    cardBody: {
      color: p.text,
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    meta: {
      color: p.textMuted,
      fontSize: 12,
      marginTop: 8,
      textAlign: 'right' as const,
    },
    contact: {
      color: p.primary,
      fontSize: 13,
      fontWeight: '700' as const,
      lineHeight: 20,
      marginTop: 10,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    status: {
      color: p.primary,
      fontSize: 13,
      fontWeight: '700' as const,
      marginTop: 10,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    error: {
      color: '#991b1b',
      fontSize: 13,
      marginBottom: 10,
      textAlign: 'right' as const,
    },
  };
}
