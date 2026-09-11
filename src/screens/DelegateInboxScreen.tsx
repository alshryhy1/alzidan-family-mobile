import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { SceneSection, SceneShell } from '../components/scene';
import {
  bindDelegateInboxRequest,
  delegateInboxActionMessage,
  delegateInboxKindLabel,
  DelegateInboxRpcMissingError,
  fetchDelegateInboxRequests,
  fetchDelegateInboxSession,
  searchDelegateInboxPeople,
  setDelegateInboxRequestStatus,
  type DelegateInboxPerson,
  type DelegateInboxRequest,
  type DelegateInboxSession,
} from '../services/delegateInbox';
import { spacing, type ThemePalette } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { notifyRequesterStatusChanged } from '../services/eventOutboundNotify';
import { formatPhoneDisplay } from '../utils/phone';
import { pickRequestBindTarget } from '../utils/requestPersonMatch';

type DelegateInboxScreenProps = {
  onBack: () => void;
  delegatePhone: string;
};

function leafName(value: string) {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || value.trim();
}

function formatWhen(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

function roleLabel(roleKey: string | null) {
  if (roleKey === 'full_delegate') return 'شجرة ومناسبات';
  if (roleKey === 'events_editor') return 'مناسبات الفرع';
  if (roleKey === 'branch_editor') return 'شجرة الفرع';
  return 'مندوب فرع';
}

export function DelegateInboxScreen({ onBack, delegatePhone }: DelegateInboxScreenProps) {
  const styles = useThemedStyles(delegateInboxStyles);
  const phone = String(delegatePhone || '').trim();
  const [session, setSession] = useState<DelegateInboxSession | null>(null);
  const [rows, setRows] = useState<DelegateInboxRequest[]>([]);
  const [selected, setSelected] = useState<DelegateInboxRequest | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<DelegateInboxPerson[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sqlMissing, setSqlMissing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const load = useCallback(async () => {
    if (!phone) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText('');
    try {
      const nextSession = await fetchDelegateInboxSession(phone);
      setSession(nextSession);
      if (!nextSession.enabled) {
        setRows([]);
        return;
      }
      const next = await fetchDelegateInboxRequests(phone);
      setRows(next);
      setSelected((current) => {
        if (!current) return null;
        return next.find((row) => row.id === current.id) || null;
      });
    } catch (error) {
      if (error instanceof DelegateInboxRpcMissingError) setSqlMissing(true);
      else setErrorText(delegateInboxActionMessage(error));
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = useCallback(
    async (rawQuery: string) => {
      if (!selected || selected.lane !== 'phone') return;
      const q = rawQuery.trim() || leafName(selected.name);
      if (q.length < 2) {
        setMatches([]);
        setHasSearched(false);
        setErrorText('اكتب حرفين على الأقل للبحث.');
        return;
      }
      setSearching(true);
      setErrorText('');
      try {
        const next = await searchDelegateInboxPeople(phone, q);
        setMatches(next);
        setHasSearched(true);
      } catch (error) {
        setHasSearched(false);
        if (error instanceof DelegateInboxRpcMissingError) setSqlMissing(true);
        else setErrorText(delegateInboxActionMessage(error));
      } finally {
        setSearching(false);
      }
    },
    [phone, selected],
  );

  useEffect(() => {
    if (!selected || selected.lane !== 'phone') {
      setHasSearched(false);
      setMatches([]);
      return;
    }
    const nextQuery = leafName(selected.name);
    setQuery(nextQuery);
    void runSearch(nextQuery);
  }, [selected?.id, runSearch]);

  const suggestedBind = useMemo(() => {
    if (!selected || selected.lane !== 'phone') return null;
    return pickRequestBindTarget(query, selected.name, matches);
  }, [matches, query, selected]);

  function confirmReject(row: DelegateInboxRequest) {
    Alert.alert('رفض الطلب', 'يُرفض هذا الطلب المعلّق دون تنفيذ.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'رفض',
        style: 'destructive',
        onPress: () => {
          void doSet(row, 'rejected');
        },
      },
    ]);
  }

  function confirmApprove(row: DelegateInboxRequest) {
    Alert.alert('قبول الطلب', 'يُعلَّم الطلب مقبولًا. تنفيذ إضافة الفرد أو التصحيح الثقيل يبقى في بوابة الموقع إن لزم.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'قبول',
        onPress: () => {
          void doSet(row, 'approved');
        },
      },
    ]);
  }

  async function doSet(row: DelegateInboxRequest, status: 'approved' | 'rejected') {
    setBusyId(row.id);
    setErrorText('');
    try {
      await setDelegateInboxRequestStatus(phone, row.id, status);
      void notifyRequesterStatusChanged({
        request_id: row.requestId || String(row.id),
        kind: row.kind,
        branch_key: row.branchKey,
        phone: row.phone,
        name: row.name,
        status,
      });
      setSelected(null);
      setMatches([]);
      await load();
    } catch (error) {
      if (error instanceof DelegateInboxRpcMissingError) setSqlMissing(true);
      else setErrorText(delegateInboxActionMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  function confirmBind(person: DelegateInboxPerson) {
    if (!selected) return;
    Alert.alert(
      'اعتماد وربط',
      `ربط ${selected.phone ? formatPhoneDisplay(selected.phone) : 'الطلب'} بـ ${person.displayName}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'اعتماد',
          onPress: () => {
            void doBind(person);
          },
        },
      ],
    );
  }

  async function doBind(person: DelegateInboxPerson) {
    if (!selected) return;
    setBusyId(selected.id);
    setErrorText('');
    try {
      await bindDelegateInboxRequest({
        phone,
        requestId: selected.id,
        treeChildId: person.id,
      });
      void notifyRequesterStatusChanged({
        request_id: selected.requestId || String(selected.id),
        kind: selected.kind,
        branch_key: selected.branchKey,
        phone: selected.phone,
        name: selected.name,
        status: 'approved',
      });
      Alert.alert('تم الاعتماد', 'اعتُمد الطلب ورُبط بالشخص في فرعك.');
      setSelected(null);
      setMatches([]);
      await load();
    } catch (error) {
      if (error instanceof DelegateInboxRpcMissingError) setSqlMissing(true);
      else setErrorText(delegateInboxActionMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  const branch = session?.branchKey || '';
  const subtitle = branch ? `فرع ${branch} فقط — ليست إدارة عائلة` : 'صلاحية فرع المندوب المعتمد';

  return (
    <SceneShell title="طلبات فرعي" subtitle={subtitle} variant="archive">
      <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text style={styles.backText}>العودة إلى ملفي</Text>
      </Pressable>
      <SceneSection>
        <Text style={styles.lead}>
          الطلبات المعلّقة لفرعك تصل هنا على الجهاز الموثوق. إضافة الفرد وتصحيح الشجرة يبقيان في موقع العائلة عند الحاجة.
        </Text>
        {session?.enabled ? (
          <Text style={styles.meta}>{roleLabel(session.roleKey)}</Text>
        ) : null}
      </SceneSection>
      {!phone ? <Text style={styles.warn}>لا توجد جلسة جوال لهذا المدخل.</Text> : null}
      {sqlMissing ? (
        <Text style={styles.warn}>{delegateInboxActionMessage(new DelegateInboxRpcMissingError())}</Text>
      ) : null}
      {errorText ? <Text style={styles.warn}>{errorText}</Text> : null}
      {phone && !sqlMissing && session && !session.enabled ? (
        <Text style={styles.warn}>هذا الرقم ليس مندوب فرع معتمدًا على جهاز موثوق.</Text>
      ) : null}
      {phone && !sqlMissing && session?.enabled ? (
        selected ? (
          <SceneSection title={delegateInboxKindLabel(selected.kind, selected.lane)}>
            <View style={styles.card}>
              <Text style={styles.cardName}>{selected.name || 'بدون اسم'}</Text>
              {selected.phone ? <Text style={styles.cardMeta}>{formatPhoneDisplay(selected.phone)}</Text> : null}
              <Text style={styles.cardMeta}>
                {[selected.branchKey, formatWhen(selected.createdAt)].filter(Boolean).join(' · ')}
              </Text>
              {selected.detail ? <Text style={styles.cardMeta}>{selected.detail}</Text> : null}
              <Pressable
                onPress={() => {
                  setSelected(null);
                  setMatches([]);
                }}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>تغيير الطلب</Text>
              </Pressable>
            </View>
            {selected.lane === 'phone' ? (
              <>
                <Text style={styles.fieldLabel}>ابحث عن الشخص في فرعك للربط</Text>
                <TextInput
                  onChangeText={(value) => {
                    setQuery(value);
                    setHasSearched(false);
                  }}
                  placeholder="اسم الشخص"
                  placeholderTextColor="#8A7A6A"
                  returnKeyType="search"
                  style={styles.input}
                  textAlign="right"
                  value={query}
                  onSubmitEditing={() => {
                    void runSearch(query);
                  }}
                />
                <ActionButton label={searching ? 'جاري البحث…' : 'بحث'} onPress={() => void runSearch(query)} />
                {searching ? <Text style={styles.meta}>جاري البحث في فرعك…</Text> : null}
                {suggestedBind ? (
                  <ActionButton
                    label={
                      busyId === selected.id
                        ? 'جاري الاعتماد…'
                        : `اعتماد وربط بـ ${suggestedBind.displayName}`
                    }
                    onPress={() => confirmBind(suggestedBind)}
                  />
                ) : null}
                {hasSearched && !searching && matches.length === 0 ? (
                  <Text style={styles.warn}>
                    لا يوجد شخص مطابق في فرعك. عدّل الاسم وأعد البحث.
                  </Text>
                ) : null}
                {hasSearched && !searching && matches.length > 1 && !suggestedBind ? (
                  <Text style={styles.meta}>عدة نتائج — اختر الشخص الصحيح:</Text>
                ) : null}
                {matches.map((person) => (
                  <Pressable
                    key={person.id}
                    disabled={busyId != null}
                    onPress={() => confirmBind(person)}
                    style={({ pressed }) => [
                      styles.card,
                      suggestedBind?.id === person.id && styles.activeCard,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.cardName}>{person.displayName}</Text>
                    {person.path && person.path !== person.displayName ? (
                      <Text style={styles.cardMeta}>{person.path}</Text>
                    ) : null}
                    <Text style={styles.cardMeta}>
                      {person.branchKey || 'بدون فرع'}
                      {person.phone ? ` · ${formatPhoneDisplay(person.phone)}` : ''}
                    </Text>
                    <Text style={styles.linkText}>اختيار هذا الشخص</Text>
                  </Pressable>
                ))}
              </>
            ) : (
              <ActionButton
                label={busyId === selected.id ? 'جاري القبول…' : 'قبول الطلب'}
                onPress={() => confirmApprove(selected)}
              />
            )}
            <ActionButton
              label={busyId === selected.id ? 'جاري الرفض…' : 'رفض الطلب'}
              variant="secondary"
              onPress={() => confirmReject(selected)}
            />
          </SceneSection>
        ) : (
          <SceneSection title="معلّقة">
            {loading ? <Text style={styles.meta}>جاري تحميل الطلبات…</Text> : null}
            {!loading && rows.length === 0 ? (
              <Text style={styles.hint}>لا طلبات معلّقة في فرعك الآن.</Text>
            ) : null}
            {rows.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => {
                  setSelected(row);
                  setQuery(leafName(row.name));
                  setMatches([]);
                  setHasSearched(false);
                  setErrorText('');
                }}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Text style={styles.cardName}>{row.name || 'بدون اسم'}</Text>
                <Text style={styles.cardMeta}>{delegateInboxKindLabel(row.kind, row.lane)}</Text>
                {row.phone ? <Text style={styles.cardMeta}>{formatPhoneDisplay(row.phone)}</Text> : null}
                <Text style={styles.cardMeta}>{formatWhen(row.createdAt)}</Text>
              </Pressable>
            ))}
          </SceneSection>
        )
      ) : null}
    </SceneShell>
  );
}

function delegateInboxStyles(p: ThemePalette) {
  return {
    back: {
      alignSelf: 'flex-end' as const,
      marginBottom: spacing.sm,
      paddingVertical: 8,
    },
    backText: {
      color: p.primaryDark,
      fontSize: 15,
      fontWeight: '800' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    pressed: { opacity: 0.72 },
    lead: {
      color: p.text,
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 24,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    hint: {
      color: p.textMuted,
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 22,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    warn: {
      color: p.condolence,
      fontSize: 14,
      fontWeight: '700' as const,
      lineHeight: 22,
      marginTop: 10,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    meta: {
      color: p.textMuted,
      fontSize: 14,
      marginTop: 8,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    fieldLabel: {
      color: p.text,
      fontSize: 13,
      fontWeight: '800' as const,
      marginTop: spacing.md,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    input: {
      backgroundColor: p.surfaceMuted,
      borderRadius: 16,
      color: p.text,
      fontSize: 15,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      writingDirection: 'rtl' as const,
    },
    card: {
      backgroundColor: p.surface,
      borderColor: p.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: 4,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    activeCard: {
      borderColor: p.primary,
      borderWidth: 2,
    },
    cardName: {
      color: p.text,
      fontSize: 16,
      fontWeight: '800' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    cardMeta: {
      color: p.textMuted,
      fontSize: 13,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    linkBtn: {
      alignSelf: 'flex-end' as const,
      marginTop: 6,
      paddingVertical: 4,
    },
    linkText: {
      color: p.primaryDark,
      fontSize: 13,
      fontWeight: '800' as const,
      marginTop: 4,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
  };
}
