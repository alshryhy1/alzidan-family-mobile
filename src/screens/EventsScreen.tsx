import { useState } from 'react';
import { useEffect } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Linking, Pressable, Text, TextInput, View, Alert } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { DataState } from '../components/DataState';
import { PhoneField } from '../components/PhoneField';
import { SceneShell } from '../components/scene';
import { SectionCard } from '../components/SectionCard';
import { appendTrackedRequest } from '../services/myRequestsTrack';
import { notifyAdminOfNewRequest, notifyFamilyEventPublished } from '../services/eventOutboundNotify';
import { notifyBranchDelegatesOfRequest } from '../services/notifyBranchDelegates';
import { rememberPushPhone, registerPushToken } from '../services/pushNotifications';
import { insertPublicRow, uploadPublicFileUri } from '../services/supabase';
import {
  buildMemberOccasionRow,
  deleteMemberOccasion,
  isRegisteredMemberPhone,
  publishMemberOccasion,
  updateMemberOccasion,
} from '../services/memberOccasions';
import { heritagePalette, spacing, typography, type ThemePalette } from '../theme';
import { useTheme, useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Branch, FamilyEvent } from '../types';
import {
  MOBILE_EVENT_FAMILIES,
  buildMobileEventRequestMessage,
  eventAllowsMedia,
  findMobileEventType,
  listMobileEventTypesByFamily,
  validateEventFacts,
  EVENT_PLACE_KINDS,
  formatVenueLine,
  mapsUrlFromCoords,
  type MobileEventFamily,
} from '../utils/eventRequestMessage';
import { formatVisitTimeRangeAr } from '../utils/formatVisitTimeAr';
import { OccasionInteractCard } from '../components/OccasionInteractCard';
import {
  DEFAULT_PHONE_COUNTRY_ID,
  canonicalizePhone,
  e164Digits,
  isValidPhone,
  parsePhoneToParts,
  toE164,
  phonesMatch,
} from '../utils/phone';

type Filter = 'all' | FamilyEvent['category'];

type EventsScreenProps = {
  branches: Branch[];
  error: string | null;
  events: FamilyEvent[];
  loading: boolean;
  onRetry: () => void;
  memberPhone?: string | null;
  memberGreeting?: string | null;
  memberBranchKey?: string | null;
};

const filters: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'happy', label: 'الأفراح' },
  { key: 'health', label: 'المرضى والخروج' },
  { key: 'condolence', label: 'التعازي' },
];

const categoryColor: Record<FamilyEvent['category'], string> = {
  happy: heritagePalette.happy,
  health: heritagePalette.health,
  condolence: heritagePalette.condolence,
};

function requestId() {
  return `EVAPP-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function extensionFromAsset(asset: ImagePicker.ImagePickerAsset, fallback: string) {
  const name = asset.fileName || asset.uri.split('/').pop() || '';
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const normalized = String(ext || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return normalized || fallback;
}

async function uploadPickedAsset(asset: ImagePicker.ImagePickerAsset, requestIdValue: string, kind: 'image' | 'video') {
  let uploadUri = asset.uri;
  let contentType = asset.mimeType || (kind === 'image' ? 'image/jpeg' : 'video/mp4');
  let ext = extensionFromAsset(asset, kind === 'image' ? 'jpg' : 'mp4');

  if (kind === 'image') {
    const converted = await ImageManipulator.manipulateAsync(asset.uri, [], {
      compress: 0.86,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    uploadUri = converted.uri;
    contentType = 'image/jpeg';
    ext = 'jpg';
  }

  const path = `${requestIdValue}/${kind}-${Date.now()}.${ext}`;
  return uploadPublicFileUri('event-media', path, uploadUri, contentType);
}

function compactNameFromPath(value: string) {
  const parts = String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(-3)
    .reverse();
  const uniqueOrdered = parts.filter((part, index) => (index === 0 ? true : part !== parts[index - 1]));
  return uniqueOrdered.join(' بن ');
}

function whatsappUrl(phone: string, event: FamilyEvent) {
  const normalized = e164Digits(canonicalizePhone(phone) || phone);
  const message =
    event.category === 'condolence'
      ? 'عظم الله أجركم وأحسن عزاءكم'
      : event.category === 'health'
        ? 'لا بأس طهور إن شاء الله'
        : 'ألف مبروك';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function visitDateRange(event: FamilyEvent) {
  if (event.visitDateFrom && event.visitDateTo) return `من ${event.visitDateFrom} إلى ${event.visitDateTo}`;
  return event.visitDateFrom || event.visitDateTo || '';
}

function visitTimeRange(event: FamilyEvent) {
  return formatVisitTimeRangeAr(event.visitTimeFrom, event.visitTimeTo);
}

function eventDetailRows(event: FamilyEvent) {
  const isVisit = event.contactMethod === 'visit';
  const venue = formatVenueLine({ placeKind: event.placeKind, extra: event.placeName });
  const mapsUrl = mapsUrlFromCoords(event.lat, event.lng);
  return [
    venue ? { label: 'المكان', value: venue } : null,
    mapsUrl && event.lat != null && event.lng != null
      ? { label: 'الإحداثيات', value: `${event.lat}, ${event.lng}` }
      : null,
    event.hospitalName ? { label: 'المستشفى', value: event.hospitalName } : null,
    event.hospitalDepartment ? { label: 'القسم', value: event.hospitalDepartment } : null,
    isVisit && visitDateRange(event) ? { label: 'تاريخ الزيارة', value: visitDateRange(event) } : null,
    isVisit && visitTimeRange(event) ? { label: 'وقت الزيارة', value: visitTimeRange(event) } : null,
    event.contactMethod
      ? {
          label: 'طريقة التواصل',
          value:
            event.contactMethod === 'visit'
              ? 'زيارة'
              : event.contactMethod === 'call'
                ? 'اتصال'
                : event.contactMethod === 'whatsapp'
                  ? 'واتساب'
                  : event.contactMethod,
        }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
}

function stripMarkdownNoise(value?: string | null) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function EventVideo({ uri }: { uri: string }) {
  const styles = useThemedStyles(eventsStyles);
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = false;
  });

  return (
    <VideoView
      allowsPictureInPicture
      contentFit="contain"
      nativeControls
      player={player}
      style={styles.eventVideo}
    />
  );
}

export function EventsScreen({
  branches,
  error,
  events,
  loading,
  onRetry,
  memberPhone = null,
  memberGreeting = null,
  memberBranchKey = null,
}: EventsScreenProps) {
  const { occasionSocialEnabled } = useTheme();
  const p = useThemePalette();
  const styles = useThemedStyles(eventsStyles);
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addBranch, setAddBranch] = useState(branches[0]?.id ?? 'زيدان');
  const [addFamily, setAddFamily] = useState<MobileEventFamily>('news');
  const [addType, setAddType] = useState(() => listMobileEventTypesByFamily('news')[0]?.key || 'birth');
  const [addPerson, setAddPerson] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addPlace, setAddPlace] = useState('');
  const [addPlaceKind, setAddPlaceKind] = useState('');
  const [addCoords, setAddCoords] = useState('');
  const [addHospitalDept, setAddHospitalDept] = useState('');
  const [contactCountryId, setContactCountryId] = useState(DEFAULT_PHONE_COUNTRY_ID);
  const [contactNational, setContactNational] = useState('');
  const [addPrayerPlace, setAddPrayerPlace] = useState('');
  const [addPrayerTime, setAddPrayerTime] = useState('');
  const [addBurialPlace, setAddBurialPlace] = useState('');
  const [addImageUrl, setAddImageUrl] = useState('');
  const [addVideoUrl, setAddVideoUrl] = useState('');
  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickedVideo, setPickedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [addText, setAddText] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [phoneCountryId, setPhoneCountryId] = useState(DEFAULT_PHONE_COUNTRY_ID);
  const [phoneNational, setPhoneNational] = useState('');
  const [submitStatus, setSubmitStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [pickingMedia, setPickingMedia] = useState<'image' | 'video' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sessionPhone = canonicalizePhone(memberPhone || '');
  const visibleEvents = filter === 'all' ? events : events.filter((event) => event.category === filter);
  const featuredEvent = visibleEvents[0] ?? null;
  const happyCount = events.filter((event) => event.category === 'happy').length;
  const healthCount = events.filter((event) => event.category === 'health').length;
  const condolenceCount = events.filter((event) => event.category === 'condolence').length;
  const typesForFamily = listMobileEventTypesByFamily(addFamily);
  const selectedType = findMobileEventType(addType);
  const allowsMedia = eventAllowsMedia(selectedType.key);

  useEffect(() => {
    const cleaned = canonicalizePhone(memberPhone || '');
    if (!cleaned) return;
    setPhoneNational((current) => {
      if (current.trim()) return current;
      const parts = parsePhoneToParts(cleaned);
      setPhoneCountryId(parts.countryId);
      return parts.national;
    });
  }, [memberPhone]);

  useEffect(() => {
    if (memberBranchKey) setAddBranch((current) => current || memberBranchKey);
    if (memberGreeting) {
      setSubmitterName((current) => (current.trim() ? current : String(memberGreeting).trim()));
    }
  }, [memberBranchKey, memberGreeting]);

  const pickMedia = async (kind: 'image' | 'video') => {
    if (pickingMedia) return;
    setPickingMedia(kind);
    setSubmitStatus({
      kind: 'idle',
      text: kind === 'image' ? 'اختر الصورة ثم اضغط تم أو إلغاء.' : 'اختر الفيديو ثم اضغط تم أو إلغاء.',
    });

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setSubmitStatus({ kind: 'error', text: 'يلزم السماح بالوصول للصور والفيديو.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: kind === 'image' ? ['images'] : ['videos'],
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        quality: 0.85,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      });

      if (result.canceled || !result.assets.length) {
        setSubmitStatus({ kind: 'idle', text: '' });
        return;
      }

      const asset = result.assets[0];
      if (kind === 'image') setPickedImage(asset);
      else setPickedVideo(asset);
      setSubmitStatus({
        kind: 'success',
        text: kind === 'image' ? 'تم اختيار الصورة، وسترسل مع المناسبة.' : 'تم اختيار الفيديو، وسيرسل مع المناسبة.',
      });
    } catch (error) {
      setSubmitStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر فتح مكتبة الصور.',
      });
    } finally {
      setPickingMedia(null);
    }
  };

  function eventRaw(event: FamilyEvent): Record<string, unknown> {
    const raw = event.rawDetails;
    if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  function isOwnedEvent(event: FamilyEvent) {
    if (!sessionPhone) return false;
    return phonesMatch(sessionPhone, event.sourcePhone);
  }

  function resetAddForm() {
    setEditingId(null);
    setAddPerson('');
    setAddDate('');
    setAddPlace('');
    setAddPlaceKind('');
    setAddCoords('');
    setAddHospitalDept('');
    setContactNational('');
    setAddPrayerPlace('');
    setAddPrayerTime('');
    setAddBurialPlace('');
    setAddImageUrl('');
    setAddVideoUrl('');
    setPickedImage(null);
    setPickedVideo(null);
    setAddText('');
  }

  function startEditEvent(event: FamilyEvent) {
    const type = findMobileEventType(String(event.type || 'general'));
    const raw = eventRaw(event);
    setEditingId(event.id);
    setAddFamily(type.family);
    setAddType(type.key);
    if (event.branchKey) setAddBranch(event.branchKey);
    setAddPerson(event.person || '');
    setAddDate(event.eventDate || event.date || '');
    setAddPlace(event.placeName || event.hospitalName || String(raw.condolence_place || '') || '');
    setAddPlaceKind(event.placeKind || '');
    setAddCoords(
      event.lat != null && event.lng != null ? `${event.lat}, ${event.lng}` : '',
    );
    setAddHospitalDept(event.hospitalDepartment || '');
    setAddPrayerPlace(String(raw.prayer_place || ''));
    setAddPrayerTime(String(raw.prayer_time || ''));
    setAddBurialPlace(String(raw.burial_place || ''));
    setAddText(event.details || String(raw.text || ''));
    setAddImageUrl(event.imageUrl || '');
    setAddVideoUrl(event.videoUrl || '');
    setPickedImage(null);
    setPickedVideo(null);
    if (event.contactPhone) {
      const parts = parsePhoneToParts(event.contactPhone);
      setContactCountryId(parts.countryId);
      setContactNational(parts.national);
    }
    setAddOpen(true);
    setSubmitStatus({ kind: 'idle', text: 'تعديل المصدر — احفظ بعد التغيير.' });
  }

  function confirmDeleteEvent(event: FamilyEvent) {
    const phone = sessionPhone || toE164(phoneCountryId, phoneNational);
    Alert.alert('حذف المناسبة', 'تُحذف من المصدر ولن تظهر في المناسبات.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const result = await deleteMemberOccasion(phone, Number(event.id));
              if (!result?.ok) {
                setSubmitStatus({
                  kind: 'error',
                  text:
                    result?.error === 'not_owner'
                      ? 'لا يمكنك حذف مناسبة ليست من مصدرك.'
                      : 'تعذر الحذف الآن. راجِع الإدارة إن استمر.',
                });
                return;
              }
              if (editingId === event.id) resetAddForm();
              setSubmitStatus({ kind: 'success', text: 'حُذفت المناسبة من المصدر.' });
              onRetry();
            } catch (error) {
              setSubmitStatus({
                kind: 'error',
                text: error instanceof Error ? error.message : 'تعذر حذف المناسبة.',
              });
            }
          })();
        },
      },
    ]);
  }

  const submitEventRequest = async () => {
    const phone = toE164(phoneCountryId, phoneNational);
    if (!addBranch.trim()) {
      setSubmitStatus({ kind: 'error', text: 'اختر الفرع.' });
      return;
    }
    if (!submitterName.trim() || !isValidPhone(phoneCountryId, phoneNational)) {
      setSubmitStatus({ kind: 'error', text: 'اكتب اسم المرسل ورقم جوال صحيح مع اختيار الدولة.' });
      return;
    }
    if (contactNational.trim() && !isValidPhone(contactCountryId, contactNational)) {
      setSubmitStatus({ kind: 'error', text: 'رقم جوال التواصل غير صحيح.' });
      return;
    }
    const factsError = validateEventFacts({
      type: selectedType.key,
      person: addPerson,
      dateLabel: addDate,
      place: addPlace,
      placeKind: addPlaceKind,
      coords: addCoords,
      text: addText,
    });
    if (factsError) {
      setSubmitStatus({ kind: 'error', text: factsError });
      return;
    }
    if (allowsMedia && addImageUrl.trim() && !/^https?:\/\//i.test(addImageUrl.trim())) {
      setSubmitStatus({ kind: 'error', text: 'رابط الصورة يجب أن يبدأ بـ http أو https.' });
      return;
    }
    if (allowsMedia && addVideoUrl.trim() && !/^https?:\/\//i.test(addVideoUrl.trim())) {
      setSubmitStatus({ kind: 'error', text: 'رابط الفيديو يجب أن يبدأ بـ http أو https.' });
      return;
    }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const requestIdValue = requestId();
      const uploadedImageUrl =
        allowsMedia && pickedImage
          ? await uploadPickedAsset(pickedImage, requestIdValue, 'image')
          : '';
      const uploadedVideoUrl =
        allowsMedia && pickedVideo
          ? await uploadPickedAsset(pickedVideo, requestIdValue, 'video')
          : '';
      const finalImageUrl = allowsMedia ? uploadedImageUrl || addImageUrl.trim() : '';
      const finalVideoUrl = allowsMedia ? uploadedVideoUrl || addVideoUrl.trim() : '';
      const contactPhone = contactNational.trim() ? toE164(contactCountryId, contactNational) : '';
      const registered = await isRegisteredMemberPhone(phone);

      if (editingId && !registered) {
        setSubmitStatus({
          kind: 'error',
          text: 'تعديل المصدر للمسجّلين بجوالهم فقط. ادخل من ملفي.',
        });
        return;
      }

      if (registered) {
        const row = buildMemberOccasionRow({
          branch: addBranch,
          type: selectedType.key,
          person: addPerson.trim(),
          dateLabel: addDate.trim(),
          place: addPlace.trim(),
          placeKind: addPlaceKind,
          coords: addCoords.trim(),
          hospitalDept: addHospitalDept.trim(),
          contactPhone,
          prayerPlace: addPrayerPlace.trim(),
          prayerTime: addPrayerTime.trim(),
          burialPlace: addBurialPlace.trim(),
          text: addText.trim(),
          imageUrl: finalImageUrl,
          videoUrl: finalVideoUrl,
          submitterName: submitterName.trim(),
          submitterPhone: phone,
          requestId: requestIdValue,
          createdAt,
        });
        const result = editingId
          ? await updateMemberOccasion(phone, Number(editingId), row)
          : await publishMemberOccasion(phone, row);
        if (!result?.ok) {
          const err = String(result?.error || '');
          throw new Error(
            err === 'not_registered'
              ? 'هذا الجوال غير مسجّل في العائلة.'
              : err === 'not_owner'
                ? 'لا يمكنك تعديل مناسبة ليست من مصدرك.'
                : 'تعذر النشر المباشر الآن. راجِع الإدارة إن استمر.',
          );
        }
        await rememberPushPhone(phone);
        registerPushToken('event_submit').catch(() => {});
        if (!editingId) {
          await notifyFamilyEventPublished({
            type: row.type,
            person: row.person,
            branch_key: row.branch_key,
            text: addText.trim(),
          });
        }
        resetAddForm();
        setSubmitStatus({
          kind: 'success',
          text: editingId ? 'حُفظ التعديل على المصدر.' : 'نُشرت المناسبة مباشرة في المجلس.',
        });
        onRetry();
        return;
      }

      const message = buildMobileEventRequestMessage({
        branch: addBranch,
        type: selectedType.key,
        typeLabel: selectedType.adminTypeLabel,
        person: addPerson.trim(),
        dateLabel: addDate.trim(),
        place: addPlace.trim(),
        placeKind: addPlaceKind,
        coords: addCoords.trim(),
        hospitalName: addPlace.trim(),
        hospitalDept: addHospitalDept.trim(),
        contactPhone,
        prayerPlace: addPrayerPlace.trim(),
        prayerTime: addPrayerTime.trim(),
        burialPlace: addBurialPlace.trim(),
        condolencePlace: addPlace.trim(),
        text: addText.trim(),
        imageUrl: finalImageUrl,
        videoUrl: finalVideoUrl,
        pickedImageName: pickedImage?.fileName || pickedImage?.uri.split('/').pop() || '',
        pickedVideoName: pickedVideo?.fileName || pickedVideo?.uri.split('/').pop() || '',
        submitterName: submitterName.trim(),
        submitterPhone: phone,
        requestId: requestIdValue,
        createdAt,
      });

      await insertPublicRow('approval_requests', {
        request_id: requestIdValue,
        kind: 'event_card',
        branch_key: addBranch,
        name: submitterName.trim(),
        phone,
        email: null,
        message,
        status: 'pending',
        created_at: createdAt,
      });
      await notifyAdminOfNewRequest({
        request_id: requestIdValue,
        kind: 'event_card',
        branch_key: addBranch,
        status: 'pending',
        name: submitterName.trim(),
        phone,
      });
      await notifyBranchDelegatesOfRequest({
        request_id: requestIdValue,
        kind: 'event_card',
        branch_key: addBranch,
        status: 'pending',
        name: submitterName.trim(),
        phone,
      });
      await rememberPushPhone(phone);
      registerPushToken('event_submit').catch(() => {});
      await appendTrackedRequest({
        requestId: requestIdValue,
        kind: 'event_card',
        status: 'pending',
        createdAt,
        person: addPerson.trim(),
        phone,
      });

      setAddPerson('');
      setAddDate('');
      setAddPlace('');
      setAddPlaceKind('');
      setAddCoords('');
      setAddHospitalDept('');
      setContactNational('');
      setAddPrayerPlace('');
      setAddPrayerTime('');
      setAddBurialPlace('');
      setAddImageUrl('');
      setAddVideoUrl('');
      setPickedImage(null);
      setPickedVideo(null);
      setAddText('');
      setSubmitStatus({
        kind: 'success',
        text: 'تم إرسال طلبك للمراجعة.',
      });
    } catch (error) {
      setSubmitStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر إرسال المناسبة.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SceneShell
      english="FAMILY OCCASIONS"
      eyebrow="مجلس العائلة"
      heroExtra={
        featuredEvent ? (
          <View style={styles.featured}>
            <Text style={styles.featuredPerson}>{featuredEvent.person || featuredEvent.title}</Text>
            <Text style={styles.featuredTitle}>
              {stripMarkdownNoise(featuredEvent.title) || featuredEvent.categoryLabel}
            </Text>
            {featuredEvent.date ? <Text style={styles.featuredDate}>{featuredEvent.date}</Text> : null}
          </View>
        ) : (
          <Text style={styles.featuredEmpty}>لا مناسبة ظاهرة في هذا التصنيف الآن.</Text>
        )
      }
      onRefresh={onRetry}
      refreshing={loading}
      subtitle="ما يظهر الآن في العائلة — مشهد حي لا قائمة إدارية."
      title="المناسبات"
      variant="occasion"
    >
      <View style={styles.filters}>
        {filters.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filter, active && styles.activeFilter]}
            >
              <Text style={[styles.filterText, active && styles.activeFilterText]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!loading && !error ? (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{events.length}</Text>
            <Text style={styles.summaryLabel}>كل المناسبات</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{happyCount}</Text>
            <Text style={styles.summaryLabel}>أفراح</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{healthCount}</Text>
            <Text style={styles.summaryLabel}>مرضى وخروج</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{condolenceCount}</Text>
            <Text style={styles.summaryLabel}>تعازي</Text>
          </View>
        </View>
      ) : null}

      <DataState
        empty={!visibleEvents.length}
        emptyText="لا توجد مناسبات في هذا التصنيف حاليًا."
        error={error}
        loading={loading}
        onRetry={onRetry}
      />

      {!loading && !error
        ? visibleEvents.map((event) => (
            <View
              key={event.id}
              style={[
                styles.eventCard,
                event.id === featuredEvent?.id && styles.eventStage,
                event.category === 'condolence' && styles.eventCardQuiet,
                event.category === 'happy' && styles.eventCardHappy,
                event.category === 'health' && styles.eventCardHealth,
              ]}
            >
              <View
                style={[styles.eventAccent, { backgroundColor: categoryColor[event.category] }]}
              />
              <View style={styles.eventBody}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <View style={styles.eventHeader}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: `${categoryColor[event.category]}18` },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: categoryColor[event.category] }]}>
                    {event.categoryLabel}
                  </Text>
                </View>
                {event.date ? <Text style={styles.date}>{event.date}</Text> : null}
              </View>
              {event.person ? <Text style={styles.person}>{event.person}</Text> : null}
              {event.imageUrl ? (
                <View style={styles.eventImageFrame}>
                  <Image
                    resizeMode="contain"
                    source={{ uri: event.imageUrl }}
                    style={styles.eventImage}
                  />
                </View>
              ) : null}
              {event.details ? (
                <Text numberOfLines={4} style={styles.details}>
                  {stripMarkdownNoise(event.details)}
                </Text>
              ) : null}
              {event.videoUrl ? <EventVideo uri={event.videoUrl} /> : null}
              {eventDetailRows(event).length ? (
                <View style={styles.detailGrid}>
                  {eventDetailRows(event).map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                      <Text style={styles.detailValue}>{row.value}</Text>
                      <Text style={styles.detailLabel}>{row.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {mapsUrlFromCoords(event.lat, event.lng) ? (
                <Pressable
                  onPress={() => Linking.openURL(mapsUrlFromCoords(event.lat, event.lng))}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                >
                  <Text style={styles.actionText}>الموقع على الخريطة</Text>
                </Pressable>
              ) : null}
              {occasionSocialEnabled && event.contactPhone ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(`tel:${canonicalizePhone(event.contactPhone ?? '') || event.contactPhone}`)
                    }
                    style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.actionText}>اتصال</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Linking.openURL(whatsappUrl(event.contactPhone ?? '', event))}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.secondaryAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.actionText, styles.secondaryActionText]}>واتساب</Text>
                  </Pressable>
                </View>
              ) : null}
              {event.branch ? <Text style={styles.branch}>{event.branch}</Text> : null}
              <OccasionInteractCard
                occasionId={Number(event.id)}
                eventType={String(event.type || '')}
                person={event.person}
              />
              {isOwnedEvent(event) ? (
                <View style={styles.ownerRow}>
                  <Pressable
                    onPress={() => startEditEvent(event)}
                    style={({ pressed }) => [styles.ownerBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.ownerBtnText}>تعديل المصدر</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDeleteEvent(event)}
                    style={({ pressed }) => [styles.ownerBtn, styles.ownerBtnDanger, pressed && styles.pressed]}
                  >
                    <Text style={[styles.ownerBtnText, styles.ownerBtnDangerText]}>حذف</Text>
                  </Pressable>
                </View>
              ) : null}
              </View>
            </View>
          ))
        : null}
      {occasionSocialEnabled ? (
      <SectionCard
        eyebrow="إضافة"
        title={
          selectedType.family === 'death'
            ? 'إعلان وفاة'
            : selectedType.family === 'health'
              ? 'حالة صحية'
              : 'إضافة مناسبة'
        }
      >
        <Pressable
          onPress={() => setAddOpen((current) => !current)}
          style={({ pressed }) => [styles.addToggle, pressed && styles.pressed]}
        >
          <Text style={styles.addToggleText}>
            {addOpen ? 'إغلاق النموذج' : 'فتح نموذج الإضافة حسب النوع'}
          </Text>
          <Text style={styles.addToggleIcon}>{addOpen ? '−' : '+'}</Text>
        </Pressable>

        {addOpen ? (
          <>
            <Text style={styles.fieldLabel}>الفرع</Text>
            <Text style={styles.addHint}>اختر فرع صاحب المناسبة.</Text>
            <View style={styles.branchPicker}>
              {branches.map((item) => {
                const active = item.id === addBranch;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setAddBranch(item.id)}
                    style={[styles.formChip, active && styles.activeFormChip]}
                  >
                    <Text style={[styles.formChipText, active && styles.activeFormChipText]}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>العائلة</Text>
            <View style={styles.branchPicker}>
              {MOBILE_EVENT_FAMILIES.map((item) => {
                const active = item.key === addFamily;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setAddFamily(item.key);
                      const next = listMobileEventTypesByFamily(item.key)[0];
                      if (next) setAddType(next.key);
                    }}
                    style={[styles.formChip, active && styles.activeFormChip]}
                  >
                    <Text style={[styles.formChipText, active && styles.activeFormChipText]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>النوع</Text>
            <View style={styles.branchPicker}>
              {typesForFamily.map((item) => {
                const active = item.key === addType;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setAddType(item.key)}
                    style={[styles.formChip, active && styles.activeFormChip]}
                  >
                    <Text style={[styles.formChipText, active && styles.activeFormChipText]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              onChangeText={setAddPerson}
              placeholder={selectedType.personLabel}
              placeholderTextColor={p.textMuted}
              style={styles.input}
              textAlign="right"
              value={addPerson}
            />
            <TextInput
              onChangeText={setAddDate}
              placeholder={
                selectedType.key === 'birth'
                  ? 'تاريخ الولادة اختياري — مثال: 2026-08-25'
                  : selectedType.family === 'death'
                    ? 'تاريخ الوفاة (اختياري) — مثال: 2026-08-12'
                    : selectedType.family === 'health'
                      ? 'تاريخ الحالة (اختياري) — مثال: 2026-08-12'
                      : selectedType.family === 'news'
                        ? 'تاريخ الخبر اختياري — مثال: 2026-08-25'
                        : selectedType.requiresDate
                          ? 'تاريخ المناسبة — مثال: 2026-08-12'
                          : 'التاريخ اختياري'
              }
              placeholderTextColor={p.textMuted}
              style={styles.input}
              textAlign="right"
              value={addDate}
            />
            {selectedType.family === 'health' ? (
              <>
                <TextInput
                  onChangeText={setAddPlace}
                  placeholder="المستشفى / المكان اختياري"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addPlace}
                />
                <TextInput
                  onChangeText={setAddHospitalDept}
                  placeholder="القسم اختياري"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addHospitalDept}
                />
                <PhoneField
                  label="جوال للتواصل (اختياري)"
                  countryId={contactCountryId}
                  national={contactNational}
                  onCountryChange={setContactCountryId}
                  onNationalChange={setContactNational}
                />
              </>
            ) : null}
            {selectedType.family === 'death' ? (
              <>
                <TextInput
                  onChangeText={setAddPlace}
                  placeholder="موقع العزاء اختياري"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addPlace}
                />
                <TextInput
                  onChangeText={setAddPrayerPlace}
                  placeholder="مكان الصلاة اختياري"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addPrayerPlace}
                />
                <TextInput
                  onChangeText={setAddPrayerTime}
                  placeholder="وقت الصلاة اختياري"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addPrayerTime}
                />
                <TextInput
                  onChangeText={setAddBurialPlace}
                  placeholder="مكان الدفن اختياري"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addBurialPlace}
                />
              </>
            ) : null}
            {allowsMedia ? (
              <>
                {selectedType.family === 'occasion' ? (
                  <>
                    <Text style={styles.fieldLabel}>الموقع</Text>
                    <View style={styles.branchPicker}>
                      {EVENT_PLACE_KINDS.map((item) => {
                        const active = item.key === addPlaceKind;
                        return (
                          <Pressable
                            key={item.key}
                            onPress={() => setAddPlaceKind(active ? '' : item.key)}
                            style={[styles.formChip, active && styles.activeFormChip]}
                          >
                            <Text style={[styles.formChipText, active && styles.activeFormChipText]}>
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                    onChangeText={setAddPlace}
                    placeholder={
                      selectedType.requiresPlace && !selectedType.requiresPlaceKind
                        ? 'اسم الموقع (مطلوب)'
                        : 'اسم الموقع اختياري'
                    }
                    placeholderTextColor={p.textMuted}
                    style={styles.input}
                    textAlign="right"
                    value={addPlace}
                  />
                    <TextInput
                      onChangeText={setAddCoords}
                      placeholder="إحداثيات اختيارية — 24.7136, 46.6753"
                      placeholderTextColor={p.textMuted}
                      style={styles.input}
                      textAlign="right"
                      value={addCoords}
                    />
                  </>
                ) : null}
                <TextInput
                  onChangeText={setAddImageUrl}
                  placeholder="رابط صورة اختياري أو اختر من الجهاز"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addImageUrl}
                />
                <View style={styles.mediaActions}>
                  <Pressable
                    onPress={() => pickMedia('image')}
                    disabled={Boolean(pickingMedia)}
                    style={({ pressed }) => [
                      styles.mediaButton,
                      pickingMedia && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.mediaButtonText}>
                      {pickingMedia === 'image' ? 'جاري الفتح...' : 'اختيار صورة'}
                    </Text>
                  </Pressable>
                  {pickedImage ? (
                    <>
                      <Text numberOfLines={1} style={styles.mediaName}>
                        {pickedImage.fileName || 'تم اختيار صورة'}
                      </Text>
                      <Pressable onPress={() => setPickedImage(null)} style={styles.removeMediaButton}>
                        <Text style={styles.removeMediaText}>إزالة</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
                <TextInput
                  onChangeText={setAddVideoUrl}
                  placeholder="رابط فيديو اختياري أو اختر من الجهاز"
                  placeholderTextColor={p.textMuted}
                  style={styles.input}
                  textAlign="right"
                  value={addVideoUrl}
                />
                <View style={styles.mediaActions}>
                  <Pressable
                    onPress={() => pickMedia('video')}
                    disabled={Boolean(pickingMedia)}
                    style={({ pressed }) => [
                      styles.mediaButton,
                      pickingMedia && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.mediaButtonText}>
                      {pickingMedia === 'video' ? 'جاري الفتح...' : 'اختيار فيديو'}
                    </Text>
                  </Pressable>
                  {pickedVideo ? (
                    <>
                      <Text numberOfLines={1} style={styles.mediaName}>
                        {pickedVideo.fileName || 'تم اختيار فيديو'}
                      </Text>
                      <Pressable onPress={() => setPickedVideo(null)} style={styles.removeMediaButton}>
                        <Text style={styles.removeMediaText}>إزالة</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </>
            ) : null}
            <TextInput
              multiline
              onChangeText={setAddText}
              placeholder={
                allowsMedia
                  ? selectedType.mode === 'notice'
                    ? 'نص التهنئة أو الخبر'
                    : 'نص المناسبة'
                  : 'ملاحظات اختياري'
              }
              placeholderTextColor={p.textMuted}
              style={[styles.input, styles.textArea]}
              textAlign="right"
              value={addText}
            />
            <Text style={styles.addHint}>
              {editingId
                ? 'تحفظ التعديل على المصدر نفسه.'
                : sessionPhone
                  ? `المسجّل بجواله ينشر مباشرة في مناسبات فرع ${addBranch || 'العائلة'}.`
                  : 'غير المسجّل يُرسل الطلب للإدارة للمراجعة.'}
            </Text>
            <View style={styles.submitterCol}>
              <TextInput
                onChangeText={setSubmitterName}
                placeholder="اسم المرسل"
                placeholderTextColor={p.textMuted}
                style={styles.input}
                textAlign="right"
                value={submitterName}
              />
              <PhoneField
                countryId={phoneCountryId}
                national={phoneNational}
                onCountryChange={setPhoneCountryId}
                onNationalChange={setPhoneNational}
                hint="اختر الدولة ثم اكتب الرقم المحلي فقط."
              />
            </View>
            <ActionButton
              label={
                submitting
                  ? editingId
                    ? 'جاري الحفظ...'
                    : 'جاري النشر...'
                  : editingId
                    ? 'حفظ التعديل'
                    : selectedType.family === 'death'
                      ? sessionPhone
                        ? 'نشر إعلان الوفاة'
                        : 'إرسال إعلان الوفاة'
                      : selectedType.family === 'health'
                        ? sessionPhone
                          ? 'نشر الحالة الصحية'
                          : 'إرسال الحالة الصحية'
                        : selectedType.mode === 'notice'
                          ? sessionPhone
                            ? 'نشر التهنئة / الخبر'
                            : 'إرسال التهنئة / الخبر'
                          : sessionPhone
                            ? 'نشر المناسبة'
                            : 'إرسال المناسبة'
              }
              onPress={submitEventRequest}
            />
          </>
        ) : (
          <Text style={styles.addHint}>
            اختر النوع: تهنئة/خبر (بدون موعد حفل)، مناسبة أو دعوة، حالة صحية، أو وفاة.
          </Text>
        )}

        {submitStatus.text ? (
          <View
            style={[
              styles.submitStatus,
              submitStatus.kind === 'error' ? styles.errorStatus : styles.successStatus,
            ]}
          >
            <Text style={styles.submitStatusText}>{submitStatus.text}</Text>
          </View>
        ) : null}
      </SectionCard>
      ) : null}
    </SceneShell>
  );
}

function eventsStyles(p: ThemePalette) {
  return {
  filters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filter: {
    backgroundColor: 'transparent',
    borderColor: p.gold,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeFilter: {
    backgroundColor: p.green,
    borderColor: p.green,
  },
  filterText: {
    color: p.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  activeFilterText: {
    color: p.white,
  },
  summary: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
  },
  summaryItem: {
    alignItems: 'center',
    backgroundColor: p.creamLift,
    borderColor: 'rgba(196,163,90,0.4)',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  summaryNumber: {
    color: p.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
  },
  summaryLabel: {
    color: p.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  branchPicker: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  addToggle: {
    alignItems: 'center',
    backgroundColor: p.primarySoft,
    borderColor: p.primary,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  addToggleText: {
    color: p.primaryDark,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  addToggleIcon: {
    color: p.primary,
    fontSize: 24,
    fontWeight: '900',
    width: 28,
  },
  addHint: {
    color: p.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldLabel: {
    color: p.text,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  formChip: {
    backgroundColor: p.surface,
    borderColor: p.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeFormChip: {
    backgroundColor: p.primary,
    borderColor: p.primary,
  },
  formChipText: {
    color: p.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  activeFormChipText: {
    color: p.white,
  },
  input: {
    backgroundColor: p.surfaceMuted,
    borderColor: p.border,
    borderRadius: 15,
    borderWidth: 1,
    color: p.text,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  mediaActions: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  mediaButton: {
    alignItems: 'center',
    backgroundColor: p.primarySoft,
    borderColor: p.primary,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  mediaButtonText: {
    color: p.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  disabledButton: {
    opacity: 0.55,
  },
  mediaName: {
    color: p.textMuted,
    flex: 1,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  removeMediaButton: {
    alignItems: 'center',
    borderColor: p.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  removeMediaText: {
    color: p.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  submitterCol: {
    gap: spacing.sm,
  },
  submitterRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  submitterInput: {
    flex: 1,
  },
  submitStatus: {
    borderRadius: 14,
    padding: spacing.sm,
  },
  successStatus: {
    backgroundColor: p.primarySoft,
  },
  errorStatus: {
    backgroundColor: '#F7D7D7',
  },
  submitStatusText: {
    color: p.text,
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventCard: {
    backgroundColor: p.creamLift,
    borderColor: 'rgba(196,163,90,0.4)',
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    overflow: 'hidden',
  },
  eventStage: {
    borderColor: p.gold,
    borderWidth: 2,
  },
  eventCardHappy: {
    backgroundColor: '#F7EED8',
  },
  eventCardHealth: {
    backgroundColor: '#F6FAFC',
  },
  eventCardQuiet: {
    backgroundColor: '#F7F7F8',
  },
  eventAccent: {
    width: 5,
  },
  eventBody: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  eventTitle: {
    color: p.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  date: {
    color: p.textMuted,
    fontSize: typography.caption,
    writingDirection: 'rtl',
  },
  person: {
    color: p.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventImageFrame: {
    backgroundColor: p.surfaceMuted,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: 1,
  },
  eventImage: {
    height: '100%',
    width: '100%',
  },
  details: {
    color: p.text,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventVideo: {
    backgroundColor: p.surfaceMuted,
    borderRadius: 16,
    height: 240,
    overflow: 'hidden',
    width: '100%',
  },
  branch: {
    color: p.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailGrid: {
    backgroundColor: p.surfaceMuted,
    borderRadius: 16,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: p.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    minWidth: 82,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailValue: {
    color: p.text,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: p.primary,
    borderRadius: 14,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  secondaryAction: {
    backgroundColor: p.primarySoft,
    borderColor: p.primary,
    borderWidth: 1,
  },
  actionText: {
    color: p.white,
    fontSize: typography.caption,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  secondaryActionText: {
    color: p.primaryDark,
  },
  ownerRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: 4,
  },
  ownerBtn: {
    alignItems: 'center',
    borderColor: p.gold,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  ownerBtnText: {
    color: p.primaryDark,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  ownerBtnDanger: {
    borderColor: 'rgba(153,27,27,0.45)',
  },
  ownerBtnDangerText: {
    color: '#991b1b',
  },
  pressed: {
    opacity: 0.72,
  },
  featured: {
    alignItems: 'flex-end',
    gap: 6,
    paddingBottom: spacing.sm,
  },
  featuredPerson: {
    color: p.creamLift,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 42,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  featuredTitle: {
    color: p.gold,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  featuredDate: {
    color: p.goldSoft,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  featuredEmpty: {
    color: p.goldSoft,
    fontSize: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  };
}
