import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { memberAddPersonMessage, updateOwnTreePerson } from '../services/memberAddPerson';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { TreeChild } from '../types';
import { leafPersonName } from '../utils/personEncounter';

type Props = {
  phone: string;
  target: TreeChild;
  tone?: 'cream' | 'hero';
  keepBlankDates?: boolean;
  onSaved?: () => void;
};

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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });

  useEffect(() => {
    setGiven(leafPersonName(target.name));
    setHijri(isoDate(target.birthDateHijri));
    setGreg(isoDate(target.birthDateGregorian));
    setStatus({ kind: 'idle', text: '' });
  }, [target.id, target.name, target.birthDateHijri, target.birthDateGregorian]);

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
              ? 'نفّذ أمر «تعديل الاسم أو تاريخ الميلاد» في الإدارة مرة واحدة ثم أعد المحاولة.'
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
      <Text style={styles.hint}>الاسم كلمة واحدة، وتاريخ الميلاد هجري أو ميلادي. يُحفظ في الشجرة نفسها.</Text>
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
