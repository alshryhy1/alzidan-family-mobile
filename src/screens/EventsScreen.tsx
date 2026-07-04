import { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { DataState } from '../components/DataState';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { insertPublicRow, uploadPublicFileUri } from '../services/supabase';
import { colors, spacing, typography } from '../theme';
import type { Branch, FamilyEvent } from '../types';

type Filter = 'all' | FamilyEvent['category'];

type EventsScreenProps = {
  branches: Branch[];
  error: string | null;
  events: FamilyEvent[];
  loading: boolean;
  onRetry: () => void;
};

const filters: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'happy', label: 'الأفراح' },
  { key: 'health', label: 'المرضى' },
  { key: 'condolence', label: 'التعازي' },
];

const categoryColor: Record<FamilyEvent['category'], string> = {
  happy: colors.happy,
  health: colors.health,
  condolence: colors.condolence,
};

const eventTypes = [
  { key: 'birth', label: 'عقيقة مولود' },
  { key: 'marriage', label: 'زواج' },
  { key: 'graduation', label: 'حفل تخرج' },
  { key: 'promotion', label: 'حفل ترقية' },
  { key: 'new_house', label: 'منزل جديد' },
  { key: 'gathering', label: 'اجتماع عائلي' },
  { key: 'general', label: 'مناسبة عامة' },
];

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

function buildEventRequestMessage(payload: {
  branch: string;
  dateLabel: string;
  imageUrl: string;
  pickedImageName: string;
  pickedVideoName: string;
  person: string;
  phone: string;
  submitterName: string;
  text: string;
  typeLabel: string;
  videoUrl: string;
}) {
  return [
    'طلب إضافة مناسبة من تطبيق عائلة الزيدان',
    `الفرع: ${payload.branch}`,
    `النوع: ${payload.typeLabel}`,
    `صاحب المناسبة: ${payload.person}`,
    payload.dateLabel ? `التاريخ: ${payload.dateLabel}` : '',
    payload.imageUrl ? `رابط الصورة: ${payload.imageUrl}` : '',
    payload.videoUrl ? `رابط الفيديو: ${payload.videoUrl}` : '',
    payload.pickedImageName ? `صورة مختارة من التطبيق: ${payload.pickedImageName}` : '',
    payload.pickedVideoName ? `فيديو مختار من التطبيق: ${payload.pickedVideoName}` : '',
    `النص: ${payload.text}`,
    `المرسل: ${payload.submitterName}`,
    `الجوال: ${payload.phone}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeSaudiPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('0')) return `+966${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('5')) return `+966${digits}`;
  return `+${digits}`;
}

function whatsappUrl(phone: string, event: FamilyEvent) {
  const normalized = normalizeSaudiPhone(phone).replace('+', '');
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
  if (event.visitTimeFrom && event.visitTimeTo) return `من ${event.visitTimeFrom} إلى ${event.visitTimeTo}`;
  return event.visitTimeFrom || event.visitTimeTo || '';
}

function eventDetailRows(event: FamilyEvent) {
  return [
    event.hospitalName ? { label: 'المستشفى', value: event.hospitalName } : null,
    event.hospitalDepartment ? { label: 'القسم', value: event.hospitalDepartment } : null,
    visitDateRange(event) ? { label: 'تاريخ الزيارة', value: visitDateRange(event) } : null,
    visitTimeRange(event) ? { label: 'وقت الزيارة', value: visitTimeRange(event) } : null,
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

function EventVideo({ uri }: { uri: string }) {
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

export function EventsScreen({ branches, error, events, loading, onRetry }: EventsScreenProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addBranch, setAddBranch] = useState(branches[0]?.id ?? 'زيدان');
  const [addType, setAddType] = useState(eventTypes[0].key);
  const [addPerson, setAddPerson] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addImageUrl, setAddImageUrl] = useState('');
  const [addVideoUrl, setAddVideoUrl] = useState('');
  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickedVideo, setPickedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [addText, setAddText] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterPhone, setSubmitterPhone] = useState('');
  const [submitStatus, setSubmitStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [pickingMedia, setPickingMedia] = useState<'image' | 'video' | null>(null);
  const visibleEvents = filter === 'all' ? events : events.filter((event) => event.category === filter);
  const happyCount = events.filter((event) => event.category === 'happy').length;
  const healthCount = events.filter((event) => event.category === 'health').length;
  const condolenceCount = events.filter((event) => event.category === 'condolence').length;
  const selectedType = eventTypes.find((item) => item.key === addType) ?? eventTypes[0];

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

  const submitEventRequest = async () => {
    const phone = cleanPhone(submitterPhone);
    if (!submitterName.trim() || phone.length < 9) {
      setSubmitStatus({ kind: 'error', text: 'اكتب اسم المرسل ورقم جوال صحيح.' });
      return;
    }
    if (!addPerson.trim() || !addText.trim()) {
      setSubmitStatus({ kind: 'error', text: 'اكتب صاحب المناسبة ونص المناسبة.' });
      return;
    }
    if (addImageUrl.trim() && !/^https?:\/\//i.test(addImageUrl.trim())) {
      setSubmitStatus({ kind: 'error', text: 'رابط الصورة يجب أن يبدأ بـ http أو https.' });
      return;
    }
    if (addVideoUrl.trim() && !/^https?:\/\//i.test(addVideoUrl.trim())) {
      setSubmitStatus({ kind: 'error', text: 'رابط الفيديو يجب أن يبدأ بـ http أو https.' });
      return;
    }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const requestIdValue = requestId();
      const uploadedImageUrl = pickedImage
        ? await uploadPickedAsset(pickedImage, requestIdValue, 'image')
        : '';
      const uploadedVideoUrl = pickedVideo
        ? await uploadPickedAsset(pickedVideo, requestIdValue, 'video')
        : '';
      const finalImageUrl = uploadedImageUrl || addImageUrl.trim();
      const finalVideoUrl = uploadedVideoUrl || addVideoUrl.trim();
      const message = buildEventRequestMessage({
        branch: addBranch,
        dateLabel: addDate.trim(),
        imageUrl: finalImageUrl,
        pickedImageName: pickedImage?.fileName || pickedImage?.uri.split('/').pop() || '',
        pickedVideoName: pickedVideo?.fileName || pickedVideo?.uri.split('/').pop() || '',
        person: addPerson.trim(),
        phone,
        submitterName: submitterName.trim(),
        text: addText.trim(),
        typeLabel: selectedType.label,
        videoUrl: finalVideoUrl,
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

      setAddPerson('');
      setAddDate('');
      setAddImageUrl('');
      setAddVideoUrl('');
      setPickedImage(null);
      setPickedVideo(null);
      setAddText('');
      setSubmitStatus({ kind: 'success', text: 'تم إرسال المناسبة للمراجعة.' });
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
    <Screen
      title="المناسبات"
      description="أخبار العائلة المسجلة، للقراءة فقط."
      onRefresh={onRetry}
      refreshing={loading}
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
            <Text style={styles.summaryLabel}>مرضى</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{condolenceCount}</Text>
            <Text style={styles.summaryLabel}>تعازي</Text>
          </View>
        </View>
      ) : null}

      <SectionCard eyebrow="إضافة" title="إضافة مناسبة">
        <Pressable
          onPress={() => setAddOpen((current) => !current)}
          style={({ pressed }) => [styles.addToggle, pressed && styles.pressed]}
        >
          <Text style={styles.addToggleText}>
            {addOpen ? 'إغلاق نموذج الإضافة' : 'فتح نموذج إضافة مناسبة'}
          </Text>
          <Text style={styles.addToggleIcon}>{addOpen ? '−' : '+'}</Text>
        </Pressable>

        {addOpen ? (
          <>
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
            <View style={styles.branchPicker}>
              {eventTypes.map((item) => {
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
              placeholder="اسم صاحب المناسبة"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={addPerson}
            />
            <TextInput
              onChangeText={setAddDate}
              placeholder="التاريخ اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={addDate}
            />
            <TextInput
              onChangeText={setAddImageUrl}
              placeholder="رابط صورة اختياري أو اختر من الجهاز"
              placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
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
            <TextInput
              multiline
              onChangeText={setAddText}
              placeholder="نص المناسبة"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.textArea]}
              textAlign="right"
              value={addText}
            />
            <View style={styles.submitterRow}>
              <TextInput
                onChangeText={setSubmitterName}
                placeholder="اسم المرسل"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.submitterInput]}
                textAlign="right"
                value={submitterName}
              />
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setSubmitterPhone}
                placeholder="الجوال"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.submitterInput]}
                textAlign="right"
                value={submitterPhone}
              />
            </View>
            <ActionButton
              label={submitting ? 'جاري الإرسال...' : 'إرسال المناسبة'}
              onPress={submitEventRequest}
            />
          </>
        ) : (
          <Text style={styles.addHint}>
            أرسل مناسبة جديدة للإدارة والمناديب، ويمكنك إرفاق رابط صورة أو فيديو اختياري.
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

      <DataState
        empty={!visibleEvents.length}
        emptyText="لا توجد مناسبات في هذا التصنيف حاليًا."
        error={error}
        loading={loading}
        onRetry={onRetry}
      />

      {!loading && !error
        ? visibleEvents.map((event) => (
            <SectionCard key={event.id} title={event.title}>
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
                <Text style={styles.date}>{event.date || 'دون تاريخ'}</Text>
              </View>
              <Text style={styles.person}>{event.person}</Text>
              {event.imageUrl ? (
                <Image
                  resizeMode="cover"
                  source={{ uri: event.imageUrl }}
                  style={styles.eventImage}
                />
              ) : null}
              {event.details ? <Text style={styles.details}>{event.details}</Text> : null}
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
              {event.contactPhone ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${normalizeSaudiPhone(event.contactPhone ?? '')}`)}
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
              <Text style={styles.branch}>{event.branch}</Text>
            </SectionCard>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeFilter: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  activeFilterText: {
    color: colors.white,
  },
  summary: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
  },
  summaryItem: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  summaryNumber: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '900',
  },
  summaryLabel: {
    color: colors.textMuted,
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
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  addToggleText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  addToggleIcon: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
    width: 28,
  },
  addHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  formChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeFormChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  formChipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  activeFormChipText: {
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
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  mediaButtonText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  disabledButton: {
    opacity: 0.55,
  },
  mediaName: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  removeMediaButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  removeMediaText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
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
    backgroundColor: colors.primarySoft,
  },
  errorStatus: {
    backgroundColor: '#F7D7D7',
  },
  submitStatusText: {
    color: colors.text,
    fontSize: typography.caption,
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
    color: colors.textMuted,
    fontSize: typography.caption,
    writingDirection: 'rtl',
  },
  person: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventImage: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    height: 210,
    width: '100%',
  },
  details: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eventVideo: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    height: 240,
    overflow: 'hidden',
    width: '100%',
  },
  branch: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailGrid: {
    backgroundColor: colors.surfaceMuted,
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
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    minWidth: 82,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailValue: {
    color: colors.text,
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
    backgroundColor: colors.primary,
    borderRadius: 14,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  secondaryAction: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  actionText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  secondaryActionText: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.72,
  },
});
