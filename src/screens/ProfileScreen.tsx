import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { getPushDebugTrace, registerPushToken, type PushDebugTrace } from '../services/pushNotifications';
import { selectPublicRows } from '../services/supabase';
import { colors, spacing, typography } from '../theme';
import type { Branch, TreeChild } from '../types';

type ProfileScreenProps = {
  branches: Branch[];
  childrenRows: TreeChild[];
  onOpenMemberCard: (branchKey: string, treeChildId: number) => void;
};

const MEMBER_PHONE_KEY = 'alzidan_member_phone_v1';

type MemberProfileRow = {
  id: number;
  phone: string | null;
  branch_key: string;
  tree_child_id: number;
  person_id: string | null;
  display_name: string | null;
  status: string | null;
};

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
  return normalizeArabicDigits(value).replace(/[^\d]/g, '');
}

function displayPersonName(value: string) {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || value;
}

function tripleNameFromPath(value: string) {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(-3)
    .reverse();

  const uniqueOrdered = parts.filter((part, index) => {
    if (index === 0) return true;
    return part !== parts[index - 1];
  });

  return uniqueOrdered.length ? uniqueOrdered.join(' بن ') : displayPersonName(value);
}

function formatPushDebugStep(step: string) {
  const labels: Record<string, string> = {
    register_start: 'بدء التسجيل',
    not_physical_device: 'يتطلب جهازاً حقيقياً',
    permission_denied: 'تم رفض إذن الإشعارات',
    permission_granted: 'تم منح إذن الإشعارات',
    project_id: 'جلب معرف المشروع',
    supabase_not_configured: 'إعداد Supabase غير مكتمل',
    token_received: 'تم الحصول على التوكن',
    token_empty: 'التوكن فارغ',
    token_unchanged: 'التوكن مسجل مسبقاً',
    token_fetch_failed: 'فشل الحصول على التوكن',
    rpc_success: 'نجح تسجيل التوكن (RPC)',
    rpc_failed: 'فشل RPC — جاري المحاولة بالبديل',
    fallback_upsert_success: 'نجح التسجيل (upsert)',
    fallback_upsert_failed: 'فشل التسجيل بالكامل',
  };
  return labels[step] || step;
}

function formatPushDebugTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ar-SA');
}

export function ProfileScreen({ branches, childrenRows, onOpenMemberCard }: ProfileScreenProps) {
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [member, setMember] = useState<MemberProfileRow | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const [loading, setLoading] = useState(false);
  const [pushDebug, setPushDebug] = useState<PushDebugTrace | null>(null);
  const [pushRetrying, setPushRetrying] = useState(false);

  const memberTreeRow = useMemo(
    () => childrenRows.find((row) => row.id === member?.tree_child_id) ?? null,
    [childrenRows, member?.tree_child_id],
  );

  const branchName = useMemo(
    () => branches.find((branch) => branch.id === member?.branch_key)?.name ?? member?.branch_key ?? '',
    [branches, member?.branch_key],
  );

  const memberName = useMemo(() => {
    if (memberTreeRow?.name) return tripleNameFromPath(memberTreeRow.name);
    return member?.display_name || 'عضو العائلة';
  }, [member?.display_name, memberTreeRow?.name]);

  const loadMember = async (targetPhone: string) => {
    const cleaned = cleanPhone(targetPhone);
    if (cleaned.length < 9) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح.' });
      return;
    }

    setLoading(true);
    setStatus({ kind: 'idle', text: '' });

    try {
      const rows = await selectPublicRows<MemberProfileRow>(
        `member_profiles?select=id,phone,branch_key,tree_child_id,person_id,display_name,status&phone=eq.${encodeURIComponent(cleaned)}&status=eq.active&limit=1`,
      );

      const found = rows[0] ?? null;
      if (!found) {
        setMember(null);
        setSavedPhone('');
        setStatus({
          kind: 'error',
          text: 'هذا الرقم غير مسجل لدى إدارة العائلة أو مندوب الفرع.',
        });
        return;
      }

      setMember(found);
      setSavedPhone(cleaned);
      setPhone(cleaned);
      await AsyncStorage.setItem(MEMBER_PHONE_KEY, cleaned);
      setStatus({ kind: 'success', text: 'تم تسجيل الدخول.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر تسجيل الدخول.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(MEMBER_PHONE_KEY)
      .then((value) => {
        const cleaned = cleanPhone(value || '');
        if (cleaned) loadMember(cleaned).catch(() => {});
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPushDebug = async () => {
    const trace = await getPushDebugTrace();
    setPushDebug(trace);
  };

  useEffect(() => {
    refreshPushDebug().catch(() => {});
  }, []);

  const retryPushRegistration = async () => {
    setPushRetrying(true);
    try {
      const result = await registerPushToken();
      await refreshPushDebug();
      if (!result?.ok) {
        setStatus({
          kind: 'error',
          text: `تعذر تسجيل الإشعارات: ${result?.reason || 'unknown'}`,
        });
      }
    } catch (error) {
      await refreshPushDebug();
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر تسجيل الإشعارات.',
      });
    } finally {
      setPushRetrying(false);
    }
  };

  const logout = () => {
    AsyncStorage.removeItem(MEMBER_PHONE_KEY).catch(() => {});
    setMember(null);
    setSavedPhone('');
    setPhone('');
    setStatus({ kind: 'idle', text: '' });
  };

  return (
    <Screen
      title="ملفي"
      description="دخول العضو برقم الجوال لعرض اسمه وفتح بطاقته في الشجرة فقط."
    >
      {member ? (
        <SectionCard eyebrow="عضو مسجل" title="مرحباً بك">
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{memberName.slice(0, 1)}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{memberName}</Text>
              <Text style={styles.profileMeta}>فرع {branchName}</Text>
              <Text style={styles.profileMeta}>الجوال: {member.phone}</Text>
            </View>
          </View>

          <ActionButton
            label="فتح بطاقتي في الشجرة"
            onPress={() => onOpenMemberCard(member.branch_key, member.tree_child_id)}
          />

          <Pressable onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>تسجيل خروج</Text>
          </Pressable>

          <Text style={styles.note}>
            هذا الدخول للتعريف وفتح البطاقة فقط، ولا يمنح صلاحيات تعديل أو حذف.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard eyebrow="دخول العضو" title="ادخل برقم الجوال المسجل">
          <TextInput
            keyboardType="phone-pad"
            onChangeText={setPhone}
            placeholder="05XXXXXXXX"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            textAlign="right"
            value={phone}
          />
          <ActionButton
            label={loading ? 'جاري الدخول...' : 'دخول'}
            onPress={() => loadMember(phone)}
          />
          <Text style={styles.note}>
            إذا لم يقبل الرقم، اطلب من الإدارة أو مندوب الفرع إضافة رقمك في بطاقة الشجرة.
          </Text>
        </SectionCard>
      )}

      {status.text ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}

      <SectionCard eyebrow="تشخيص" title="حالة الإشعارات">
        {pushDebug ? (
          <View style={styles.pushDebugBlock}>
            <Text style={styles.pushDebugLine}>
              {pushDebug.ok ? '✓ مسجل' : '✗ غير مسجل'} — {formatPushDebugStep(pushDebug.step)}
            </Text>
            <Text style={styles.pushDebugMeta}>آخر محاولة: {formatPushDebugTime(pushDebug.timestamp)}</Text>
            {pushDebug.tokenPrefix ? (
              <Text style={styles.pushDebugMeta}>التوكن: {pushDebug.tokenPrefix}</Text>
            ) : null}
            {pushDebug.projectId ? (
              <Text style={styles.pushDebugMeta}>Project ID: {pushDebug.projectId}</Text>
            ) : null}
            {pushDebug.errorMessage ? (
              <Text style={styles.pushDebugError}>{pushDebug.errorMessage}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.pushDebugMeta}>لا توجد محاولة تسجيل بعد.</Text>
        )}
        <ActionButton
          label={pushRetrying ? 'جاري إعادة التسجيل...' : 'إعادة تسجيل الإشعارات'}
          onPress={retryPushRegistration}
        />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '900',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  profileMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'right',
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 12,
  },
  logoutText: {
    color: colors.text,
    fontWeight: '900',
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: spacing.md,
    textAlign: 'right',
  },
  status: {
    borderRadius: 16,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  errorStatus: {
    backgroundColor: '#FEE2E2',
  },
  successStatus: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'right',
  },
  pushDebugBlock: {
    gap: 6,
    marginBottom: spacing.md,
  },
  pushDebugLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  pushDebugMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  pushDebugError: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
  },
});
