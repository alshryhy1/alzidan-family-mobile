import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { ActionButton } from './ActionButton';
import {
  addOwnTreePerson,
  announceOwnTreeBirth,
  memberAddPersonMessage,
  parentDisplayName,
} from '../services/memberAddPerson';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { TreeChild } from '../types';

type Props = {
  phone: string;
  parent: TreeChild;
  owner: TreeChild;
  submitterName?: string | null;
  tone?: 'cream' | 'hero';
  onAdded?: () => void;
};

export function OwnTreeAddPanel({
  phone,
  parent,
  owner,
  submitterName,
  tone = 'cream',
  onAdded,
}: Props) {
  const p = useThemePalette();
  const styles = useThemedStyles((palette) => panelStyles(palette, tone));
  const [kind, setKind] = useState<'person' | 'birth'>('person');
  const [gender, setGender] = useState<'son' | 'daughter'>('son');
  const [given, setGiven] = useState('');
  const [hijri, setHijri] = useState('');
  const [greg, setGreg] = useState('');
  const [order, setOrder] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });

  const parentName = parentDisplayName(parent);
  const underSelf = Number(parent.id) === Number(owner.id);

  async function submit() {
    const name = given.trim();
    if (!name || name.split(/\s+/).length !== 1 || ['بن', 'ابن', 'بنت'].includes(name)) {
      setStatus({ kind: 'error', text: 'اكتب اسم الابن بكلمة واحدة.' });
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
    if (order.trim() && !/^[1-9]\d*$/.test(order.trim())) {
      setStatus({ kind: 'error', text: 'ترتيب الميلاد يجب أن يكون رقمًا صحيحًا يبدأ من 1.' });
      return;
    }
    setBusy(true);
    setStatus({ kind: 'idle', text: '' });
    try {
      const result = await addOwnTreePerson({
        phone,
        parentId: parent.id,
        given: name,
        gender,
        birthDate: greg.trim(),
        birthDateHijri: hijri.trim(),
        birthOrder: order.trim(),
      });
      if (!result?.ok) {
        setStatus({
          kind: 'error',
          text: memberAddPersonMessage(String(result?.error || '')),
        });
        return;
      }
      if (kind === 'birth') {
        await announceOwnTreeBirth({
          phone,
          branchKey: parent.branchKey || owner.branchKey,
          childName: name,
          parentName,
          submitterName: submitterName || parentName,
          birthDate: greg.trim() || hijri.trim(),
        }).catch(() => undefined);
      }
      setGiven('');
      setHijri('');
      setGreg('');
      setOrder('');
      setStatus({
        kind: 'success',
        text:
          kind === 'birth'
            ? `أُضيف ${name} تحت ${parentName}، ونُشر خبر المولود.`
            : `أُضيف ${name} تحت ${parentName}.`,
      });
      onAdded?.();
    } catch {
      setStatus({ kind: 'error', text: memberAddPersonMessage('rpc_failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        {underSelf
          ? 'اسم واحد تحتك في الشجرة. نفس حفظ الإدارة: ابن أو ابنة، تاريخ، وترتيب.'
          : `اسم واحد تحت ${parentName}. من شجرتك فقط.`}
      </Text>
      <View style={styles.chips}>
        {(
          [
            { key: 'person', label: 'شخص' },
            { key: 'birth', label: 'مولود جديد' },
          ] as const
        ).map((item) => {
          const active = kind === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setKind(item.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.chips}>
        {(
          [
            { key: 'son', label: 'ابن' },
            { key: 'daughter', label: 'ابنة' },
          ] as const
        ).map((item) => {
          const active = gender === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setGender(item.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        onChangeText={setGiven}
        placeholder="اسم الابن (كلمة واحدة)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={given}
      />
      <TextInput
        onChangeText={setHijri}
        placeholder="تاريخ الميلاد هجري اختياري (YYYY-MM-DD)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={hijri}
      />
      <TextInput
        onChangeText={setGreg}
        placeholder="تاريخ الميلاد ميلادي اختياري (YYYY-MM-DD)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={greg}
      />
      <TextInput
        keyboardType="number-pad"
        onChangeText={setOrder}
        placeholder="ترتيب الميلاد اختياري (1، 2، 3)"
        placeholderTextColor={p.textMuted}
        style={styles.input}
        textAlign="right"
        value={order}
      />
      <ActionButton
        label={busy ? 'جاري الإضافة...' : kind === 'birth' ? 'إضافة المولود في شجرتك' : 'إضافة في شجرتك'}
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
    chips: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.xs,
    },
    chip: {
      backgroundColor: onHero ? 'rgba(255,248,236,0.12)' : p.surface,
      borderColor: onHero ? p.gold : p.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipActive: {
      backgroundColor: onHero ? p.gold : p.primarySoft,
      borderColor: onHero ? p.gold : p.primary,
    },
    chipText: {
      color: onHero ? p.cream : p.text,
      fontSize: typography.caption,
      fontWeight: '800' as const,
    },
    chipTextActive: {
      color: onHero ? p.greenDeep : p.primaryDark,
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
