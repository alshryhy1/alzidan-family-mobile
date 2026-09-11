import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { PersonPhoto } from '../components/PersonPhoto';
import { PhoneField } from '../components/PhoneField';
import { DateStamp, SceneSection, SceneShell } from '../components/scene';
import {
  loginTrustedDevice,
  logoutTrustedDevice,
  resumeTrustedDevice,
  sessionToMemberRow,
  type DeviceSession,
} from '../services/deviceAuth';
import {
  canUseDeviceLock,
  disableDeviceLock,
  enableDeviceLock,
  isDeviceLockEnabled,
} from '../services/deviceLock';
import { saveMemberPhoto, uploadMemberPhoto } from '../services/personPhoto';
import { clearPushPhone, rememberPushPhone, registerPushToken } from '../services/pushNotifications';
import { callPublicRpc, classifyPublicRpcError, insertPublicRow, selectPublicRows } from '../services/supabase';
import { notifyAdminOfNewRequest, notifyWomenManagersOfRequest } from '../services/eventOutboundNotify';
import { notifyBranchDelegatesOfRequest } from '../services/notifyBranchDelegates';
import { brandCircleSize, spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Branch, TreeChild } from '../types';
import {
  DEFAULT_PHONE_COUNTRY_ID,
  formatPhoneDisplay,
  isValidPhone,
  phoneLookupCandidates,
  toE164,
  canonicalizePhone,
  isValidStoredPhone,
} from '../utils/phone';
import { fetchOccasionInbox, yourOccasionPhrase, type OccasionInboxItem } from '../services/occasionInteractions';
import { fetchWomenManagerSession } from '../services/womenManager';
import { fetchFamilyAdminSession } from '../services/familyAdmin';
import { fetchDelegateInboxSession } from '../services/delegateInbox';

type ProfileScreenProps = {
  branches: Branch[];
  childrenRows: TreeChild[];
  viewerPerson?: TreeChild | null;
  onOpenMemberCard: (branchKey: string, treeChildId: number) => void;
  onMemberSessionChange?: (phone: string | null) => void;
  onPhotoSaved?: () => void;
  onOpenGiving?: () => void;
  onOpenWomenAdmin?: () => void;
  onOpenFamilyAdmin?: () => void;
  onOpenDelegateInbox?: () => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
};

const MEMBER_PHONE_REGISTER_MARKER = 'MEMBER_PHONE_REGISTER_V1';

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

function parseTripleName(value: string) {
  const tokens = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((part) => part && part !== 'بن' && part !== 'ابن');
  if (tokens.length < 3) return null;
  return tokens.slice(0, 3);
}

function foldArName(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه');
}

function treeLeafName(path: string) {
  const parts = String(path || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || '';
}

function treePathHasTriple(path: string, triple: string[]) {
  const hay = foldArName(String(path || '').replace(/\//g, ' '));
  if (!hay || triple.length < 3) return false;
  return triple.every((token) => hay.includes(foldArName(token)));
}

function personMatchesTriple(row: TreeChild, triple: string[], branch: string) {
  if (String(row.branchKey || '').trim() !== branch) return false;
  const path = [row.parentName, row.name].filter(Boolean).join('/');
  if (!treePathHasTriple(path, triple) && !treePathHasTriple(row.name, triple)) {
    return false;
  }
  return foldArName(treeLeafName(row.name || path)) === foldArName(triple[0]);
}

function tripleExistsInLoadedTree(rows: TreeChild[], triple: string[], branch: string) {
  return rows.some((row) => personMatchesTriple(row, triple, branch));
}

function memberPhoneRegisterRequestId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MPR-${stamp}-${random}`;
}

export function ProfileScreen({
  branches,
  childrenRows,
  viewerPerson,
  onOpenMemberCard,
  onMemberSessionChange,
  onPhotoSaved,
  onOpenGiving,
  onOpenWomenAdmin,
  onOpenFamilyAdmin,
  onOpenDelegateInbox,
  onRefresh,
  refreshing = false,
}: ProfileScreenProps) {
  const p = useThemePalette();
  const styles = useThemedStyles(profileStyles);
  const [countryId, setCountryId] = useState(DEFAULT_PHONE_COUNTRY_ID);
  const [national, setNational] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [member, setMember] = useState<MemberProfileRow | null>(null);
  const [inbox, setInbox] = useState<OccasionInboxItem[]>([]);
  const [womenManagerEnabled, setWomenManagerEnabled] = useState(false);
  const [familyAdminEnabled, setFamilyAdminEnabled] = useState(false);
  const [delegateInboxEnabled, setDelegateInboxEnabled] = useState(false);
  const [expandedInbox, setExpandedInbox] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [unregisteredPhone, setUnregisteredPhone] = useState('');
  const [tripleName, setTripleName] = useState('');
  const [registerBranch, setRegisterBranch] = useState(branches[0]?.id ?? 'زيدان');
  const [registerSending, setRegisterSending] = useState(false);
  const [registerSent, setRegisterSent] = useState(false);
  const [faceLockOn, setFaceLockOn] = useState(false);

  const memberTreeRow = useMemo(() => {
    const id = Number(member?.tree_child_id || 0);
    if (!id) return null;
    const fromPublic = childrenRows.find((row) => Number(row.id) === id) || null;
    const fromViewer = viewerPerson && Number(viewerPerson.id) === id ? viewerPerson : null;
    if (fromPublic && fromViewer) {
      return {
        ...fromPublic,
        photoUrl: fromPublic.photoUrl || fromViewer.photoUrl || null,
      };
    }
    return fromPublic || fromViewer;
  }, [childrenRows, member?.tree_child_id, viewerPerson]);

  const branchName = useMemo(
    () => branches.find((branch) => branch.id === member?.branch_key)?.name ?? member?.branch_key ?? '',
    [branches, member?.branch_key],
  );

  const isDelegateSession = member?.role === 'delegate' || member?.role === 'both';
  const canOpenCard = Boolean(member?.tree_child_id && member?.branch_key);
  const canManagePhoto = Number(member?.tree_child_id || 0) > 0;
  const photoUrl = localPhotoUrl || memberTreeRow?.photoUrl || null;

  useEffect(() => {
    setLocalPhotoUrl(memberTreeRow?.photoUrl || null);
  }, [memberTreeRow?.photoUrl, member?.tree_child_id]);

  const memberName = useMemo(() => {
    if (memberTreeRow?.name) return tripleNameFromPath(memberTreeRow.name);
    if (member?.display_name) return member.display_name;
    if (isDelegateSession) return 'مندوب الفرع';
    return 'عضو العائلة';
  }, [isDelegateSession, member?.display_name, memberTreeRow?.name]);

  const activateSession = async (session: DeviceSession, successText: string) => {
    const found = sessionToMemberRow(session);
    setMember(found);
    setSavedPhone(session.phone);
    setUnregisteredPhone('');
    setRegisterSent(false);
    await rememberPushPhone(session.phone);
    registerPushToken('profile_login').catch(() => {});
    onMemberSessionChange?.(session.phone);
    setStatus({ kind: 'success', text: successText });
  };

  const bindErrorText = (error: string) => {
    if (error === 'pending_family') {
      return 'هذا الحساب بانتظار تثبيت العائلة، ولا يدخل من التطبيق حتى تثبّته الإدارة.';
    }
    if (error === 'lock_required') {
      return 'افتح بقفل الجهاز للمتابعة.';
    }
    if (error === 'other_device' || error === 'device_other_account') {
      return 'هذا الرقم مستخدم على جهاز آخر.';
    }
    if (error === 'not_found' || error === 'not_allowed') {
      return 'هذا الرقم غير مسجل كعضو أو مندوب فرع لدى إدارة العائلة.';
    }
    if (error === 'bad_phone' || error === 'bad_request') {
      return 'اكتب رقم جوال صحيح مع اختيار الدولة.';
    }
    if (error === 'rpc_missing') {
      return 'تعذر ربط الجهاز الآن. راجِع الإدارة إن استمر.';
    }
    if (error === 'rpc_failed') {
      return 'تعذر ربط الجهاز الآن. تحقق من الاتصال ثم أعد المحاولة.';
    }
    return 'تعذر إكمال ربط الجهاز حالياً، حاول لاحقاً.';
  };

  const loadMember = async (targetPhone: string) => {
    const cleaned = canonicalizePhone(targetPhone);
    if (!cleaned || !isValidStoredPhone(cleaned)) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح مع اختيار الدولة.' });
      return;
    }

    setLoading(true);
    setStatus({ kind: 'idle', text: '' });
    setUnregisteredPhone('');
    setRegisterSent(false);

    try {
      const result = await loginTrustedDevice(cleaned);
      if ('error' in result) {
        if (result.error === 'not_found' || result.error === 'not_allowed') {
          setMember(null);
          setSavedPhone('');
          setUnregisteredPhone(cleaned);
        }
        setStatus({ kind: 'error', text: bindErrorText(result.error) });
        return;
      }
      await activateSession(
        result,
        result.isDelegate
          ? 'تم ربط هذا الجهاز وتفعيل إشعارات المندوب.'
          : 'تم توثيق هذا الجهاز على رقمك. الدخول التالي بنفس الرقم من هنا.',
      );
      if (!(await isDeviceLockEnabled()) && (await canUseDeviceLock())) {
        Alert.alert(
          'الدخول ببصمة الوجه',
          'تحمي حسابك على هذا الجهاز. لا تُرسل صورة الوجه خارج جهازك.',
          [
            { text: 'لاحقاً', style: 'cancel' },
            {
              text: 'تفعيل',
              onPress: () => {
                void enableDeviceLock().then((res) => {
                  if (res.ok) setFaceLockOn(true);
                });
              },
            },
          ],
        );
      } else if (await isDeviceLockEnabled()) {
        setFaceLockOn(true);
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        text: bindErrorText(classifyPublicRpcError(err)),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resumeTrustedDevice()
      .then((session) => {
        if (session) {
          void isDeviceLockEnabled().then(setFaceLockOn);
          return activateSession(session, 'تم استعادة الدخول من الجهاز الموثوق.');
        }
        return undefined;
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = canonicalizePhone(member?.phone || savedPhone || '');
    if (!p) {
      setInbox([]);
      setWomenManagerEnabled(false);
      setFamilyAdminEnabled(false);
      setDelegateInboxEnabled(false);
      return;
    }
    fetchOccasionInbox(p)
      .then(setInbox)
      .catch(() => setInbox([]));
    fetchWomenManagerSession(p)
      .then((session) => setWomenManagerEnabled(session.enabled))
      .catch(() => setWomenManagerEnabled(false));
    fetchFamilyAdminSession(p)
      .then((session) => setFamilyAdminEnabled(session.enabled))
      .catch(() => setFamilyAdminEnabled(false));
    fetchDelegateInboxSession(p)
      .then((session) => setDelegateInboxEnabled(session.enabled))
      .catch(() => setDelegateInboxEnabled(false));
  }, [member?.phone, savedPhone]);

  const logout = () => {
    void logoutTrustedDevice().then(() => {
      void clearPushPhone();
    });
    setMember(null);
    setSavedPhone('');
    setWomenManagerEnabled(false);
    setFamilyAdminEnabled(false);
    setDelegateInboxEnabled(false);
    setNational('');
    setUnregisteredPhone('');
    setRegisterSent(false);
    onMemberSessionChange?.(null);
    setLocalPhotoUrl(null);
    setStatus({ kind: 'idle', text: '' });
  };

  const submitLogin = () => {
    if (!isValidPhone(countryId, national)) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح مع اختيار الدولة.' });
      return;
    }
    loadMember(toE164(countryId, national)).catch(() => {});
  };

  const sendNumberToAdmin = async () => {
    const phone = canonicalizePhone(unregisteredPhone || toE164(countryId, national));
    if (!phone || !isValidStoredPhone(phone)) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح مع اختيار الدولة ثم اضغط دخول.' });
      return;
    }
    const branch = String(registerBranch || '').trim();
    if (!branch) {
      setStatus({ kind: 'error', text: 'اختر الفرع حتى يصل الطلب لمندوب الفرع والإدارة.' });
      return;
    }
    const triple = parseTripleName(tripleName);
    if (!triple) {
      setStatus({ kind: 'error', text: 'اكتب الاسم الثلاثي كاملاً (ثلاثة أسماء).' });
      return;
    }
    const tripleText = triple.join(' ');
    setRegisterSending(true);
    setStatus({ kind: 'idle', text: '' });
    try {
      let inTree: boolean | null = null;
      try {
        const rpc = await callPublicRpc<boolean | { ok?: boolean } | boolean[]>(
          'member_phone_register_name_in_tree_v1',
          { p_branch: branch, p_name: tripleText },
        );
        if (typeof rpc === 'boolean') inTree = rpc;
        else if (Array.isArray(rpc) && typeof rpc[0] === 'boolean') inTree = rpc[0];
        else if (rpc && typeof rpc === 'object' && typeof rpc.ok === 'boolean') inTree = rpc.ok;
      } catch {
        inTree = null;
      }
      if (inTree !== true) {
        const localHit = tripleExistsInLoadedTree(childrenRows, triple, branch);
        if (inTree === false || !localHit) {
          setStatus({
            kind: 'error',
            text: 'الاسم الثلاثي غير موجود في هذا الفرع. راجع الاسم والفرع — لن يُرسل الطلب.',
          });
          return;
        }
      }
      const candidates = phoneLookupCandidates(phone);
      for (const candidate of candidates) {
        const pending = await selectPublicRows<{
          id: number;
          kind: string | null;
          message: string | null;
        }>(
          `approval_requests?phone=eq.${encodeURIComponent(candidate)}&status=eq.pending&select=id,kind,message&limit=12`,
        );
        if (
          pending.some(
            (row) =>
              String(row.kind || '') === 'member_phone_register' ||
              String(row.kind || '') === 'member_registration' ||
              String(row.message || '').includes(MEMBER_PHONE_REGISTER_MARKER),
          )
        ) {
          setRegisterSent(true);
          setStatus({
            kind: 'success',
            text: 'طلبك وصل سابقاً للإدارة والمناديب. انتظر تسجيل رقمك على شخصك في الشجرة.',
          });
          return;
        }
      }

      const requestId = memberPhoneRegisterRequestId();
      const createdAt = new Date().toISOString();
      const message = [
        'تسجيل جوال عضو',
        MEMBER_PHONE_REGISTER_MARKER,
        '',
        `الاسم الثلاثي: ${tripleText}`,
        `الجوال: ${phone}`,
        `الفرع: ${branch}`,
        '',
        '__JSON__:',
        JSON.stringify({
          v: 1,
          operation: 'member_phone_register',
          marker: MEMBER_PHONE_REGISTER_MARKER,
          triple_name: tripleText,
          phone,
          branch_key: branch,
          created_at: createdAt,
        }),
      ].join('\n');

      await insertPublicRow('approval_requests', {
        request_id: requestId,
        kind: 'member_phone_register',
        branch_key: branch,
        name: tripleText,
        phone,
        email: null,
        message,
        status: 'pending',
        created_at: createdAt,
      });
      await notifyBranchDelegatesOfRequest({
        request_id: requestId,
        kind: 'member_phone_register',
        branch_key: branch,
        status: 'pending',
        name: tripleText,
        phone,
      });
      await notifyAdminOfNewRequest({
        request_id: requestId,
        kind: 'member_phone_register',
        branch_key: branch,
        status: 'pending',
        name: tripleText,
        phone,
      });
      await notifyWomenManagersOfRequest({
        request_id: requestId,
        kind: 'member_phone_register',
        branch_key: branch,
        status: 'pending',
        name: tripleText,
        phone,
      });
      setRegisterSent(true);
      setStatus({
        kind: 'success',
        text: 'أُرسل رقمك واسمك للإدارة ومندوب الفرع. بعد تسجيله على شخصك في الشجرة تدخل بنفس الرقم.',
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر إرسال الطلب حالياً، حاول لاحقاً.',
      });
    } finally {
      setRegisterSending(false);
    }
  };

  const pickMemberPhoto = async () => {
    const personId = Number(member?.tree_child_id || 0);
    const phone = canonicalizePhone(member?.phone || savedPhone || '');
    if (!personId || !phone) {
      setStatus({ kind: 'error', text: 'تعذر تحديد عضويتك لحفظ الصورة.' });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus({ kind: 'error', text: 'يلزم السماح بالوصول للصور.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 0.9,
    });
    if (result.canceled || !result.assets.length) return;
    setPhotoBusy(true);
    setStatus({ kind: 'idle', text: 'جاري حفظ الصورة...' });
    try {
      const url = await uploadMemberPhoto(result.assets[0], personId);
      await saveMemberPhoto(phone, url);
      setLocalPhotoUrl(url);
      onPhotoSaved?.();
      setStatus({ kind: 'success', text: 'تم حفظ صورتك.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر حفظ الصورة.',
      });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeMemberPhoto = async () => {
    const phone = canonicalizePhone(member?.phone || savedPhone || '');
    if (!phone) {
      setStatus({ kind: 'error', text: 'تعذر حذف الصورة الآن.' });
      return;
    }
    setPhotoBusy(true);
    setStatus({ kind: 'idle', text: 'جاري حذف الصورة...' });
    try {
      await saveMemberPhoto(phone, '');
      setLocalPhotoUrl(null);
      onPhotoSaved?.();
      setStatus({ kind: 'success', text: 'تم حذف صورتك.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر حذف الصورة.',
      });
    } finally {
      setPhotoBusy(false);
    }
  };

  const confirmRemoveMemberPhoto = () => {
    if (photoBusy) return;
    Alert.alert('حذف الصورة الشخصية؟', 'ستعود صورتك إلى الصورة الافتراضية.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف الصورة', style: 'destructive', onPress: () => void removeMemberPhoto() },
    ]);
  };

  const refreshProfile = async () => {
    try {
      await onRefresh?.();
      const phone = canonicalizePhone(member?.phone || savedPhone || '');
      if (phone) {
        const rows = await fetchOccasionInbox(phone);
        setInbox(rows);
      }
    } catch {
      // parent refresh already reports load errors
    }
  };

  return (
    <SceneShell
      brandAccessory={
        onOpenGiving ? (
          <Pressable
            accessibilityLabel="تبرع"
            accessibilityRole="button"
            onPress={onOpenGiving}
            style={styles.donateCircle}
          >
            <Text style={styles.donateCircleText}>تبرع</Text>
          </Pressable>
        ) : (
          <DateStamp />
        )
      }
      english="MY PLACE"
      eyebrow={member ? (isDelegateSession ? 'مندوب مسجل' : 'عضو مسجل') : 'دخول العائلة'}
      heroExtra={
        member ? (
          <View style={styles.identityHero}>
            <Pressable
              accessibilityLabel={photoUrl ? 'تغيير صورتك' : 'أضف صورتك'}
              disabled={!canManagePhoto || photoBusy}
              onPress={() => {
                if (canManagePhoto && !photoBusy) void pickMemberPhoto();
              }}
              style={styles.photoFrame}
            >
              <PersonPhoto framed name={memberName} showFallback size="lg" uri={photoUrl} />
            </Pressable>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroDateCol}>
                <DateStamp compact />
              </View>
              <View style={styles.heroMetaText}>
                {branchName ? <Text style={styles.heroBranch}>فرع {branchName}</Text> : null}
                <Text style={styles.heroPhone}>{formatPhoneDisplay(member.phone || savedPhone)}</Text>
              </View>
            </View>
          </View>
        ) : undefined
      }
      onRefresh={() => {
        void refreshProfile();
      }}
      refreshing={refreshing}
      subtitle={member ? 'مكانك في العائلة' : 'تفعيل البطاقة وإشعارات الجهاز'}
      title={member ? memberName : 'ملفي'}
      variant="identity"
    >
      {member ? (
        <SceneSection>
          {canOpenCard ? (
            <ActionButton
              label="فتح بطاقتي في الشجرة"
              onPress={() => onOpenMemberCard(member.branch_key, member.tree_child_id)}
            />
          ) : null}

          {canManagePhoto ? (
            <View style={styles.photoActions}>
              <ActionButton
                label={
                  photoBusy
                    ? 'جاري الحفظ...'
                    : photoUrl
                      ? 'تغيير صورتك'
                      : 'أضف صورتك'
                }
                onPress={() => {
                  if (!photoBusy) void pickMemberPhoto();
                }}
                variant="secondary"
              />
              {photoUrl ? (
                <Pressable
                  disabled={photoBusy}
                  onPress={confirmRemoveMemberPhoto}
                  style={styles.photoDeleteBtn}
                >
                  <Text style={styles.photoDeleteText}>
                    {photoBusy ? 'جاري الحذف...' : 'حذف صورتك'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.logoutSplit} />

          <ActionButton
            label={faceLockOn ? 'إيقاف بصمة الوجه' : 'تفعيل الدخول ببصمة الوجه'}
            onPress={() => {
              if (faceLockOn) {
                void disableDeviceLock().then(() => setFaceLockOn(false));
                return;
              }
              void enableDeviceLock().then((res) => {
                if (res.ok) {
                  setFaceLockOn(true);
                  return;
                }
                if (res.error === 'unavailable') {
                  setStatus({
                    kind: 'error',
                    text: 'فعّل بصمة الوجه من إعدادات الجهاز أولاً.',
                  });
                }
              });
            }}
            variant="secondary"
          />

          <Pressable onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>تسجيل خروج</Text>
          </Pressable>

          <Text style={styles.note}>
            الخروج ينهي الجلسة فقط. الدخول التالي بنفس الرقم من هذا الجهاز.
          </Text>
        </SceneSection>
      ) : (
        <SceneSection title="اربط هذا الجهاز">
          <PhoneField
            countryId={countryId}
            national={national}
            onCountryChange={setCountryId}
            onNationalChange={setNational}
            hint="اختر الدولة ثم اكتب الرقم المحلي فقط دون رمز الدولة."
          />
          <ActionButton
            label={loading ? 'جاري الربط...' : 'ربط الجهاز'}
            onPress={submitLogin}
          />
          <Text style={styles.note}>
            كل جهاز مرتبط برقم واحد. إذا كان الرقم مستخدماً على جهاز آخر فلن يتم الدخول من هنا.
          </Text>
        </SceneSection>
      )}

      {status.text ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}

      {!member && unregisteredPhone ? (
        <SceneSection title="أرسل رقمك للإدارة">
          <Text style={styles.note}>
            اكتب اسمك الثلاثي كما هو في الشجرة واختر فرعك. إن لم يطابق الاسم شخصاً في الفرع يُرفض الإرسال ولا يصل للإدارة ولا للمناديب.
          </Text>
          <TextInput
            onChangeText={setTripleName}
            placeholder="الاسم الثلاثي"
            placeholderTextColor={p.textMuted}
            style={styles.input}
            textAlign="right"
            value={tripleName}
          />
          <Text style={styles.fieldLabel}>الفرع</Text>
          <View style={styles.branchPicker}>
            {branches.map((item) => {
              const active = item.id === registerBranch;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setRegisterBranch(item.id)}
                  style={[styles.chip, active && styles.activeChip]}
                >
                  <Text style={[styles.chipText, active && styles.activeChipText]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <ActionButton
            label={
              registerSending
                ? 'جاري الإرسال...'
                : registerSent
                  ? 'تم إرسال الطلب'
                  : 'أرسل رقمك للإدارة'
            }
            onPress={() => {
              if (!registerSending && !registerSent) void sendNumberToAdmin();
            }}
          />
        </SceneSection>
      ) : null}

      {member && womenManagerEnabled ? (
        <SceneSection title="إدارة النساء">
          <Text style={styles.note}>
            صلاحية مسؤولة نسائية من الإدارة الأصلية. ليست إدارة كاملة.
          </Text>
          <ActionButton
            label="فتح إدارة النساء"
            onPress={() => onOpenWomenAdmin?.()}
          />
        </SceneSection>
      ) : null}

      {member && familyAdminEnabled ? (
        <SceneSection title="إدارة العائلة">
          <Text style={styles.note}>
            قبول ورفض الطلبات وتعديل المناديب من التطبيق مباشرة — يتطلب تفعيل السيرفر (Supabase). بلا رمز الإدارة.
          </Text>
          <ActionButton
            label="فتح إدارة العائلة"
            onPress={() => onOpenFamilyAdmin?.()}
          />
        </SceneSection>
      ) : null}

      {member && delegateInboxEnabled ? (
        <SceneSection title="طلبات فرعي">
          <Text style={styles.note}>
            مندوب معتمد على هذا الجهاز. الطلبات المعلّقة لفرعك فقط، بلا سرّ الموقع وبلا إدارة عائلة.
          </Text>
          <ActionButton
            label="فتح طلبات الفرع"
            onPress={() => onOpenDelegateInbox?.()}
          />
        </SceneSection>
      ) : null}

      {member && !womenManagerEnabled ? (
        <SceneSection title="وصلك من العائلة">
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
        </SceneSection>
      ) : null}
    </SceneShell>
  );
}

function profileStyles(p: ThemePalette) {
  return {
  inboxCard: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(37, 92, 77, 0.16)',
    backgroundColor: p.primarySoft,
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
    color: p.textMuted,
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
    backgroundColor: p.accentSoft,
  },
  inboxChevron: {
    color: p.primary,
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
    backgroundColor: p.primary,
  },
  inboxBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: p.accent,
  },
  inboxBadgeText: {
    color: p.white,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  inboxLine: {
    color: p.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inboxVerb: {
    color: p.textMuted,
    fontWeight: '600',
  },
  inboxOccasion: {
    color: p.primaryDark,
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
    backgroundColor: p.accentSoft,
  },
  inboxSender: {
    color: p.primaryDark,
    fontWeight: '900',
    fontSize: 14,
    writingDirection: 'rtl',
  },
  inboxSep: {
    color: p.accent,
    fontWeight: '800',
  },
  inboxMsg: {
    color: p.text,
    fontSize: typography.caption + 1,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  input: {
    backgroundColor: p.surfaceMuted,
    borderRadius: 16,
    color: p.text,
    fontSize: 15,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: p.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  branchPicker: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
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
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  activeChipText: {
    color: p.white,
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: p.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: {
    color: p.surface,
    fontSize: 24,
    fontWeight: '900',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    color: p.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  profileMeta: {
    color: p.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'right',
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: p.gold,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 12,
  },
  photoActions: {
    gap: spacing.sm,
  },
  photoDeleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  photoDeleteText: {
    color: p.textMuted,
    fontSize: 14,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  logoutSplit: {
    alignSelf: 'center',
    backgroundColor: 'rgba(196,163,90,0.35)',
    height: 1,
    marginVertical: spacing.xs,
    width: 48,
  },
  identityHero: {
    alignItems: 'stretch',
    direction: 'ltr',
    gap: 10,
    paddingBottom: spacing.xs,
    paddingTop: 2,
    width: '100%',
  },
  donateCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,163,90,0.16)',
    borderColor: p.gold,
    borderRadius: brandCircleSize / 2,
    borderWidth: 1,
    height: brandCircleSize,
    justifyContent: 'center',
    width: brandCircleSize,
  },
  donateCircleText: {
    color: p.goldSoft,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  heroMetaRow: {
    alignItems: 'flex-start',
    direction: 'ltr',
    flexDirection: 'row',
    width: '100%',
  },
  heroDateCol: {
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  heroMetaText: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 4,
    minWidth: 0,
    paddingLeft: 8,
  },
  photoFrame: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    justifyContent: 'center',
  },
  heroBranch: {
    color: p.gold,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroPhone: {
    color: p.goldSoft,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  monogramOuter: {
    alignItems: 'center',
    borderColor: p.gold,
    borderRadius: 52,
    borderWidth: 1,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  monogramInner: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,163,90,0.16)',
    borderColor: p.goldSoft,
    borderRadius: 40,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  monogramLetter: {
    color: p.goldSoft,
    fontSize: 34,
    fontWeight: '800',
  },
  logoutText: {
    color: p.text,
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    color: p.textMuted,
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
    color: p.text,
    fontSize: typography.caption,
    textAlign: 'right',
  },
  };
}
