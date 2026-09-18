import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AdminBackendStatusBanner } from '../components/AdminBackendStatus';
import { ActionButton } from '../components/ActionButton';
import { PhoneField } from '../components/PhoneField';
import { SceneSection, SceneShell } from '../components/scene';
import {
  addWomenMember,
  bindWomenPhoneRequest,
  fetchWomenMotherChildren,
  fetchWomenPhoneRequests,
  linkWomenMotherChild,
  searchWomenMembers,
  searchWomenTreePeople,
  setWomenMemberPhone,
  setWomenPendingPhone,
  unlinkWomenMotherChild,
  womenManagerActionMessage,
  WomenManagerRpcMissingError,
  type WomenMemberMatch,
  type WomenMotherChild,
  type WomenPhoneRequest,
  type WomenTreePerson,
} from '../services/womenManager';
import { spacing, type ThemePalette } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import {
  DEFAULT_PHONE_COUNTRY_ID,
  formatPhoneDisplay,
  isValidPhone,
  parsePhoneToParts,
  toE164,
} from '../utils/phone';
import { pickRequestBindTarget } from '../utils/requestPersonMatch';

type WomenAdminScreenProps = {
  onBack: () => void;
  managerPhone: string;
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

function memberMatchKey(member: WomenMemberMatch) {
  return member.kind === 'pending' ? `p:${member.memberId || 0}` : `t:${member.id}`;
}

function isPendingMember(member: WomenMemberMatch) {
  return member.kind === 'pending' || String(member.status || '').toLowerCase() === 'pending_family';
}

function memberStatusLabel(member: WomenMemberMatch) {
  if (isPendingMember(member)) return 'بانتظار التثبيت العائلي';
  if (!member.phone) return 'بلا جوال';
  const status = String(member.status || 'active').toLowerCase();
  if (status === 'active') return 'عضوية مفعّلة';
  return 'عضوية غير مفعّلة';
}

export function WomenAdminScreen({ onBack, managerPhone }: WomenAdminScreenProps) {
  const styles = useThemedStyles(womenAdminStyles);
  const phone = String(managerPhone || '').trim();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sqlMissing, setSqlMissing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [requests, setRequests] = useState<WomenPhoneRequest[]>([]);
  const [selected, setSelected] = useState<WomenPhoneRequest | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<WomenMemberMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [bindingId, setBindingId] = useState<number | null>(null);

  const loadRequests = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!phone) {
        setRequests([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setErrorText('');
      try {
        const rows = await fetchWomenPhoneRequests(phone);
        setSqlMissing(false);
        setRequests(rows);
        setSelected((current) => {
          if (!current) return null;
          return rows.find((row) => row.id === current.id) || null;
        });
      } catch (error) {
        if (error instanceof WomenManagerRpcMissingError) {
          setSqlMissing(true);
          setRequests([]);
        } else {
          setErrorText(womenManagerActionMessage(error, 'requests'));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [phone],
  );

  useEffect(() => {
    void loadRequests('initial');
  }, [loadRequests]);

  const runSearch = useCallback(
    async (rawQuery: string) => {
      if (!phone || !selected) return;
      const q = rawQuery.trim();
      if (q.length < 2) {
        setMatches([]);
        setHasSearched(false);
        setErrorText('اكتبي حرفين على الأقل للبحث عن العضوة.');
        return;
      }
      setSearching(true);
      setErrorText('');
      try {
        const rows = (await searchWomenMembers(phone, q)).filter(
          (row) => row.kind === 'tree' && row.id > 0,
        );
        setSqlMissing(false);
        setMatches(rows);
        setHasSearched(true);
        if (!rows.length) setErrorText('لا توجد عضوة بهذا الاسم ضمن نطاق البحث.');
      } catch (error) {
        setHasSearched(false);
        if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
        else setErrorText(womenManagerActionMessage(error, 'requests'));
        setMatches([]);
      } finally {
        setSearching(false);
      }
    },
    [phone, selected],
  );

  useEffect(() => {
    if (!selected) {
      setMatches([]);
      setHasSearched(false);
      setQuery('');
      return;
    }
    const nextQuery = leafName(selected.name);
    setQuery(nextQuery);
    if (nextQuery.length >= 2) void runSearch(nextQuery);
  }, [selected?.id, runSearch]);

  const suggestedBind = useMemo(() => {
    if (!selected) return null;
    const target = pickRequestBindTarget(query, selected.name, matches);
    if (!target || target.id < 1) return null;
    return matches.find((row) => row.id === target.id) || null;
  }, [matches, query, selected]);

  function confirmBind(member: WomenMemberMatch) {
    if (!selected || bindingId) return;
    if (member.kind !== 'tree' || member.id < 1) return;
    const phoneLabel = formatPhoneDisplay(selected.phone);
    const extra = member.phone
      ? `\nلهذه العضوة جوال حالياً: ${formatPhoneDisplay(member.phone)}. إن لم يكن الرقم مربوطاً بشخص آخر سيُستبدل بالرقم الجديد.`
      : '';
    Alert.alert(
      'ربط الجوال؟',
      `سيُربط ${phoneLabel} بالعضوة «${member.displayName}» ويُفعَّل حسابها. لن يتغيّر الاسم أو النسب.${extra}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'ربط وتفعيل',
          onPress: () => {
            void doBind(member);
          },
        },
      ],
    );
  }

  async function doBind(member: WomenMemberMatch) {
    if (!selected || !phone) return;
    setBindingId(member.id);
    setErrorText('');
    try {
      await bindWomenPhoneRequest({
        managerPhone: phone,
        requestId: selected.id,
        treeChildId: member.id,
      });
      setSelected(null);
      setMatches([]);
      setQuery('');
      await loadRequests('refresh');
      Alert.alert('تم الربط', 'رُبط الجوال بالعضوة وفُعّل حسابها.');
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'requests'));
    } finally {
      setBindingId(null);
    }
  }

  return (
    <SceneShell
      title="إدارة النساء"
      subtitle="صلاحية مسؤولة نسائية — ليست إدارة كاملة"
      variant="archive"
      onRefresh={() => {
        void loadRequests('refresh');
      }}
      refreshing={refreshing}
    >
      <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text style={styles.backText}>العودة إلى ملفي</Text>
      </Pressable>
      <SceneSection>
        <Text style={styles.lead}>
          هذا المدخل يظهر فقط لمن عيّنتها الإدارة الأصلية. كل إجراء يُنفَّذ مباشرة على السيرفر من هذا الجهاز.
        </Text>
        {phone ? <AdminBackendStatusBanner surface="women" phone={phone} /> : null}
      </SceneSection>

      <SceneSection title="طلبات الجوال">
        <Text style={styles.hint}>اعتماد ربط الرقم بعضوة موجودة. لا إنشاء شخص جديد ولا تعديل الاسم أو النسب.</Text>
        {!phone ? (
          <Text style={styles.warn}>لا توجد جلسة جوال لهذا المدخل.</Text>
        ) : sqlMissing ? (
          <Text style={styles.warn}>{womenManagerActionMessage(new WomenManagerRpcMissingError(), 'requests')}</Text>
        ) : loading ? (
          <Text style={styles.meta}>جاري تحميل الطلبات…</Text>
        ) : selected ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardName}>{selected.name || 'بدون اسم ثلاثي'}</Text>
              <Text style={styles.cardMeta}>{formatPhoneDisplay(selected.phone)}</Text>
              {selected.branchKey ? <Text style={styles.cardMeta}>{selected.branchKey}</Text> : null}
              <Pressable
                onPress={() => setSelected(null)}
                style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
              >
                <Text style={styles.linkText}>تغيير الطلب</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>ابحثي عن العضوة في الشجرة</Text>
            <TextInput
              onChangeText={(value) => {
                setQuery(value);
                setHasSearched(false);
              }}
              placeholder="اسم العضوة"
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
            {searching ? <Text style={styles.meta}>جاري البحث في الشجرة…</Text> : null}
            {suggestedBind ? (
              <ActionButton
                label={
                  bindingId === suggestedBind.id
                    ? 'جاري الربط…'
                    : `ربط وتفعيل — ${suggestedBind.displayName}`
                }
                onPress={() => confirmBind(suggestedBind)}
              />
            ) : null}
            {hasSearched && !searching && matches.length > 1 && !suggestedBind ? (
              <Text style={styles.meta}>عدة نتائج — اختاري العضوة الصحيحة:</Text>
            ) : null}
            {matches.map((member) => (
              <Pressable
                key={memberMatchKey(member)}
                disabled={bindingId != null}
                onPress={() => confirmBind(member)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Text style={styles.cardName}>{member.displayName}</Text>
                {member.path && member.path !== member.displayName ? (
                  <Text style={styles.cardMeta}>{member.path}</Text>
                ) : null}
                <Text style={styles.cardMeta}>
                  {member.branchKey || 'بدون فرع'}
                  {member.phone ? ` · ${formatPhoneDisplay(member.phone)}` : ' · بلا جوال مربوط'}
                </Text>
                <Text style={styles.linkText}>
                  {bindingId === member.id ? 'جاري الربط…' : 'اختيار هذه العضوة'}
                </Text>
              </Pressable>
            ))}
          </>
        ) : requests.length ? (
          requests.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => {
                setSelected(row);
                setHasSearched(false);
                setMatches([]);
              }}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardName}>{row.name || 'بدون اسم ثلاثي'}</Text>
              <Text style={styles.cardMeta}>{formatPhoneDisplay(row.phone)}</Text>
              <Text style={styles.cardMeta}>
                {[row.branchKey, formatWhen(row.createdAt)].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.meta}>لا توجد طلبات جوال معلّقة.</Text>
        )}
        {errorText ? <Text style={styles.warn}>{errorText}</Text> : null}
      </SceneSection>

      <WomenMembersSection managerPhone={phone} styles={styles} />

      <WomenMothersSection managerPhone={phone} styles={styles} />
    </SceneShell>
  );
}

type WomenMembersSectionProps = {
  managerPhone: string;
  styles: Record<string, any>;
};

function WomenMembersSection({ managerPhone, styles }: WomenMembersSectionProps) {
  const phone = String(managerPhone || '').trim();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<WomenMemberMatch[]>([]);
  const [selected, setSelected] = useState<WomenMemberMatch | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sqlMissing, setSqlMissing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [addName, setAddName] = useState('');
  const [addCountryId, setAddCountryId] = useState(DEFAULT_PHONE_COUNTRY_ID);
  const [addNational, setAddNational] = useState('');
  const [countryId, setCountryId] = useState(DEFAULT_PHONE_COUNTRY_ID);
  const [national, setNational] = useState('');

  const selectedKey = selected ? memberMatchKey(selected) : '';
  useEffect(() => {
    if (!selected) {
      setCountryId(DEFAULT_PHONE_COUNTRY_ID);
      setNational('');
      return;
    }
    const parts = parsePhoneToParts(selected.phone || '');
    setCountryId(parts.countryId || DEFAULT_PHONE_COUNTRY_ID);
    setNational(parts.national || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fill the field when the chosen member changes
  }, [selectedKey]);

  async function runSearch(nextQuery?: string) {
    if (!phone) return;
    const q = String(nextQuery ?? query).trim();
    if (q.length < 2) {
      setMatches([]);
      setErrorText('اكتبي حرفين على الأقل للبحث عن العضوة.');
      return;
    }
    setSearching(true);
    setErrorText('');
    try {
      const rows = await searchWomenMembers(phone, q);
      setSqlMissing(false);
      setMatches(rows);
      setSelected((current) => {
        if (!current) return null;
        return rows.find((row) => memberMatchKey(row) === memberMatchKey(current)) || current;
      });
      if (!rows.length) {
        setErrorText(
          addName.trim()
            ? 'ليست في الشجرة بهذا البحث. إن كان الاسم مكتوبًا في «إضافة عضوة»، اضغطي إضافة لحفظها بانتظار التثبيت.'
            : 'لا توجد عضوة بهذا الاسم ضمن نطاق البحث.',
        );
      }
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'members'));
      setMatches([]);
    } finally {
      setSearching(false);
    }
  }

  function confirmSave() {
    if (!selected || saving) return;
    if (!isValidPhone(countryId, national)) {
      setErrorText('أدخلي رقم جوال صحيحًا.');
      return;
    }
    const nextPhone = toE164(countryId, national);
    const pending = isPendingMember(selected);
    Alert.alert(
      pending ? 'حفظ الجوال كجهة اتصال؟' : 'حفظ الجوال؟',
      pending
        ? `سيُحفظ ${formatPhoneDisplay(nextPhone)} على «${selected.displayName}» للتواصل فقط. لن يدخل التطبيق حتى تثبّت الإدارة الأصلية الربط على شخص الشجرة.`
        : `سيُحفظ ${formatPhoneDisplay(nextPhone)} على «${selected.displayName}» ويُفعَّل حسابها. لن يتغيّر الاسم أو النسب.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: pending ? 'حفظ' : 'حفظ وتفعيل',
          onPress: () => {
            void doSave(nextPhone);
          },
        },
      ],
    );
  }

  async function doSave(memberPhone: string) {
    if (!selected || !phone) return;
    setSaving(true);
    setErrorText('');
    try {
      if (isPendingMember(selected)) {
        const memberId = Number(selected.memberId || 0);
        if (memberId < 1) throw new Error('not_pending');
        await setWomenPendingPhone({
          managerPhone: phone,
          memberId,
          memberPhone,
        });
        setSqlMissing(false);
        Alert.alert('تم الحفظ', 'رُبط الجوال كجهة اتصال. الدخول بعد التثبيت العائلي فقط.');
      } else {
        await setWomenMemberPhone({
          managerPhone: phone,
          treeChildId: selected.id,
          memberPhone,
        });
        setSqlMissing(false);
        Alert.alert('تم الحفظ', 'رُبط الجوال بالعضوة وفُعّل حسابها.');
      }
      await runSearch();
    } catch (error) {
      setErrorText(womenManagerActionMessage(error, 'members'));
    } finally {
      setSaving(false);
    }
  }

  async function doAdd() {
    if (!phone || adding) return;
    const name = addName.trim();
    if (name.length < 2) {
      setErrorText('اكتبي الاسم الكامل كما هو، حرفين على الأقل.');
      return;
    }
    const hasPhone = String(addNational || '').trim().length > 0;
    if (hasPhone && !isValidPhone(addCountryId, addNational)) {
      setErrorText('أدخلي رقم جوال صحيحًا، أو اتركي الحقل فارغًا.');
      return;
    }
    const memberPhone = hasPhone ? toE164(addCountryId, addNational) : '';
    setAdding(true);
    setErrorText('');
    try {
      const result = await addWomenMember({
        managerPhone: phone,
        fullName: name,
        memberPhone,
      });
      setSqlMissing(false);
      if (result.action === 'existing_tree') {
        Alert.alert(
          'موجودة في الشجرة',
          'هذه العضوة موجودة في سجل العائلة. ابحثي عنها لحفظ الجوال وتفعيل الحساب. لا تُنشأ عضوية معلّقة مكررة.',
        );
      } else if (result.action === 'placed') {
        Alert.alert(
          'أُضيفت مباشرة',
          'طابق الاسم الأب والجد والعائلة في الشجرة فأُضيفت كابنة. يمكن البحث عنها الآن.',
        );
      } else if (result.action === 'existing_pending') {
        Alert.alert(
          'عضوة بانتظار التثبيت',
          'الاسم أو النسب غير مطابق لشخص واحد في الشجرة. الإدارة الأصلية تعدّل وتحفظ من التثبيت العائلي.',
        );
      } else {
        Alert.alert(
          'أُرسلت للتثبيت العائلي',
          'الأب أو الجد أو العائلة غير مطابق. الإدارة الأصلية تعدّل الاسم وتحفظه تحت الأب الصحيح.',
        );
      }
      setAddName('');
      setAddNational('');
      setQuery(name);
      await runSearch(name);
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'members'));
    } finally {
      setAdding(false);
    }
  }

  const pendingSelected = selected ? isPendingMember(selected) : false;

  return (
    <SceneSection title="العضوات">
      <Text style={styles.hint}>
        أضيفي الاسم الكامل: البنت ثم الأب ثم الجد ثم العائلة. إن طابق الشجرة تُضاف مباشرة. إن وُجد خطأ تُرسل للتثبيت العائلي.
      </Text>
      {!phone ? (
        <Text style={styles.warn}>لا توجد جلسة جوال لهذا المدخل.</Text>
      ) : sqlMissing ? (
        <Text style={styles.warn}>{womenManagerActionMessage(new WomenManagerRpcMissingError(), 'members')}</Text>
      ) : (
        <>
          <Text style={styles.fieldLabel}>إضافة عضوة</Text>
          <TextInput
            onChangeText={setAddName}
            placeholder="الاسم الكامل كما يُكتب"
            placeholderTextColor="#8A7A6A"
            style={styles.input}
            textAlign="right"
            value={addName}
          />
          <PhoneField
            countryId={addCountryId}
            national={addNational}
            onCountryChange={setAddCountryId}
            onNationalChange={setAddNational}
            label="جوال (اختياري)"
            hint="جهة اتصال فقط. لا يفتح التطبيق قبل تثبيت الإدارة الأصلية."
          />
          <ActionButton label={adding ? 'جاري الإضافة…' : 'إضافة'} onPress={() => void doAdd()} />

          <Text style={styles.fieldLabel}>ابحثي عن العضوة</Text>
          <TextInput
            onChangeText={setQuery}
            placeholder="اسم العضوة"
            placeholderTextColor="#8A7A6A"
            returnKeyType="search"
            style={styles.input}
            textAlign="right"
            value={query}
            onSubmitEditing={() => {
              void runSearch();
            }}
          />
          <ActionButton label={searching ? 'جاري البحث…' : 'بحث'} onPress={() => void runSearch()} />
          {selected ? (
            <View style={styles.card}>
              <Text style={styles.cardName}>{selected.displayName}</Text>
              {selected.path && selected.path !== selected.displayName ? (
                <Text style={styles.cardMeta}>{selected.path}</Text>
              ) : null}
              <Text style={styles.cardMeta}>
                {[selected.branchKey || (pendingSelected ? 'بدون فرع بعد' : 'بدون فرع'), memberStatusLabel(selected)].join(
                  ' · ',
                )}
              </Text>
              <Pressable
                onPress={() => setSelected(null)}
                style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
              >
                <Text style={styles.linkText}>تغيير العضوة</Text>
              </Pressable>
              <PhoneField
                countryId={countryId}
                national={national}
                onCountryChange={setCountryId}
                onNationalChange={setNational}
                label="جوال العضوة"
                hint={
                  pendingSelected
                    ? 'يُحفظ كجهة اتصال. لن يُفعَّل الدخول قبل التثبيت العائلي.'
                    : 'يُحفظ على ملف العضوية فقط، لا على سجل النسب.'
                }
              />
              <ActionButton
                label={
                  saving
                    ? 'جاري الحفظ…'
                    : pendingSelected
                      ? 'حفظ الجوال (جهة اتصال)'
                      : 'حفظ الجوال وتفعيل'
                }
                onPress={confirmSave}
              />
            </View>
          ) : (
            matches.map((member) => (
              <Pressable
                key={memberMatchKey(member)}
                onPress={() => setSelected(member)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Text style={styles.cardName}>{member.displayName}</Text>
                {member.path && member.path !== member.displayName ? (
                  <Text style={styles.cardMeta}>{member.path}</Text>
                ) : null}
                <Text style={styles.cardMeta}>
                  {member.branchKey || (isPendingMember(member) ? 'بدون فرع بعد' : 'بدون فرع')} ·{' '}
                  {memberStatusLabel(member)}
                  {member.phone ? ` · ${formatPhoneDisplay(member.phone)}` : ''}
                </Text>
              </Pressable>
            ))
          )}
        </>
      )}
      {errorText ? <Text style={styles.warn}>{errorText}</Text> : null}
    </SceneSection>
  );
}

type WomenMothersSectionProps = {
  managerPhone: string;
  styles: Record<string, any>;
};

function WomenMothersSection({ managerPhone, styles }: WomenMothersSectionProps) {
  const phone = String(managerPhone || '').trim();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<WomenMemberMatch[]>([]);
  const [mother, setMother] = useState<WomenMemberMatch | null>(null);
  const [children, setChildren] = useState<WomenMotherChild[]>([]);
  const [noSpouse, setNoSpouse] = useState(false);
  const [childQuery, setChildQuery] = useState('');
  const [childMatches, setChildMatches] = useState<WomenTreePerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchingChild, setSearchingChild] = useState(false);
  const [loadingKids, setLoadingKids] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [sqlMissing, setSqlMissing] = useState(false);
  const [errorText, setErrorText] = useState('');

  async function loadChildren(nextMother: WomenMemberMatch) {
    if (!phone || nextMother.id < 1) return;
    setLoadingKids(true);
    setErrorText('');
    try {
      const overview = await fetchWomenMotherChildren(phone, nextMother.id);
      setSqlMissing(false);
      setChildren(overview.children);
      setNoSpouse(overview.noSpouse);
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'mothers'));
      setChildren([]);
    } finally {
      setLoadingKids(false);
    }
  }

  async function runMotherSearch() {
    if (!phone) return;
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      setErrorText('اكتبي حرفين على الأقل للبحث عن الأم.');
      return;
    }
    setSearching(true);
    setErrorText('');
    try {
      const rows = (await searchWomenMembers(phone, q)).filter(
        (row) => row.kind === 'tree' && row.id > 0,
      );
      setSqlMissing(false);
      setMatches(rows);
      if (!rows.length) setErrorText('لا توجد أم بهذا الاسم في الشجرة.');
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'mothers'));
      setMatches([]);
    } finally {
      setSearching(false);
    }
  }

  async function chooseMother(next: WomenMemberMatch) {
    setMother(next);
    setChildQuery('');
    setChildMatches([]);
    await loadChildren(next);
  }

  async function runChildSearch() {
    if (!phone || !mother) return;
    const q = childQuery.trim();
    if (q.length < 2) {
      setChildMatches([]);
      setErrorText('اكتبي حرفين على الأقل للبحث عن الابن في الشجرة.');
      return;
    }
    setSearchingChild(true);
    setErrorText('');
    try {
      const rows = (await searchWomenTreePeople(phone, q)).filter(
        (row) => row.id !== mother.id,
      );
      setSqlMissing(false);
      setChildMatches(rows);
      if (!rows.length) setErrorText('لا يوجد شخص بهذا الاسم في الشجرة.');
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'mothers'));
      setChildMatches([]);
    } finally {
      setSearchingChild(false);
    }
  }

  function confirmLink(child: WomenTreePerson) {
    if (!mother || workingId) return;
    Alert.alert(
      'ربط الأمومة؟',
      `تُربط «${mother.displayName}» أمًا لـ «${child.displayName}» في الشجرة. لن يُنشأ شخص جديد ولن يُسجَّل زواج.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'ربط',
          onPress: () => {
            void doLink(child);
          },
        },
      ],
    );
  }

  async function doLink(child: WomenTreePerson) {
    if (!mother || !phone) return;
    setWorkingId(child.id);
    setErrorText('');
    try {
      await linkWomenMotherChild({
        managerPhone: phone,
        motherTreeChildId: mother.id,
        childTreeChildId: child.id,
      });
      setSqlMissing(false);
      setChildMatches([]);
      setChildQuery('');
      Alert.alert('تم الربط', 'رُبطت الأمومة على شخص موجود في الشجرة.');
      await loadChildren(mother);
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'mothers'));
    } finally {
      setWorkingId(null);
    }
  }

  function confirmUnlink(child: WomenMotherChild) {
    if (!mother || workingId) return;
    Alert.alert(
      'فك ربط الأمومة؟',
      `يُفك ربط «${child.displayName}» عن «${mother.displayName}». يبقى الشخص في الشجرة.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'فك الربط',
          style: 'destructive',
          onPress: () => {
            void doUnlink(child);
          },
        },
      ],
    );
  }

  async function doUnlink(child: WomenMotherChild) {
    if (!mother || !phone) return;
    setWorkingId(child.id);
    setErrorText('');
    try {
      await unlinkWomenMotherChild({
        managerPhone: phone,
        motherTreeChildId: mother.id,
        childTreeChildId: child.id,
      });
      setSqlMissing(false);
      await loadChildren(mother);
    } catch (error) {
      if (error instanceof WomenManagerRpcMissingError) setSqlMissing(true);
      else setErrorText(womenManagerActionMessage(error, 'mothers'));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <SceneSection title="الأمهات">
      <Text style={styles.hint}>
        أم موجودة في الشجرة → ابن موجود في الشجرة. الربط عبر سجل الأمومة فقط. لا زواج جديد ولا إدخال ابن خارج النطاق.
      </Text>
      {!phone ? (
        <Text style={styles.warn}>لا توجد جلسة جوال لهذا المدخل.</Text>
      ) : sqlMissing ? (
        <Text style={styles.warn}>{womenManagerActionMessage(new WomenManagerRpcMissingError(), 'mothers')}</Text>
      ) : mother ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardName}>{mother.displayName}</Text>
            {mother.path && mother.path !== mother.displayName ? (
              <Text style={styles.cardMeta}>{mother.path}</Text>
            ) : null}
            <Pressable
              onPress={() => {
                setMother(null);
                setChildren([]);
                setNoSpouse(false);
                setChildMatches([]);
              }}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>تغيير الأم</Text>
            </Pressable>
          </View>
          {noSpouse ? (
            <Text style={styles.warn}>
              لا توجد زوجية مسجّلة لهذه الأم. سجّلي الزواج من الإدارة الأصلية ثم اربطي الأبناء هنا.
            </Text>
          ) : null}
          {loadingKids ? <Text style={styles.meta}>جاري تحميل الأبناء المربوطين…</Text> : null}
          {children.length ? (
            children.map((child) => (
              <View key={child.id} style={styles.card}>
                <Text style={styles.cardName}>{child.displayName}</Text>
                {child.path && child.path !== child.displayName ? (
                  <Text style={styles.cardMeta}>{child.path}</Text>
                ) : null}
                <Text style={styles.cardMeta}>{child.branchKey || 'بدون فرع'}</Text>
                <Pressable
                  onPress={() => confirmUnlink(child)}
                  disabled={workingId != null}
                  style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.linkText}>
                    {workingId === child.id ? 'جاري فك الربط…' : 'فك ربط الأمومة'}
                  </Text>
                </Pressable>
              </View>
            ))
          ) : !loadingKids && !noSpouse ? (
            <Text style={styles.meta}>لا أبناء مربوطين بهذه الأم بعد.</Text>
          ) : null}
          {!noSpouse ? (
            <>
              <Text style={styles.fieldLabel}>ابحثي عن الابن في الشجرة</Text>
              <TextInput
                onChangeText={setChildQuery}
                placeholder="اسم الابن الموجود"
                placeholderTextColor="#8A7A6A"
                returnKeyType="search"
                style={styles.input}
                textAlign="right"
                value={childQuery}
                onSubmitEditing={() => {
                  void runChildSearch();
                }}
              />
              <ActionButton
                label={searchingChild ? 'جاري البحث…' : 'بحث'}
                onPress={() => void runChildSearch()}
              />
              {childMatches.map((child) => (
                <Pressable
                  key={child.id}
                  disabled={workingId != null}
                  onPress={() => confirmLink(child)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <Text style={styles.cardName}>{child.displayName}</Text>
                  {child.path && child.path !== child.displayName ? (
                    <Text style={styles.cardMeta}>{child.path}</Text>
                  ) : null}
                  <Text style={styles.cardMeta}>{child.branchKey || 'بدون فرع'}</Text>
                  <Text style={styles.linkText}>
                    {workingId === child.id ? 'جاري الربط…' : 'ربط بهذه الأم'}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>ابحثي عن الأم في الشجرة</Text>
          <TextInput
            onChangeText={setQuery}
            placeholder="اسم الأم"
            placeholderTextColor="#8A7A6A"
            returnKeyType="search"
            style={styles.input}
            textAlign="right"
            value={query}
            onSubmitEditing={() => {
              void runMotherSearch();
            }}
          />
          <ActionButton label={searching ? 'جاري البحث…' : 'بحث'} onPress={() => void runMotherSearch()} />
          {matches.map((row) => (
            <Pressable
              key={memberMatchKey(row)}
              onPress={() => {
                void chooseMother(row);
              }}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardName}>{row.displayName}</Text>
              {row.path && row.path !== row.displayName ? (
                <Text style={styles.cardMeta}>{row.path}</Text>
              ) : null}
              <Text style={styles.cardMeta}>{row.branchKey || 'بدون فرع'}</Text>
            </Pressable>
          ))}
        </>
      )}
      {errorText ? <Text style={styles.warn}>{errorText}</Text> : null}
    </SceneSection>
  );
}

function womenAdminStyles(p: ThemePalette) {
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
