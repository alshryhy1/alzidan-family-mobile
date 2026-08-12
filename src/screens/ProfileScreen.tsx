import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { clearPushPhone, rememberPushPhone, registerPushToken } from '../services/pushNotifications';
import { callPublicRpc, selectPublicRows } from '../services/supabase';
import { colors, spacing, typography } from '../theme';
import type { Branch, TreeChild } from '../types';
import { cleanMemberPhone, memberProfilePhoneQuery } from '../utils/memberPhone';

type ProfileScreenProps = {
  branches: Branch[];
  childrenRows: TreeChild[];
  onOpenMemberCard: (branchKey: string, treeChildId: number) => void;
  onMemberSessionChange?: (phone: string | null) => void;
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
  role?: 'member' | 'delegate' | 'both';
};

type AppLoginByPhoneResult = {
  ok?: boolean;
  error?: string;
  role?: 'member' | 'delegate' | 'both' | 'none';
  phone?: string;
  member_id?: number | null;
  tree_child_id?: number | null;
  person_id?: string | null;
  branch_key?: string | null;
  display_name?: string | null;
  is_delegate?: boolean;
  is_member?: boolean;
};

function cleanPhone(value: string) {
  return cleanMemberPhone(value);
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

export function ProfileScreen({ branches, childrenRows, onOpenMemberCard, onMemberSessionChange }: ProfileScreenProps) {
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [member, setMember] = useState<MemberProfileRow | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const [loading, setLoading] = useState(false);

  const memberTreeRow = useMemo(
    () => childrenRows.find((row) => row.id === member?.tree_child_id) ?? null,
    [childrenRows, member?.tree_child_id],
  );

  const branchName = useMemo(
    () => branches.find((branch) => branch.id === member?.branch_key)?.name ?? member?.branch_key ?? '',
    [branches, member?.branch_key],
  );

  const isDelegateSession = member?.role === 'delegate' || member?.role === 'both';
  const canOpenCard = Boolean(member?.tree_child_id && member?.branch_key);

  const memberName = useMemo(() => {
    if (memberTreeRow?.name) return tripleNameFromPath(memberTreeRow.name);
    if (member?.display_name) return member.display_name;
    if (isDelegateSession) return 'مندوب الفرع';
    return 'عضو العائلة';
  }, [isDelegateSession, member?.display_name, memberTreeRow?.name]);

  const activateSession = async (found: MemberProfileRow, cleanedFallback: string, successText: string) => {
    const storedPhone = cleanPhone(found.phone || cleanedFallback);
    setMember(found);
    setSavedPhone(storedPhone);
    setPhone(storedPhone);
    await AsyncStorage.setItem(MEMBER_PHONE_KEY, storedPhone);
    await rememberPushPhone(storedPhone);
    registerPushToken('profile_login').catch(() => {});
    onMemberSessionChange?.(storedPhone);
    setStatus({ kind: 'success', text: successText });
  };

  const loadMember = async (targetPhone: string) => {
    const cleaned = cleanPhone(targetPhone);
    if (cleaned.length < 9) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح.' });
      return;
    }

    setLoading(true);
    setStatus({ kind: 'idle', text: '' });

    try {
      const query = memberProfilePhoneQuery(cleaned);
      const rows = query ? await selectPublicRows<MemberProfileRow>(query) : [];
      const found = rows[0] ?? null;

      if (found) {
        let role: MemberProfileRow['role'] = 'member';
        try {
          const login = await callPublicRpc<AppLoginByPhoneResult>('public_app_login_by_phone_v1', {
            p_phone: cleaned,
          });
          if (login?.ok && (login.role === 'delegate' || login.role === 'both')) {
            role = login.role;
          }
        } catch {
          // RPC may not be deployed yet; member path still binds push.
        }

        await activateSession(
          { ...found, role },
          cleaned,
          role === 'delegate' || role === 'both'
            ? 'تم تسجيل الدخول وتفعيل إشعارات المندوب على هذا الجهاز.'
            : 'تم تسجيل الدخول.',
        );
        return;
      }

      try {
        const login = await callPublicRpc<AppLoginByPhoneResult>('public_app_login_by_phone_v1', {
          p_phone: cleaned,
        });

        if (login?.ok && (login.is_delegate || login.role === 'delegate' || login.role === 'both')) {
          const synthetic: MemberProfileRow = {
            id: Number(login.member_id || 0),
            phone: login.phone || cleaned,
            branch_key: String(login.branch_key || ''),
            tree_child_id: Number(login.tree_child_id || 0),
            person_id: login.person_id || null,
            display_name: login.display_name || 'مندوب الفرع',
            status: 'active',
            role: login.role === 'both' ? 'both' : 'delegate',
          };
          await activateSession(
            synthetic,
            cleaned,
            'تم تفعيل إشعارات المندوب على هذا الجهاز. ستصلك طلبات الفرع الجديدة.',
          );
          return;
        }
      } catch {
        // Fall through to not-found message.
      }

      setMember(null);
      setSavedPhone('');
      setStatus({
        kind: 'error',
        text: 'هذا الرقم غير مسجل كعضو أو مندوب فرع لدى إدارة العائلة.',
      });
    } catch {
      setStatus({
        kind: 'error',
        text: 'تعذر تسجيل الدخول حالياً، حاول لاحقاً.',
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

  const logout = () => {
    AsyncStorage.removeItem(MEMBER_PHONE_KEY).catch(() => {});
    clearPushPhone().catch(() => {});
    setMember(null);
    setSavedPhone('');
    setPhone('');
    onMemberSessionChange?.(null);
    setStatus({ kind: 'idle', text: '' });
  };

  return (
    <Screen
      title="ملفي"
      description="ادخل برقم الجوال المسجل لتفعيل البطاقة أو إشعارات المندوب على هذا الجهاز."
    >
      {member ? (
        <SectionCard
          eyebrow={isDelegateSession ? 'مندوب مسجل' : 'عضو مسجل'}
          title="مرحباً بك"
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{memberName.slice(0, 1)}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{memberName}</Text>
              {branchName ? <Text style={styles.profileMeta}>فرع {branchName}</Text> : null}
              <Text style={styles.profileMeta}>الجوال: {member.phone || savedPhone}</Text>
              {isDelegateSession ? (
                <Text style={styles.profileMeta}>إشعارات طلبات الفرع مفعّلة على هذا الجهاز</Text>
              ) : null}
            </View>
          </View>

          {canOpenCard ? (
            <ActionButton
              label="فتح بطاقتي في الشجرة"
              onPress={() => onOpenMemberCard(member.branch_key, member.tree_child_id)}
            />
          ) : null}

          <Pressable onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>تسجيل خروج</Text>
          </Pressable>

          <Text style={styles.note}>
            {isDelegateSession
              ? 'بعد هذا التسجيل ستصلك إشعارات طلبات فرعك الجديدة على الجهاز.'
              : 'هذا الدخول للتعريف وفتح البطاقة فقط، ولا يمنح صلاحيات تعديل أو حذف.'}
          </Text>
        </SectionCard>
      ) : (
        <SectionCard eyebrow="دخول" title="ادخل برقم الجوال المسجل">
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
            الأعضاء والمناديب: بعد الدخول يُربط الجهاز بإشعارات طلبات الفرع تلقائياً.
          </Text>
        </SectionCard>
      )}

      {status.text ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}
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
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
    textAlign: 'right',
  },
  status: {
    borderRadius: 14,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorStatus: {
    backgroundColor: '#FEE2E2',
  },
  successStatus: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    color: colors.text,
    fontSize: typography.caption,
    textAlign: 'right',
  },
});
