import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { insertPublicRow } from '../services/supabase';
import { colors, spacing, typography } from '../theme';
import type { Branch } from '../types';

type ProfileScreenProps = {
  branches: Branch[];
};

type SubmitStatus = {
  kind: 'idle' | 'success' | 'error';
  text: string;
};

function requestId() {
  return `MEMAPP-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function normalizeArabicDigits(value: string) {
  const arabicZero = '٠'.charCodeAt(0);
  const persianZero = '۰'.charCodeAt(0);
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const normalized = code >= persianZero ? code - persianZero : code - arabicZero;
    return String(normalized);
  });
}

function cleanPhone(value: string) {
  return normalizeArabicDigits(value).replace(/[^\d+]/g, '');
}

function buildMemberMessage(payload: {
  branch: string;
  delegateCode: string;
  fullName: string;
  phone: string;
  relation: string;
  relationPerson: string;
  requestId: string;
}) {
  return [
    'طلب تسجيل عضو في تطبيق عائلة الزيدان',
    `رقم الطلب: ${payload.requestId}`,
    `الفرع: ${payload.branch}`,
    `الاسم الكامل: ${payload.fullName}`,
    `الجوال: ${payload.phone}`,
    payload.relation ? `صلة القرابة: ${payload.relation}` : '',
    payload.relationPerson ? `مرتبط في الشجرة بـ: ${payload.relationPerson}` : '',
    `رمز المندوب: ${payload.delegateCode}`,
    `التاريخ: ${new Date().toLocaleString('ar-SA')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ProfileScreen({ branches }: ProfileScreenProps) {
  const defaultBranch = branches[0]?.id ?? 'زيدان';
  const [branch, setBranch] = useState(defaultBranch);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [relationPerson, setRelationPerson] = useState('');
  const [delegateCode, setDelegateCode] = useState('');
  const [profileRequest, setProfileRequest] = useState<{
    branch: string;
    fullName: string;
    phone: string;
    requestId: string;
    status: 'pending';
  } | null>(null);
  const [status, setStatus] = useState<SubmitStatus>({ kind: 'idle', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const selectedBranchName = useMemo(
    () => branches.find((item) => item.id === branch)?.name ?? branch,
    [branch, branches],
  );

  const submitRegistration = async () => {
    const cleanedPhone = cleanPhone(phone);
    const cleanDelegateCode = delegateCode.trim();
    const cleanFullName = fullName.trim();

    if (!cleanFullName || cleanedPhone.length < 9 || !branch || !cleanDelegateCode) {
      setStatus({
        kind: 'error',
        text: 'اكتب الاسم الكامل، رقم الجوال، الفرع، ورمز المندوب.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const newRequestId = requestId();
      const message = buildMemberMessage({
        branch,
        delegateCode: cleanDelegateCode,
        fullName: cleanFullName,
        phone: cleanedPhone,
        relation: relation.trim(),
        relationPerson: relationPerson.trim(),
        requestId: newRequestId,
      });

      await insertPublicRow('approval_requests', {
        request_id: newRequestId,
        kind: 'member_registration',
        branch_key: branch,
        name: cleanFullName,
        phone: cleanedPhone,
        email: null,
        message,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      setProfileRequest({
        branch,
        fullName: cleanFullName,
        phone: cleanedPhone,
        requestId: newRequestId,
        status: 'pending',
      });
      setStatus({
        kind: 'success',
        text: 'تم إرسال طلب التسجيل. سيظهر ملفك بعد اعتماد المندوب أو الإدارة.',
      });
      setDelegateCode('');
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر إرسال طلب التسجيل.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="ملفي العائلي"
      description="سجل برمز المندوب حتى ترتبط عضويتك بفرعك وتصبح طلباتك أوضح للإدارة."
    >
      {profileRequest ? (
        <SectionCard eyebrow="الحالة" title="طلب التسجيل">
          <View style={styles.profileHeader}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>قيد المراجعة</Text>
            </View>
            <Text style={styles.profileName}>{profileRequest.fullName}</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>{profileRequest.requestId}</Text>
              <Text style={styles.infoLabel}>رقم الطلب</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>{selectedBranchName}</Text>
              <Text style={styles.infoLabel}>الفرع</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>{profileRequest.phone}</Text>
              <Text style={styles.infoLabel}>الجوال</Text>
            </View>
          </View>
          <Text style={styles.note}>
            بعد القبول يمكن ربط خدمات “طلباتي” و“تعديل ملفي” على نفس رقم الجوال.
          </Text>
        </SectionCard>
      ) : null}

      <SectionCard eyebrow="تسجيل" title="طلب عضوية عائلية">
        <View style={styles.branchPicker}>
          {branches.map((item) => {
            const active = item.id === branch;
            return (
              <Pressable
                key={item.id}
                onPress={() => setBranch(item.id)}
                style={[styles.chip, active && styles.activeChip]}
              >
                <Text style={[styles.chipText, active && styles.activeChipText]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          onChangeText={setFullName}
          placeholder="الاسم الكامل"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={fullName}
        />
        <TextInput
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="رقم الجوال"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={phone}
        />
        <TextInput
          onChangeText={setRelation}
          placeholder="صلة القرابة، مثال: ابن / حفيد / قريب"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={relation}
        />
        <TextInput
          onChangeText={setRelationPerson}
          placeholder="اسم الشخص المرتبط بك في الشجرة، اختياري"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={relationPerson}
        />
        <TextInput
          autoCapitalize="characters"
          onChangeText={setDelegateCode}
          placeholder="رمز المندوب"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          textAlign="right"
          value={delegateCode}
        />
        <ActionButton
          label={submitting ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
          onPress={submitRegistration}
        />
        <Text style={styles.note}>
          رمز المندوب لا يفتح التطبيق مباشرة، لكنه يثبت أن الطلب مر عبر مندوب الفرع قبل الاعتماد.
        </Text>
      </SectionCard>

      {status.text ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  branchPicker: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  activeChipText: {
    color: colors.white,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  profileName: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusPill: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusPillText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  infoGrid: {
    gap: spacing.xs,
  },
  infoRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  status: {
    borderRadius: 16,
    padding: spacing.md,
  },
  successStatus: {
    backgroundColor: colors.primarySoft,
  },
  errorStatus: {
    backgroundColor: '#F7D7D7',
  },
  statusText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
