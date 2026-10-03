import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DataState } from '../components/DataState';
import { SceneShell } from '../components/scene';
import {
  MAJLIS_START_HOURS,
  buildTwelveHourWindow,
  createFamilyBoardPost,
  deleteFamilyBoardPost,
  extendFamilyBoardHour,
  familyBoardCategoriesForKind,
  familyBoardCategoryLabel,
  familyBoardCategoryMeta,
  familyBoardComingLabel,
  familyBoardKindLabel,
  familyBoardMetaLine,
  familyBoardWindowLabel,
  formatBoardHour,
  loadFamilyBoardPosts,
  toggleFamilyBoardComing,
  type FamilyBoardCategory,
  type FamilyBoardKind,
  type FamilyBoardPost,
} from '../services/familyBoard';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { canonicalizePhone, e164Digits } from '../utils/phone';

type Pane = 'list' | 'detail' | 'compose';

type FamilyBoardScreenProps = {
  onBack: () => void;
  memberPhone?: string | null;
  memberGreeting?: string | null;
  memberBranchKey?: string | null;
  initialPostId?: string | null;
};

function whatsappUrl(phone: string, title: string) {
  const normalized = e164Digits(canonicalizePhone(phone) || phone);
  const message = `السلام عليكم، بخصوص: ${title}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function FamilyBoardScreen({
  onBack,
  memberPhone,
  memberGreeting,
  memberBranchKey,
  initialPostId = null,
}: FamilyBoardScreenProps) {
  const p = useThemePalette();
  const styles = useMemo(() => boardStyles(p), [p]);
  const [pane, setPane] = useState<Pane>('list');
  const [posts, setPosts] = useState<FamilyBoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FamilyBoardPost | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<FamilyBoardKind>('offer');
  const [category, setCategory] = useState<FamilyBoardCategory>('other');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [place, setPlace] = useState('');
  const [daysAlive, setDaysAlive] = useState(3);
  const [windowStartHour, setWindowStartHour] = useState(16);

  const sessionPhone = canonicalizePhone(memberPhone || '');
  const canPost = Boolean(sessionPhone);
  const categoryOptions = useMemo(() => familyBoardCategoriesForKind(kind), [kind]);
  const categoryMeta = useMemo(() => familyBoardCategoryMeta(category), [category]);
  const majlisWindow = useMemo(
    () => (category === 'majlis' ? buildTwelveHourWindow(windowStartHour) : null),
    [category, windowStartHour],
  );

  useEffect(() => {
    if (!categoryOptions.some((row) => row.id === category)) {
      setCategory(categoryOptions[0]?.id || 'other');
    }
  }, [category, categoryOptions]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadFamilyBoardPosts(sessionPhone || memberPhone);
      setPosts(rows);
      if (initialPostId) {
        const hit = rows.find((row) => row.id === initialPostId);
        if (hit) {
          setSelected(hit);
          setPane('detail');
        }
      }
    } catch {
      setError('تعذر تحميل اللوحة.');
    } finally {
      setLoading(false);
    }
  }, [initialPostId, memberPhone, sessionPhone]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (pane !== 'list') return undefined;
    const id = setInterval(() => {
      void reload();
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [pane, reload]);

  const openDetail = (post: FamilyBoardPost) => {
    setSelected(post);
    setPane('detail');
    setStatus('');
  };

  const syncPost = (post: FamilyBoardPost) => {
    setPosts((prev) => [post, ...prev.filter((row) => row.id !== post.id)]);
    setSelected(post);
  };

  const extendSelected = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus('');
    try {
      const post = await extendFamilyBoardHour({ id: selected.id, authorPhone: sessionPhone });
      syncPost(post);
      setStatus('تم التمديد ساعة.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'تعذر التمديد.');
    } finally {
      setBusy(false);
    }
  };

  const toggleComing = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus('');
    try {
      const post = await toggleFamilyBoardComing({ id: selected.id, phone: sessionPhone });
      syncPost(post);
      setStatus(post.iAmComing ? 'تم: أنت جاي.' : 'تم إلغاء حضورك.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'تعذر التسجيل.');
    } finally {
      setBusy(false);
    }
  };

  const openCompose = () => {
    setStatus('');
    if (!canPost) {
      setStatus('سجّل دخولك من ملفي عشان تنشر.');
      return;
    }
    setKind('offer');
    setCategory('car');
    setTitle('');
    setBody('');
    setPlace('');
    setDaysAlive(3);
    setWindowStartHour(16);
    setPane('compose');
  };

  const submit = async () => {
    if (!canPost) {
      setStatus('سجّل دخولك من ملفي عشان تنشر.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const post = await createFamilyBoardPost({
        kind,
        category,
        title,
        body,
        place,
        branchKey: memberBranchKey || '',
        authorName: memberGreeting || '',
        authorPhone: sessionPhone,
        daysAlive,
        windowStartHour: category === 'majlis' ? windowStartHour : undefined,
        urgent: category === 'faza',
      });
      setPosts((prev) => [post, ...prev.filter((row) => row.id !== post.id)]);
      setSelected(post);
      setPane('detail');
      setStatus('تم النشر.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'تعذر النشر.');
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus('');
    try {
      await deleteFamilyBoardPost({ id: selected.id, authorPhone: sessionPhone });
      setPosts((prev) => prev.filter((row) => row.id !== selected.id));
      setSelected(null);
      setPane('list');
      setStatus('تم الحذف.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'تعذر الحذف.');
    } finally {
      setBusy(false);
    }
  };

  const heroBack = () => {
    if (pane === 'list') onBack();
    else {
      setPane('list');
      setSelected(null);
      setStatus('');
    }
  };

  const subtitle =
    pane === 'compose'
      ? 'عرض أو طلب يراه أهلك اليوم.'
      : pane === 'detail'
        ? familyBoardCategoryLabel(selected?.category || 'other')
        : 'اليوم داخل العائلة';

  return (
    <SceneShell
      english="FAMILY BOARD"
      eyebrow="منفعة اليوم"
      heroLead={
        <Pressable accessibilityRole="button" onPress={heroBack}>
          <Text style={styles.back}>{pane === 'list' ? 'رجوع للنبض' : 'رجوع'}</Text>
        </Pressable>
      }
      onRefresh={() => void reload()}
      refreshing={loading}
      subtitle={subtitle}
      title="وش عند الزيدان؟"
      variant="pulse"
    >
      {pane === 'list' ? (
        <View style={styles.stage}>
          <DataState error={error} loading={loading && !posts.length} onRetry={() => void reload()} />

          <Pressable
            accessibilityRole="button"
            onPress={openCompose}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>أضف عرض أو طلب</Text>
          </Pressable>
          {status && pane === 'list' ? <Text style={styles.status}>{status}</Text> : null}

          {!loading && !posts.length ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>اللوحة فاضية</Text>
              <Text style={styles.emptyBody}>كن أول من ينشر: فزعة، مجلس، سيارة، توصيلة، أو استراحة.</Text>
            </View>
          ) : null}

          {posts.map((post) => (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              onPress={() => openDetail(post)}
              style={({ pressed }) => [
                styles.card,
                post.urgent && styles.cardUrgent,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardKind}>
                  {post.urgent ? 'عاجل · ' : ''}
                  {familyBoardKindLabel(post.kind)} · {familyBoardCategoryLabel(post.category)}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{post.title}</Text>
              {familyBoardMetaLine(post) ? (
                <Text style={styles.cardMeta}>{familyBoardMetaLine(post)}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {pane === 'detail' && selected ? (
        <View style={styles.stage}>
          <View style={[styles.detailCard, selected.urgent && styles.cardUrgent]}>
            {selected.urgent ? <Text style={styles.urgentBadge}>طلب عاجل</Text> : null}
            <Text style={styles.detailTitle}>{selected.title}</Text>
            {familyBoardWindowLabel(selected) ? (
              <Text style={styles.windowLine}>
                {familyBoardWindowLabel(selected)}
                {selected.category === 'majlis' ? ' · ينحذف عند الانتهاء' : ''}
              </Text>
            ) : null}
            {selected.category === 'majlis' && (selected.comingCount || 0) > 0 ? (
              <Text style={styles.comingLine}>{familyBoardComingLabel(selected.comingCount)}</Text>
            ) : null}
            <Text style={styles.cardMeta}>{familyBoardMetaLine(selected)}</Text>
            {selected.body ? <Text style={styles.detailBody}>{selected.body}</Text> : null}
            <Text style={styles.author}>
              {selected.authorName || 'فرد من العائلة'}
              {selected.branchKey ? ` · فرع ${selected.branchKey}` : ''}
            </Text>
            {selected.category === 'majlis' &&
            sessionPhone &&
            canonicalizePhone(selected.authorPhone) !== sessionPhone ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void toggleComing()}
                style={({ pressed }) => [
                  styles.comingBtn,
                  selected.iAmComing && styles.comingBtnOn,
                  (pressed || busy) && styles.pressed,
                ]}
              >
                <Text style={[styles.comingBtnText, selected.iAmComing && styles.comingBtnTextOn]}>
                  {selected.iAmComing ? 'جاي · إلغاء' : 'أنا جاي'}
                </Text>
              </Pressable>
            ) : null}
            {selected.authorPhone ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Linking.openURL(
                      `tel:${canonicalizePhone(selected.authorPhone) || selected.authorPhone}`,
                    ).catch(() => setStatus('تعذر الاتصال.'))
                  }
                  style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.callBtnText}>اتصل</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Linking.openURL(whatsappUrl(selected.authorPhone, selected.title)).catch(() =>
                      setStatus('تعذر فتح واتساب.'),
                    )
                  }
                  style={({ pressed }) => [styles.waBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.waBtnText}>واتساب</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.emptyBody}>ما فيه رقم تواصل على هالإعلان.</Text>
            )}
            {sessionPhone &&
            canonicalizePhone(selected.authorPhone) === sessionPhone ? (
              <View style={styles.ownerActions}>
                {selected.category === 'majlis' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void extendSelected()}
                    style={({ pressed }) => [styles.extendBtn, (pressed || busy) && styles.pressed]}
                  >
                    <Text style={styles.extendBtnText}>{busy ? '…' : 'مدّ ساعة'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void removeSelected()}
                  style={({ pressed }) => [styles.deleteBtn, (pressed || busy) && styles.pressed]}
                >
                  <Text style={styles.deleteBtnText}>{busy ? 'جارٍ الحذف…' : 'حذف إعلاني'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
      ) : null}

      {pane === 'compose' ? (
        <View style={styles.stage}>
          <Text style={styles.fieldLabel}>تبغى تنشر</Text>
          <View style={styles.kindRow}>
            {(['offer', 'request'] as FamilyBoardKind[]).map((row) => {
              const on = kind === row;
              return (
                <Pressable
                  key={row}
                  onPress={() => setKind(row)}
                  style={[styles.kindCard, on && (row === 'request' ? styles.kindRequestOn : styles.kindOfferOn)]}
                >
                  <Text style={[styles.kindTitle, on && styles.kindTitleOn]}>
                    {row === 'offer' ? 'عندي شيء' : 'أحتاج شيء'}
                  </Text>
                  <Text style={[styles.kindHint, on && styles.kindHintOn]}>
                    {row === 'offer' ? 'عرض للعائلة' : 'طلب من العائلة'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>
            {kind === 'offer' ? 'وش عندك؟' : 'وش تحتاج؟'}
          </Text>
          <View style={styles.catGrid}>
            {categoryOptions.map((row) => {
              const on = category === row.id;
              const urgent = row.id === 'faza';
              return (
                <Pressable
                  key={row.id}
                  onPress={() => setCategory(row.id)}
                  style={[
                    styles.catCard,
                    on && styles.catCardOn,
                    urgent && styles.catCardFaza,
                    on && urgent && styles.catCardFazaOn,
                  ]}
                >
                  <View style={[styles.catMark, on && styles.catMarkOn, urgent && styles.catMarkFaza]}>
                    <Text style={[styles.catMarkText, on && styles.catMarkTextOn]}>{row.mark}</Text>
                  </View>
                  <View style={styles.catText}>
                    <Text style={[styles.catLabel, on && styles.catLabelOn]}>{row.label}</Text>
                    <Text style={[styles.catHint, on && styles.catHintOn]} numberOfLines={1}>
                      {row.hint}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>العنوان</Text>
          <TextInput
            placeholder={categoryMeta.titleExample}
            placeholderTextColor={p.textMuted}
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            textAlign="right"
          />

          <Text style={styles.fieldLabel}>التفاصيل</Text>
          <TextInput
            multiline
            placeholder={categoryMeta.bodyExample}
            placeholderTextColor={p.textMuted}
            style={[styles.input, styles.inputMulti]}
            value={body}
            onChangeText={setBody}
            textAlign="right"
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>المكان (اختياري)</Text>
          <TextInput
            placeholder="حائل · حي النقرة"
            placeholderTextColor={p.textMuted}
            style={styles.input}
            value={place}
            onChangeText={setPlace}
            textAlign="right"
          />

          {category === 'majlis' ? (
            <View style={styles.windowBox}>
              <Text style={styles.fieldLabel}>وقت التقهوي (١٢ ساعة)</Text>
              <Text style={styles.windowHint}>اختر البداية، والنهاية تتحسب تلقائي</Text>
              <View style={styles.chipRow}>
                {MAJLIS_START_HOURS.map((hour) => (
                  <Pressable
                    key={hour}
                    onPress={() => setWindowStartHour(hour)}
                    style={[styles.chip, windowStartHour === hour && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, windowStartHour === hour && styles.chipTextOn]}>
                      من {formatBoardHour(hour)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {majlisWindow ? (
                <Text style={styles.windowSummary}>
                  من {formatBoardHour(majlisWindow.startHour)} إلى{' '}
                  {formatBoardHour(majlisWindow.endHour)} · بعدين ينحذف
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>يبقى ظاهر</Text>
              <View style={styles.chipRow}>
                {[
                  { days: 0, label: 'اليوم' },
                  { days: 3, label: '٣ أيام' },
                  { days: 7, label: 'أسبوع' },
                ].map((row) => (
                  <Pressable
                    key={row.days}
                    onPress={() => setDaysAlive(row.days)}
                    style={[styles.chip, daysAlive === row.days && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, daysAlive === row.days && styles.chipTextOn]}>
                      {row.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {status ? <Text style={styles.status}>{status}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.publishBtn, (pressed || busy) && styles.pressed]}
          >
            <Text style={styles.publishBtnText}>{busy ? 'جارٍ النشر…' : 'انشر'}</Text>
          </Pressable>
        </View>
      ) : null}
    </SceneShell>
  );
}

function boardStyles(p: ThemePalette) {
  return StyleSheet.create({
    back: {
      color: 'rgba(232,213,168,0.95)',
      fontSize: typography.body,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    stage: {
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    addBtn: {
      alignItems: 'center',
      backgroundColor: p.gold,
      borderRadius: 16,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
    },
    addBtnText: {
      color: p.greenDeep,
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    emptyBox: {
      backgroundColor: p.creamLift,
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 18,
      borderWidth: 1,
      gap: 6,
      padding: spacing.md,
    },
    emptyTitle: {
      color: p.green,
      fontSize: typography.body,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    emptyBody: {
      color: p.textMuted,
      fontSize: typography.caption,
      fontWeight: '700',
      lineHeight: 22,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    card: {
      backgroundColor: p.creamLift,
      borderColor: 'rgba(196,163,90,0.4)',
      borderRadius: 18,
      borderWidth: 1,
      gap: 6,
      padding: spacing.md,
    },
    cardUrgent: {
      borderColor: 'rgba(160,70,60,0.55)',
    },
    cardTop: {
      alignItems: 'flex-end',
    },
    cardKind: {
      color: p.gold,
      fontSize: 12,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    cardTitle: {
      color: p.ink,
      fontSize: typography.body,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    cardMeta: {
      color: p.textMuted,
      fontSize: typography.caption,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    detailCard: {
      backgroundColor: p.creamLift,
      borderColor: 'rgba(196,163,90,0.45)',
      borderRadius: 22,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg,
    },
    urgentBadge: {
      alignSelf: 'flex-end',
      borderColor: p.gold,
      borderRadius: 999,
      borderWidth: 1,
      color: p.gold,
      fontSize: 12,
      fontWeight: '800',
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 4,
      writingDirection: 'rtl',
    },
    detailTitle: {
      color: p.ink,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    windowLine: {
      color: p.gold,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    comingLine: {
      color: p.green,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    comingBtn: {
      alignItems: 'center',
      backgroundColor: p.gold,
      borderRadius: 14,
      paddingVertical: 14,
    },
    comingBtnOn: {
      backgroundColor: p.greenDeep,
    },
    comingBtnText: {
      color: p.greenDeep,
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    comingBtnTextOn: {
      color: p.creamLift,
    },
    ownerActions: {
      gap: 10,
      marginTop: spacing.sm,
    },
    extendBtn: {
      alignItems: 'center',
      backgroundColor: p.greenDeep,
      borderRadius: 14,
      paddingVertical: 12,
    },
    extendBtnText: {
      color: p.creamLift,
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    windowBox: {
      backgroundColor: 'rgba(23,63,53,0.06)',
      borderColor: 'rgba(196,163,90,0.4)',
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    windowHint: {
      color: p.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: -4,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    windowSummary: {
      color: p.green,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    detailBody: {
      color: p.text,
      fontSize: typography.body,
      fontWeight: '700',
      lineHeight: 26,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    author: {
      color: p.green,
      fontSize: typography.caption,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    actions: {
      flexDirection: 'row-reverse',
      gap: 10,
      marginTop: spacing.sm,
    },
    callBtn: {
      alignItems: 'center',
      backgroundColor: p.greenDeep,
      borderRadius: 14,
      flex: 1,
      paddingVertical: 14,
    },
    callBtnText: {
      color: p.creamLift,
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    waBtn: {
      alignItems: 'center',
      borderColor: p.green,
      borderRadius: 14,
      borderWidth: 1.5,
      flex: 1,
      paddingVertical: 14,
    },
    waBtnText: {
      color: p.green,
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    deleteBtn: {
      alignItems: 'center',
      borderColor: 'rgba(160,70,60,0.55)',
      borderRadius: 14,
      borderWidth: 1,
      marginTop: spacing.sm,
      paddingVertical: 12,
    },
    deleteBtnText: {
      color: '#8B3A34',
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    fieldLabel: {
      color: p.green,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    kindRow: {
      flexDirection: 'row-reverse',
      gap: 10,
    },
    kindCard: {
      backgroundColor: 'rgba(23,63,53,0.05)',
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    kindOfferOn: {
      backgroundColor: p.greenDeep,
      borderColor: p.gold,
    },
    kindRequestOn: {
      backgroundColor: '#5C2E2A',
      borderColor: 'rgba(196,163,90,0.7)',
    },
    kindTitle: {
      color: p.ink,
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    kindTitleOn: {
      color: p.creamLift,
    },
    kindHint: {
      color: p.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    kindHintOn: {
      color: 'rgba(243,235,217,0.78)',
    },
    catGrid: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 8,
    },
    catCard: {
      alignItems: 'center',
      backgroundColor: p.creamLift,
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row-reverse',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      width: '48%',
    },
    catCardOn: {
      backgroundColor: 'rgba(23,63,53,0.1)',
      borderColor: p.green,
      borderWidth: 2,
    },
    catCardFaza: {
      borderColor: 'rgba(160,70,60,0.4)',
    },
    catCardFazaOn: {
      backgroundColor: 'rgba(160,70,60,0.12)',
      borderColor: '#8B3A34',
    },
    catMark: {
      alignItems: 'center',
      backgroundColor: 'rgba(23,63,53,0.1)',
      borderRadius: 10,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    catMarkOn: {
      backgroundColor: p.greenDeep,
    },
    catMarkFaza: {
      backgroundColor: 'rgba(160,70,60,0.18)',
    },
    catMarkText: {
      color: p.green,
      fontSize: 14,
      fontWeight: '800',
    },
    catMarkTextOn: {
      color: p.creamLift,
    },
    catText: {
      flex: 1,
      gap: 1,
    },
    catLabel: {
      color: p.ink,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    catLabelOn: {
      color: p.greenDeep,
    },
    catHint: {
      color: p.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    catHintOn: {
      color: p.text,
    },
    chipRow: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: 'rgba(23,63,53,0.06)',
      borderColor: 'rgba(196,163,90,0.35)',
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipOn: {
      backgroundColor: p.greenDeep,
      borderColor: p.gold,
    },
    chipText: {
      color: p.text,
      fontSize: 13,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    chipTextOn: {
      color: p.creamLift,
    },
    input: {
      backgroundColor: p.creamLift,
      borderColor: 'rgba(196,163,90,0.4)',
      borderRadius: 14,
      borderWidth: 1,
      color: p.ink,
      fontSize: typography.body,
      fontWeight: '700',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      writingDirection: 'rtl',
    },
    inputMulti: {
      minHeight: 100,
    },
    publishBtn: {
      alignItems: 'center',
      backgroundColor: p.greenDeep,
      borderRadius: 16,
      marginTop: spacing.sm,
      paddingVertical: 16,
    },
    publishBtnText: {
      color: p.creamLift,
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    status: {
      color: p.gold,
      fontSize: typography.caption,
      fontWeight: '800',
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
