import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { PhoneField } from '../components/PhoneField';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { clearPushPhone, rememberPushPhone, registerPushToken } from '../services/pushNotifications';
import { callPublicRpc, selectPublicRows } from '../services/supabase';
import { colors, spacing, typography } from '../theme';
import type { Branch, TreeChild } from '../types';
import {
  DEFAULT_PHONE_COUNTRY_ID,
  formatPhoneDisplay,
  isValidPhone,
  memberProfilePhoneQuery,
  phoneLookupCandidates,
  toE164,
  canonicalizePhone,
  isValidStoredPhone,
} from '../utils/phone';
import { fetchOccasionInbox, yourOccasionPhrase, type OccasionInboxItem } from '../services/occasionInteractions';

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
  const [countryId, setCountryId] = useState(DEFAULT_PHONE_COUNTRY_ID);
  const [national, setNational] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [member, setMember] = useState<MemberProfileRow | null>(null);
  const [inbox, setInbox] = useState<OccasionInboxItem[]>([]);
  const [expandedInbox, setExpandedInbox] = useState<Record<string, boolean>>({});
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

  const tryLoginRpc = async (e164: string) => {
    const candidates = phoneLookupCandidates(e164);
    for (const candidate of candidates) {
      try {
        const login = await callPublicRpc<AppLoginByPhoneResult>('public_app_login_by_phone_v1', {
          p_phone: candidate,
        });
        if (login?.ok) return login;
      } catch {
        // try next candidate / fall through
      }
    }
    return null;
  };

  const activateSession = async (found: MemberProfileRow, cleanedFallback: string, successText: string) => {
    const storedPhone = canonicalizePhone(found.phone || cleanedFallback) || cleanedFallback;
    setMember(found);
    setSavedPhone(storedPhone);
    await AsyncStorage.setItem(MEMBER_PHONE_KEY, storedPhone);
    await rememberPushPhone(storedPhone);
    registerPushToken('profile_login').catch(() => {});
    onMemberSessionChange?.(storedPhone);
    setStatus({ kind: 'success', text: successText });
  };

  const loadMember = async (targetPhone: string) => {
    const cleaned = canonicalizePhone(targetPhone);
    if (!cleaned || !isValidStoredPhone(cleaned)) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح مع اختيار الدولة.' });
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
          const login = await tryLoginRpc(cleaned);
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
        const login = await tryLoginRpc(cleaned);

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
        const cleaned = canonicalizePhone(value || '');
        if (cleaned) loadMember(cleaned).catch(() => {});
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = canonicalizePhone(member?.phone || savedPhone || '');
    if (!p) {
      setInbox([]);
      return;
    }
    fetchOccasionInbox(p)
      .then(setInbox)
      .catch(() => setInbox([]));
  }, [member?.phone, savedPhone]);

  const logout = () => {
    AsyncStorage.removeItem(MEMBER_PHONE_KEY).catch(() => {});
    clearPushPhone().catch(() => {});
    setMember(null);
    setSavedPhone('');
    setNational('');
    onMemberSessionChange?.(null);
    setStatus({ kind: 'idle', text: '' });
  };

  const submitLogin = () => {
    if (!isValidPhone(countryId, national)) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح مع اختيار الدولة.' });
      return;
    }
    loadMember(toE164(countryId, national)).catch(() => {});
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
              <Text style={styles.profileMeta}>الجوال: {formatPhoneDisplay(member.phone || savedPhone)}</Text>
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
          <PhoneField
            countryId={countryId}
            national={national}
            onCountryChange={setCountryId}
            onNationalChange={setNational}
            hint="اختر الدولة ثم اكتب الرقم المحلي فقط دون رمز الدولة."
          />
          <ActionButton
            label={loading ? 'جاري الدخول...' : 'دخول'}
            onPress={submitLogin}
          />
          <Text style={styles.note}>
            الأعضاء والمناديب: بعد الدخول يُربط الجهاز بإشعارات طلبات الفرع تلقائياً.
          </Text>
        </SectionCard>
      )}

      
      {member ? (
        <SectionCard
          eyebrow={
            inbox.reduce((n, it) => n + (Array.isArray(it.messages) ? it.messages.length : Number(it.total || 0)), 0)
              ? `${inbox.reduce((n, it) => n + (Array.isArray(it.messages) ? Math.min(8, it.messages.length) : Number(it.total || 0)), 0)} رسالة`
              : 'خاص'
          }
          title="وصلك من العائلة"
        >
          {inbox.length === 0 ? (
            <Text style={styles.note}>
              لا تفاعلات خاصة بعد. عندما يشاركك أحد مناسبة تخصك تظهر هنا فقط لك.
            </Text>
          ) : (
            inbox.map((item) => {
              const total = Number(item.total || 0);
              const yours = yourOccasionPhrase(item.occasion_type);
              const senderLabel = (raw: string) => {
                const tokens = String(raw || '')
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean)
                  .filter((w) => w !== 'بن' && w !== 'ابن' && w !== 'بنت');
                if (tokens.length >= 2) return `${tokens[0]} ${tokens[1]}`;
                return tokens[0] || 'فرد من العائلة';
              };
              const whoLabel =
                total <= 1 ? 'فرد من العائلة' : `${total} من أفراد العائلة`;
              const verb = total <= 1 ? 'شاركك' : 'شاركوك';
              const key = `${item.occasion_id}-${item.recipient_id}`;
              const msgs = (item.messages || []).slice(0, 8).filter((m) =>
                String(m.message || m.full_text || m.label || '').trim()
              );
              const msgCount = msgs.length || total || 0;
              const open = !!expandedInbox[key];
              const preview = msgs.length
                ? senderLabel(msgs[0].sender_name || '')
                : 'اضغط لعرض الرسائل';
              return (
              <View key={key} style={styles.inboxCard}>
                <Pressable
                  onPress={() =>
                    setExpandedInbox((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  style={styles.inboxToggle}
                >
                  <View style={styles.inboxTop}>
                    <View style={styles.inboxBadge}>
                      <View style={styles.inboxBadgeDot} />
                      <Text style={styles.inboxBadgeText}>{whoLabel}</Text>
                    </View>
                    <Text style={styles.inboxLine}>
                      <Text style={styles.inboxVerb}>{verb} </Text>
                      <Text style={styles.inboxOccasion}>{yours}</Text>
                    </Text>
                  </View>
                  <View style={styles.inboxMeta}>
                    {!open ? <Text style={styles.inboxPreview}>{preview}</Text> : <View style={{ flex: 1 }} />}
                    <Text style={styles.inboxChip}>
                      {msgCount === 1
                        ? 'رسالة واحدة'
                        : msgCount === 2
                          ? 'رسالتان'
                          : msgCount <= 10
                            ? `${msgCount} رسائل`
                            : `${msgCount} رسالة`}
                    </Text>
                    <Text style={styles.inboxChevron}>{open ? '▴' : '▾'}</Text>
                  </View>
                </Pressable>
                {open
                  ? msgs.map((m) => {
                      const textMsg = String(m.message || m.full_text || m.label || '').trim();
                      if (!textMsg) return null;
                      const sender = senderLabel(m.sender_name || '');
                      return (
                        <View key={m.id} style={styles.inboxMsgRow}>
                          <Text style={styles.inboxSender}>{sender}</Text>
                          <Text style={styles.inboxSep}> · </Text>
                          <Text style={styles.inboxMsg}>{textMsg}</Text>
                        </View>
                      );
                    })
                  : null}
              </View>
              );
            })
          )}
        </SectionCard>
      ) : null}

      {status.text ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inboxCard: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(37, 92, 77, 0.16)',
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  inboxToggle: {
    width: '100%',
  },
  inboxMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  inboxPreview: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inboxChip: {
    color: '#92400E',
    fontSize: 11.5,
    fontWeight: '800',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.accentSoft,
  },
  inboxChevron: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  inboxTop: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inboxBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  inboxBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  inboxBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  inboxLine: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inboxVerb: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  inboxOccasion: {
    color: colors.primaryDark,
    fontWeight: '900',
  },
  inboxMsgRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(180, 134, 69, 0.28)',
    backgroundColor: colors.accentSoft,
  },
  inboxSender: {
    color: colors.primaryDark,
    fontWeight: '900',
    fontSize: 14,
    writingDirection: 'rtl',
  },
  inboxSep: {
    color: colors.accent,
    fontWeight: '800',
  },
  inboxMsg: {
    color: colors.text,
    fontSize: typography.caption + 1,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
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
