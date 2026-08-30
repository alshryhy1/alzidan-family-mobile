import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { PhoneField } from '../components/PhoneField';
import { SceneSection, SceneShell } from '../components/scene';
import {
  approveFamilyAdminRequest,
  bindFamilyAdminRequest,
  familyAdminActionMessage,
  familyAdminDelegatesSqlHint,
  FamilyAdminRpcMissingError,
  fetchFamilyAdminDelegates,
  fetchFamilyAdminDevices,
  fetchFamilyAdminRequests,
  isFamilyAdminDelegateRequest,
  isFamilyAdminMemberRequest,
  rejectFamilyAdminRequest,
  searchFamilyAdminPeople,
  setFamilyAdminDelegateEnabled,
  setFamilyAdminDelegateRole,
  setFamilyAdminPhone,
  unbindFamilyAdminDevice,
  updateFamilyAdminPerson,
  type FamilyAdminDelegate,
  type FamilyAdminDelegateRole,
  type FamilyAdminDevice,
  type FamilyAdminPerson,
  type FamilyAdminRequest,
} from '../services/familyAdmin';
import { notifyRequesterStatusChanged } from '../services/eventOutboundNotify';
import { spacing, type ThemePalette } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import {
  DEFAULT_PHONE_COUNTRY_ID,
  formatPhoneDisplay,
  isValidPhone,
  parsePhoneToParts,
  toE164,
} from '../utils/phone';

type FamilyAdminScreenProps = {
  onBack: () => void;
  adminPhone: string;
};

type TabKey = 'people' | 'phones' | 'requests' | 'delegates' | 'devices';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'people', label: 'أشخاص' },
  { key: 'phones', label: 'جوالات' },
  { key: 'requests', label: 'طلبات' },
  { key: 'delegates', label: 'مناديب' },
  { key: 'devices', label: 'جهاز' },
];

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

function genderLabel(value: string | null) {
  const g = String(value || '').trim().toLowerCase();
  if (['daughter', 'female', 'f', 'أنثى', 'انثى', 'ابنة', 'بنت'].includes(g)) return 'أنثى';
  if (['son', 'male', 'm', 'ذكر', 'ابن', 'ولد'].includes(g)) return 'ذكر';
  return 'غير محدد';
}

function genderValue(value: string | null): 'son' | 'daughter' | '' {
  const g = String(value || '').trim().toLowerCase();
  if (['daughter', 'female', 'f', 'أنثى', 'انثى', 'ابنة', 'بنت'].includes(g)) return 'daughter';
  if (['son', 'male', 'm', 'ذكر', 'ابن', 'ولد'].includes(g)) return 'son';
  return '';
}

function requestKindLabel(row: FamilyAdminRequest) {
  const kind = String(row.kind || '').trim();
  const type = String(row.requestType || '').trim();
  if (kind === 'tree_delegate') return 'مندوب الشجرة';
  if (kind === 'events_delegate') return 'مندوب المناسبات';
  if (kind === 'delegate_secret_reset' || type === 'delegate_secret_reset') {
    return 'إعادة الرقم السري';
  }
  if (kind === 'member_phone_register') return 'طلب جوال';
  if (kind === 'member_registration') return 'طلب عضوية';
  return 'طلب يومي';
}

function notifySubmitter(row: FamilyAdminRequest, status: 'approved' | 'rejected') {
  void notifyRequesterStatusChanged({
    request_id: row.requestId || String(row.id),
    kind: row.kind,
    branch_key: row.branchKey,
    phone: row.phone,
    name: row.name,
    status,
  });
}

export function FamilyAdminScreen({ onBack, adminPhone }: FamilyAdminScreenProps) {
  const styles = useThemedStyles(familyAdminStyles);
  const phone = String(adminPhone || '').trim();
  const [tab, setTab] = useState<TabKey>('people');
  const [sqlMissing, setSqlMissing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const markSqlMissing = useCallback(() => setSqlMissing(true), []);

  return (
    <SceneShell
      title="إدارة العائلة"
      subtitle="قبول ورفض وصلاحيات المناديب من نفس المصدر"
      variant="archive"
    >
      <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text style={styles.backText}>العودة إلى ملفي</Text>
      </Pressable>
      <SceneSection>
        <Text style={styles.lead}>
          قبول ورفض طلبات الجوال والعضوية والمناديب، وتعديل صلاحيات المندوب كما في الموقع. الاستيراد والزوجات وبطاقة الشجرة تبقى في الموقع.
        </Text>
      </SceneSection>
      <View style={styles.tabs}>
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setErrorText('');
                setTab(item.key);
              }}
              style={[styles.chip, active && styles.activeChip]}
            >
              <Text style={[styles.chipText, active && styles.activeChipText]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!phone ? (
        <Text style={styles.warn}>لا توجد جلسة جوال لهذا المدخل.</Text>
      ) : sqlMissing ? (
        <Text style={styles.warn}>{familyAdminActionMessage(new FamilyAdminRpcMissingError())}</Text>
      ) : null}
      {errorText ? <Text style={styles.warn}>{errorText}</Text> : null}
      {phone && !sqlMissing && tab === 'people' ? (
        <PeopleTab
          phone={phone}
          styles={styles}
          onSqlMissing={markSqlMissing}
          onError={setErrorText}
        />
      ) : null}
      {phone && !sqlMissing && tab === 'phones' ? (
        <PhonesTab
          phone={phone}
          styles={styles}
          onSqlMissing={markSqlMissing}
          onError={setErrorText}
        />
      ) : null}
      {phone && !sqlMissing && tab === 'requests' ? (
        <RequestsTab
          phone={phone}
          styles={styles}
          onSqlMissing={markSqlMissing}
          onError={setErrorText}
        />
      ) : null}
      {phone && !sqlMissing && tab === 'delegates' ? (
        <DelegatesTab
          phone={phone}
          styles={styles}
          onSqlMissing={markSqlMissing}
          onError={setErrorText}
        />
      ) : null}
      {phone && !sqlMissing && tab === 'devices' ? (
        <DevicesTab
          phone={phone}
          styles={styles}
          onSqlMissing={markSqlMissing}
          onError={setErrorText}
        />
      ) : null}
    </SceneShell>
  );
}

type TabProps = {
  phone: string;
  styles: Record<string, any>;
  onSqlMissing: () => void;
  onError: (text: string) => void;
};

function PeopleTab({ phone, styles, onSqlMissing, onError }: TabProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<FamilyAdminPerson[]>([]);
  const [selected, setSelected] = useState<FamilyAdminPerson | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'son' | 'daughter' | ''>('');
  const [deceased, setDeceased] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  function fillForm(person: FamilyAdminPerson) {
    setSelected(person);
    setName(person.displayName || leafName(person.path || ''));
    setGender(genderValue(person.gender));
    setDeceased(person.isDeceased);
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      onError('اكتب حرفين على الأقل للبحث.');
      return;
    }
    setSearching(true);
    onError('');
    try {
      const rows = await searchFamilyAdminPeople(phone, q);
      setMatches(rows);
      if (selected) {
        const next = rows.find((row) => row.id === selected.id);
        if (next) fillForm(next);
      }
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setSearching(false);
    }
  }

  async function savePerson() {
    if (!selected || saving) return;
    const displayName = name.trim();
    if (displayName.length < 2) {
      onError('الاسم حرفان على الأقل.');
      return;
    }
    setSaving(true);
    onError('');
    try {
      await updateFamilyAdminPerson({
        adminPhone: phone,
        treeChildId: selected.id,
        displayName,
        gender: gender || null,
        isDeceased: deceased,
      });
      Alert.alert('تم الحفظ', 'حُفظ الاسم والجنس وحالة الوفاة.');
      await runSearch();
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SceneSection title="أشخاص">
      <Text style={styles.hint}>بحث بالاسم أو الفرع. تعديل الاسم والجنس والوفاة فقط. بلا حذف شجرة وبلا إدخال جماعي.</Text>
      <TextInput
        onChangeText={setQuery}
        placeholder="اسم الشخص"
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
          <Text style={styles.cardName}>{selected.displayName || name}</Text>
          {selected.path && selected.path !== selected.displayName ? (
            <Text style={styles.cardMeta}>{selected.path}</Text>
          ) : null}
          <Text style={styles.cardMeta}>{selected.branchKey || 'بدون فرع'}</Text>
          <Text style={styles.fieldLabel}>الاسم</Text>
          <TextInput
            onChangeText={setName}
            style={styles.input}
            textAlign="right"
            value={name}
          />
          <Text style={styles.fieldLabel}>الجنس</Text>
          <View style={styles.tabs}>
            {([
              { key: 'son' as const, label: 'ذكر' },
              { key: 'daughter' as const, label: 'أنثى' },
            ]).map((item) => {
              const active = gender === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setGender(item.key)}
                  style={[styles.chip, active && styles.activeChip]}
                >
                  <Text style={[styles.chipText, active && styles.activeChipText]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setDeceased((value) => !value)}
            style={[styles.chip, deceased && styles.activeChip, styles.toggle]}
          >
            <Text style={[styles.chipText, deceased && styles.activeChipText]}>
              {deceased ? 'متوفى' : 'على قيد الحياة'}
            </Text>
          </Pressable>
          <ActionButton label={saving ? 'جاري الحفظ…' : 'حفظ'} onPress={() => void savePerson()} />
          <Pressable onPress={() => setSelected(null)} style={styles.linkBtn}>
            <Text style={styles.linkText}>تغيير الشخص</Text>
          </Pressable>
        </View>
      ) : (
        matches.map((person) => (
          <Pressable
            key={person.id}
            onPress={() => fillForm(person)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.cardName}>{person.displayName}</Text>
            {person.path && person.path !== person.displayName ? (
              <Text style={styles.cardMeta}>{person.path}</Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {[person.branchKey, genderLabel(person.gender), person.isDeceased ? 'متوفى' : '']
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Pressable>
        ))
      )}
    </SceneSection>
  );
}

function PhonesTab({ phone, styles, onSqlMissing, onError }: TabProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<FamilyAdminPerson[]>([]);
  const [selected, setSelected] = useState<FamilyAdminPerson | null>(null);
  const [countryId, setCountryId] = useState(DEFAULT_PHONE_COUNTRY_ID);
  const [national, setNational] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  function fillForm(person: FamilyAdminPerson) {
    setSelected(person);
    const parsed = parsePhoneToParts(person.phone || '');
    setCountryId(parsed.countryId || DEFAULT_PHONE_COUNTRY_ID);
    setNational(parsed.national || '');
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      onError('اكتب حرفين على الأقل للبحث.');
      return;
    }
    setSearching(true);
    onError('');
    try {
      const rows = await searchFamilyAdminPeople(phone, q);
      setMatches(rows);
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setSearching(false);
    }
  }

  async function savePhone() {
    if (!selected || saving) return;
    if (!isValidPhone(countryId, national)) {
      onError('أدخل رقم جوال صحيحًا.');
      return;
    }
    setSaving(true);
    onError('');
    try {
      await setFamilyAdminPhone({
        adminPhone: phone,
        treeChildId: selected.id,
        memberPhone: toE164(countryId, national),
      });
      Alert.alert('تم الحفظ', 'رُبط الجوال بالشخص.');
      await runSearch();
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SceneSection title="جوالات">
      <Text style={styles.hint}>ربط أو تعديل جوال العضو على الصف الموجود. لا إنشاء شخص جديد.</Text>
      <TextInput
        onChangeText={setQuery}
        placeholder="اسم الشخص"
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
          <Text style={styles.cardMeta}>{selected.branchKey || 'بدون فرع'}</Text>
          {selected.phone ? (
            <Text style={styles.cardMeta}>{formatPhoneDisplay(selected.phone)}</Text>
          ) : (
            <Text style={styles.cardMeta}>بلا جوال مربوط</Text>
          )}
          <PhoneField
            countryId={countryId}
            national={national}
            onCountryChange={setCountryId}
            onNationalChange={setNational}
          />
          <ActionButton label={saving ? 'جاري الحفظ…' : 'حفظ الجوال'} onPress={() => void savePhone()} />
          <Pressable onPress={() => setSelected(null)} style={styles.linkBtn}>
            <Text style={styles.linkText}>تغيير الشخص</Text>
          </Pressable>
        </View>
      ) : (
        matches.map((person) => (
          <Pressable
            key={person.id}
            onPress={() => fillForm(person)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.cardName}>{person.displayName}</Text>
            <Text style={styles.cardMeta}>
              {person.branchKey || 'بدون فرع'}
              {person.phone ? ` · ${formatPhoneDisplay(person.phone)}` : ' · بلا جوال'}
            </Text>
          </Pressable>
        ))
      )}
    </SceneSection>
  );
}

function RequestsTab({ phone, styles, onSqlMissing, onError }: TabProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FamilyAdminRequest[]>([]);
  const [selected, setSelected] = useState<FamilyAdminRequest | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<FamilyAdminPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!phone) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    onError('');
    try {
      const next = await fetchFamilyAdminRequests(phone);
      setRows(next);
      setSelected((current) => {
        if (!current) return null;
        return next.find((row) => row.id === current.id) || null;
      });
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setLoading(false);
    }
  }, [onError, onSqlMissing, phone]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSearch() {
    if (!selected) return;
    const q = query.trim() || leafName(selected.name);
    if (q.length < 2) {
      setMatches([]);
      onError('اكتب حرفين على الأقل للبحث.');
      return;
    }
    setSearching(true);
    onError('');
    try {
      setMatches(await searchFamilyAdminPeople(phone, q));
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setSearching(false);
    }
  }

  function confirmReject(row: FamilyAdminRequest) {
    Alert.alert('رفض الطلب', 'يُرفض هذا الطلب المعلّق دون ربط.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'رفض',
        style: 'destructive',
        onPress: () => {
          void doReject(row);
        },
      },
    ]);
  }

  async function doReject(row: FamilyAdminRequest) {
    setBusyId(row.id);
    onError('');
    try {
      await rejectFamilyAdminRequest(phone, row.id);
      notifySubmitter(row, 'rejected');
      setSelected(null);
      await load();
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  function confirmBind(person: FamilyAdminPerson) {
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

  async function doBind(person: FamilyAdminPerson) {
    if (!selected) return;
    setBusyId(selected.id);
    onError('');
    try {
      await bindFamilyAdminRequest({
        adminPhone: phone,
        requestId: selected.id,
        treeChildId: person.id,
      });
      notifySubmitter(selected, 'approved');
      Alert.alert('تم الاعتماد', 'اعتُمد الطلب ورُبط بالشخص.');
      setSelected(null);
      setMatches([]);
      await load();
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  function confirmApprove(row: FamilyAdminRequest) {
    const kind = requestKindLabel(row);
    Alert.alert('اعتماد الطلب', `قبول ${kind} كما في الموقع؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'قبول',
        onPress: () => {
          void doApprove(row);
        },
      },
    ]);
  }

  async function doApprove(row: FamilyAdminRequest) {
    setBusyId(row.id);
    onError('');
    try {
      await approveFamilyAdminRequest(phone, row.id);
      notifySubmitter(row, 'approved');
      Alert.alert('تم القبول', 'اعتُمد الطلب وحُدّثت صلاحية المندوب إن لزم.');
      setSelected(null);
      setMatches([]);
      await load();
    } catch (error) {
      onError(
        error instanceof FamilyAdminRpcMissingError
          ? familyAdminDelegatesSqlHint()
          : familyAdminActionMessage(error),
      );
    } finally {
      setBusyId(null);
    }
  }

  const selectedIsMember = selected ? isFamilyAdminMemberRequest(selected) : false;
  const selectedIsDelegate = selected ? isFamilyAdminDelegateRequest(selected) : false;

  return (
    <SceneSection title="طلبات">
      <Text style={styles.hint}>
        طلبات الجوال والعضوية والمناديب المعلّقة. قبول العضوية يربط بالجوال. قبول المندوب يفعّل صلاحياته كما في الموقع.
      </Text>
      {loading ? <Text style={styles.meta}>جاري تحميل الطلبات…</Text> : null}
      {selected ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardName}>{selected.name || 'بدون اسم'}</Text>
            <Text style={styles.cardMeta}>{requestKindLabel(selected)}</Text>
            {selected.phone ? <Text style={styles.cardMeta}>{formatPhoneDisplay(selected.phone)}</Text> : null}
            <Text style={styles.cardMeta}>
              {[selected.branchKey, formatWhen(selected.createdAt)].filter(Boolean).join(' · ')}
            </Text>
            <Pressable onPress={() => setSelected(null)} style={styles.linkBtn}>
              <Text style={styles.linkText}>تغيير الطلب</Text>
            </Pressable>
          </View>
          {selectedIsMember ? (
            <>
              <Text style={styles.fieldLabel}>ابحث عن الشخص للربط</Text>
              <TextInput
                onChangeText={setQuery}
                placeholder="اسم الشخص"
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
              {matches.map((person) => (
                <Pressable
                  key={person.id}
                  disabled={busyId != null}
                  onPress={() => confirmBind(person)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <Text style={styles.cardName}>{person.displayName}</Text>
                  <Text style={styles.cardMeta}>
                    {person.branchKey || 'بدون فرع'}
                    {person.phone ? ` · ${formatPhoneDisplay(person.phone)}` : ''}
                  </Text>
                  <Text style={styles.linkText}>اختيار هذا الشخص</Text>
                </Pressable>
              ))}
            </>
          ) : selectedIsDelegate ? (
            <ActionButton
              label={busyId === selected.id ? 'جاري القبول…' : 'قبول الطلب'}
              onPress={() => confirmApprove(selected)}
            />
          ) : (
            <Text style={styles.meta}>هذا النوع يُعالَج من الموقع.</Text>
          )}
          <ActionButton
            label={busyId === selected.id ? 'جاري الرفض…' : 'رفض الطلب'}
            variant="secondary"
            onPress={() => confirmReject(selected)}
          />
        </>
      ) : rows.length ? (
        rows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => {
              setSelected(row);
              setQuery(leafName(row.name));
              setMatches([]);
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.cardName}>{row.name || 'بدون اسم'}</Text>
            <Text style={styles.cardMeta}>{requestKindLabel(row)}</Text>
            {row.phone ? <Text style={styles.cardMeta}>{formatPhoneDisplay(row.phone)}</Text> : null}
            <Text style={styles.cardMeta}>
              {[row.branchKey, formatWhen(row.createdAt)].filter(Boolean).join(' · ')}
            </Text>
          </Pressable>
        ))
      ) : loading ? null : (
        <Text style={styles.meta}>لا توجد طلبات يومية معلّقة.</Text>
      )}
    </SceneSection>
  );
}

function DelegatesTab({ phone, styles, onSqlMissing, onError }: TabProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FamilyAdminDelegate[]>([]);
  const [roles, setRoles] = useState<FamilyAdminDelegateRole[]>([]);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!phone) {
      setRows([]);
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    onError('');
    try {
      const next = await fetchFamilyAdminDelegates(phone);
      setRows(next.rows);
      setRoles(next.roles);
    } catch (error) {
      onError(
        error instanceof FamilyAdminRpcMissingError
          ? familyAdminDelegatesSqlHint()
          : familyAdminActionMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }, [onError, phone]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmRole(row: FamilyAdminDelegate, role: FamilyAdminDelegateRole) {
    if (role.roleKey === row.roleKey) return;
    Alert.alert('تغيير الصلاحية', `جعل ${row.name || 'المندوب'} «${role.titleAr}»؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تغيير',
        onPress: () => {
          void doRole(row.id, role.roleKey);
        },
      },
    ]);
  }

  async function doRole(id: string, roleKey: string) {
    setBusyId(id);
    onError('');
    try {
      await setFamilyAdminDelegateRole({ adminPhone: phone, delegateId: id, roleKey });
      await load();
    } catch (error) {
      onError(
        error instanceof FamilyAdminRpcMissingError
          ? familyAdminDelegatesSqlHint()
          : familyAdminActionMessage(error),
      );
    } finally {
      setBusyId('');
    }
  }

  function confirmEnabled(row: FamilyAdminDelegate) {
    const next = !row.isEnabled;
    Alert.alert(next ? 'تفعيل المندوب' : 'تعطيل المندوب', `تأكيد ${next ? 'تفعيل' : 'تعطيل'} ${row.name || 'المندوب'}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: next ? 'تفعيل' : 'تعطيل',
        style: next ? 'default' : 'destructive',
        onPress: () => {
          void doEnabled(row.id, next);
        },
      },
    ]);
  }

  async function doEnabled(id: string, enabled: boolean) {
    setBusyId(id);
    onError('');
    try {
      await setFamilyAdminDelegateEnabled({ adminPhone: phone, delegateId: id, enabled });
      await load();
    } catch (error) {
      onError(
        error instanceof FamilyAdminRpcMissingError
          ? familyAdminDelegatesSqlHint()
          : familyAdminActionMessage(error),
      );
    } finally {
      setBusyId('');
    }
  }

  return (
    <SceneSection title="مناديب">
      <Text style={styles.hint}>نفس أدوار الموقع: عرض / فرع / مناسبات / كامل. التفعيل والتعطيل يطابقان لوحة المناديب.</Text>
      {loading ? <Text style={styles.meta}>جاري تحميل المناديب…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.meta}>لا يوجد مندوبون بعد.</Text> : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.cardName}>{row.name || 'مندوب'}</Text>
          <Text style={styles.cardMeta}>
            {[row.branchKey || 'بدون فرع', row.isEnabled ? 'مفعّل' : 'معطّل'].join(' · ')}
          </Text>
          {row.phone ? <Text style={styles.cardMeta}>{formatPhoneDisplay(row.phone)}</Text> : null}
          <Text style={styles.cardMeta}>{row.roleTitleAr || row.roleKey}</Text>
          <View style={styles.tabs}>
            {roles.map((role) => {
              const active = role.roleKey === row.roleKey;
              return (
                <Pressable
                  key={role.roleKey}
                  disabled={busyId === row.id}
                  onPress={() => confirmRole(row, role)}
                  style={[styles.chip, active && styles.activeChip]}
                >
                  <Text style={[styles.chipText, active && styles.activeChipText]}>{role.titleAr}</Text>
                </Pressable>
              );
            })}
          </View>
          <ActionButton
            label={
              busyId === row.id ? 'جاري التحديث…' : row.isEnabled ? 'تعطيل' : 'تفعيل'
            }
            variant={row.isEnabled ? 'secondary' : 'primary'}
            onPress={() => confirmEnabled(row)}
          />
        </View>
      ))}
    </SceneSection>
  );
}

function DevicesTab({ phone, styles, onSqlMissing, onError }: TabProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FamilyAdminDevice[]>([]);
  const [busyKey, setBusyKey] = useState('');

  const load = useCallback(async () => {
    if (!phone) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    onError('');
    try {
      setItems(await fetchFamilyAdminDevices(phone));
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setLoading(false);
    }
  }, [onError, onSqlMissing, phone]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmUnbind(item: FamilyAdminDevice) {
    Alert.alert(
      'حذف ربط الجهاز',
      `حذف ربط ${item.phoneKey}؟ بعدها يدخل صاحب الرقم من جهازه من جديد.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الربط',
          style: 'destructive',
          onPress: () => {
            void doUnbind(item.phoneKey);
          },
        },
      ],
    );
  }

  async function doUnbind(phoneKey: string) {
    setBusyKey(phoneKey);
    onError('');
    try {
      await unbindFamilyAdminDevice(phone, phoneKey);
      await load();
    } catch (error) {
      if (error instanceof FamilyAdminRpcMissingError) onSqlMissing();
      else onError(familyAdminActionMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  return (
    <SceneSection title="جهاز">
      <Text style={styles.hint}>عرض الربط وحذفه من جلسة إدارة العائلة، دون رمز الويب.</Text>
      {loading ? <Text style={styles.meta}>جاري التحميل…</Text> : null}
      {!loading && items.length === 0 ? <Text style={styles.meta}>لا توجد أجهزة مربوطة.</Text> : null}
      {items.map((item) => (
        <View key={`${item.id}-${item.phoneKey}`} style={styles.card}>
          <Text style={styles.cardName}>{item.phoneKey}</Text>
          {item.label ? <Text style={styles.cardMeta}>{item.label}</Text> : null}
          <Text style={styles.cardMeta}>{formatWhen(item.lastSeenAt || item.boundAt)}</Text>
          <Pressable
            disabled={busyKey === item.phoneKey}
            onPress={() => confirmUnbind(item)}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>
              {busyKey === item.phoneKey ? 'جاري الحذف…' : 'حذف الربط'}
            </Text>
          </Pressable>
        </View>
      ))}
    </SceneSection>
  );
}

function familyAdminStyles(p: ThemePalette) {
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
    tabs: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    chip: {
      backgroundColor: p.surface,
      borderColor: p.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    activeChip: {
      backgroundColor: p.primary,
      borderColor: p.primary,
    },
    chipText: {
      color: p.textMuted,
      fontSize: 13,
      fontWeight: '800' as const,
      writingDirection: 'rtl' as const,
    },
    activeChipText: {
      color: p.white,
    },
    toggle: {
      alignSelf: 'flex-end' as const,
      marginBottom: spacing.md,
      marginTop: spacing.sm,
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
