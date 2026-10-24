import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from './ActionButton';
import {
  memberAddPersonMessage,
  setOwnTreePersonProfile,
  updateOwnTreePerson,
} from '../services/memberAddPerson';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { TreeChild } from '../types';
import { leafPersonName } from '../utils/personEncounter';
import { isPublicLineageHiddenPerson } from '../utils/personVisibility';
import { normalizeEducationDegree, normalizeWorkStatus, normalizeWorkplace } from '../utils/treeStats';

type Props = {
  phone: string;
  target: TreeChild;
  tone?: 'cream' | 'hero';
  keepBlankDates?: boolean;
  onSaved?: () => void;
};

const WORK_OPTIONS = [
  { key: '', label: 'غير محدد' },
  { key: 'employed', label: 'موظف' },
  { key: 'retired', label: 'متقاعد' },
  { key: 'unemployed', label: 'عاطل' },
] as const;

const EDUCATION_OPTIONS = [
  { key: '', label: 'غير محدد' },
  { key: 'intermediate', label: 'متوسط' },
  { key: 'secondary', label: 'ثانوي' },
  { key: 'diploma', label: 'دبلوم' },
  { key: 'bachelor', label: 'بكالوريوس' },
  { key: 'master', label: 'ماجستير' },
  { key: 'doctorate', label: 'دكتوراه' },
] as const;

function isoDate(value?: string | null) {
  const text = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export function OwnTreeEditPanel({
  phone,
  target,
  tone = 'cream',
  keepBlankDates = false,
  onSaved,
}: Props) {
  const p = useThemePalette();
  const styles = useThemedStyles((palette) => panelStyles(palette, tone));
  const [given, setGiven] = useState(() => leafPersonName(target.name));
  const [hijri, setHijri] = useState(() => isoDate(target.birthDateHijri));
  const [greg, setGreg] = useState(() => isoDate(target.birthDateGregorian));
  const [city, setCity] = useState(() => String(target.city || '').trim());
  const [area, setArea] = useState(() => String(target.area || '').trim());
  const [workStatus, setWorkStatus] = useState(() => normalizeWorkStatus(target.workStatus));
  const [workplace, setWorkplace] = useState(() => normalizeWorkplace(target.workplace));
  const [educationDegree, setEducationDegree] = useState(
    () => normalizeEducationDegree(target.educationDegree),
  );
  const [marriedOutside, setMarriedOutside] = useState(() => target.marriedOutside === true);
  const showMarriedOutside = isPublicLineageHiddenPerson(target) || target.marriedOutside === true;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });

  useEffect(() => {
    setGiven(leafPersonName(target.name));
    setHijri(isoDate(target.birthDateHijri));
    setGreg(isoDate(target.birthDateGregorian));
    setCity(String(target.city || '').trim());
    setArea(String(target.area || '').trim());
    setWorkStatus(normalizeWorkStatus(target.workStatus));
    setWorkplace(normalizeWorkplace(target.workplace));
    setEducationDegree(normalizeEducationDegree(target.educationDegree));
    setMarriedOutside(target.marriedOutside === true);
    setStatus({ kind: 'idle', text: '' });
  }, [
    target.id,
    target.name,
    target.birthDateHijri,
    target.birthDateGregorian,
    target.city,
    target.area,
    target.workStatus,
    target.workplace,
    target.educationDegree,
    target.marriedOutside,
  ]);

  async function submit() {
    const name = given.trim();
    if (!name || name.split(/\s+/).length !== 1 || ['بن', 'ابن', 'بنت'].includes(name)) {
      setStatus({ kind: 'error', text: 'اكتب الاسم بكلمة واحدة.' });
      return;
    }
    if (hijri.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(hijri.trim())) {
      setStatus({ kind: 'error', text: 'تاريخ الميلاد (هجري) غير صحيح. الصيغة: YYYY-MM-DD' });
      return;
    }
    if (greg.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(greg.trim())) {
      setStatus({ kind: 'error', text: 'تاريخ الميلاد (ميلادي) غير صحيح. الصيغة: YYYY-MM-DD' });
      return;
    }
    setBusy(true);
    setStatus({ kind: 'idle', text: '' });
    try {
      const result = await updateOwnTreePerson({
        phone,
        targetId: target.id,
        given: name,
        birthDate: keepBlankDates && !greg.trim() ? undefined : greg.trim(),
        birthDateHijri: keepBlankDates && !hijri.trim() ? undefined : hijri.trim(),
      });
      if (!result?.ok) {
        const code = String(result?.error || '');
        setStatus({
          kind: 'error',
          text:
            code === 'rpc_missing' || code === 'sql_missing'
              ? 'أمر تعديل الاسم ناقص في قاعدة البيانات (member_update_person_v1).'
              : memberAddPersonMessage(code),
        });
        return;
      }

      const profile = await setOwnTreePersonProfile({
        phone,
        targetId: target.id,
        city: city.trim(),
        area: area.trim(),
        workStatus,
        workplace: workplace.trim(),
        educationDegree,
        marriedOutside: showMarriedOutside ? marriedOutside : null,
      });
      if (!profile?.ok) {
        const code = String(profile?.error || '');
        const detail = String((profile as { detail?: string })?.detail || '').trim();
        setStatus({
          kind: 'error',
          text:
            code === 'rpc_missing' || code === 'sql_missing'
              ? 'الصق docs/COPY-ME-married-outside-v1.sql (أو ملف الملف الشخصي) في Supabase SQL ثم انتظر ثوانٍ.'
              : detail
                ? `${memberAddPersonMessage(code)} (${detail})`
                : memberAddPersonMessage(code),
        });
        return;
      }

      setStatus({ kind: 'success', text: `حُفظ تعديل ${name} في الشجرة.` });
      onSaved?.();
    } catch {
      setStatus({ kind: 'error', text: memberAddPersonMessage('update_failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        الاسم والميلاد والموقع والحالة الوظيفية والشهادة — تُحفظ في نفس جداول الشجرة.
      </Text>
      <TextInput
        onChangeText={setGiven}
        placeholder="الاسم (كلمة واحدة)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={given}
      />
      <TextInput
        onChangeText={setHijri}
        placeholder="تاريخ الميلاد هجري (YYYY-MM-DD)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={hijri}
      />
      <TextInput
        onChangeText={setGreg}
        placeholder="تاريخ الميلاد ميلادي (YYYY-MM-DD)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={greg}
      />
      <TextInput
        onChangeText={setCity}
        placeholder="المدينة (اختياري)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={city}
      />
      <TextInput
        onChangeText={setArea}
        placeholder="الحي/القرية (اختياري)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={area}
      />
      <Text style={styles.fieldLabel}>الحالة الوظيفية</Text>
      <View style={styles.chips}>
        {WORK_OPTIONS.map((item) => {
          const active = workStatus === item.key;
          return (
            <Pressable
              key={item.key || 'work-unset'}
              onPress={() => setWorkStatus(item.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {workStatus === 'employed' ? (
        <TextInput
          onChangeText={setWorkplace}
          placeholder="وين موظف (جهة العمل)"
          placeholderTextColor={p.textMuted}
          style={styles.input}
          textAlign="right"
          value={workplace}
        />
      ) : null}
      <Text style={styles.fieldLabel}>الدرجة العلمية</Text>
      <View style={styles.chips}>
        {EDUCATION_OPTIONS.map((item) => {
          const active = educationDegree === item.key;
          return (
            <Pressable
              key={item.key || 'edu-unset'}
              onPress={() => setEducationDegree(item.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {showMarriedOutside ? (
        <>
          <View style={styles.switchRow}>
            <Switch
              onValueChange={setMarriedOutside}
              trackColor={{ false: '#D4C4A8', true: '#C4A35A' }}
              value={marriedOutside}
            />
            <Text style={styles.switchLabel}>متزوجة من خارج العائلة</Text>
          </View>
          <Text style={styles.hint}>
            عند التفعيل: لا تظهر أرملة ولا مطلقة، ولا يُعرض اسم الزوج في بطاقتك.
          </Text>
        </>
      ) : null}
      <ActionButton
        label={busy ? 'جاري الحفظ...' : 'حفظ التعديل'}
        onPress={() => {
          if (!busy) void submit();
        }}
      />
      {status.text ? (
        <Text style={status.kind === 'error' ? styles.error : styles.ok}>{status.text}</Text>
      ) : null}
    </View>
  );
}

function panelStyles(p: ThemePalette, tone: 'cream' | 'hero') {
  const onHero = tone === 'hero';
  return {
    wrap: {
      gap: spacing.sm,
    },
    hint: {
      color: onHero ? p.goldSoft : p.textMuted,
      fontSize: typography.caption,
      lineHeight: 20,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    fieldLabel: {
      color: onHero ? p.goldSoft : p.textMuted,
      fontSize: typography.caption,
      fontWeight: '700' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    switchRow: {
      alignItems: 'center' as const,
      flexDirection: 'row-reverse' as const,
      gap: 10,
      marginTop: 4,
    },
    switchLabel: {
      color: onHero ? p.cream : p.text,
      flex: 1,
      fontSize: typography.body,
      fontWeight: '700' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    input: {
      backgroundColor: onHero ? p.cream : p.surface,
      borderColor: onHero ? p.gold : p.border,
      borderRadius: 14,
      borderWidth: 1,
      color: onHero ? p.greenDeep : p.text,
      fontSize: typography.body,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      writingDirection: 'rtl' as const,
    },
    chips: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    chip: {
      backgroundColor: onHero ? 'rgba(255,255,255,0.08)' : p.surface,
      borderColor: onHero ? p.gold : p.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: {
      backgroundColor: onHero ? p.gold : p.primaryDark,
      borderColor: onHero ? p.gold : p.primaryDark,
    },
    chipText: {
      color: onHero ? p.goldSoft : p.text,
      fontSize: typography.caption,
      fontWeight: '700' as const,
    },
    chipTextActive: {
      color: onHero ? p.greenDeep : p.cream,
    },
    error: {
      color: p.condolence,
      fontSize: typography.caption,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    ok: {
      color: onHero ? p.goldSoft : p.primaryDark,
      fontSize: typography.caption,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
  };
}
