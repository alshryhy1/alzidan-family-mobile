import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { SectionCard } from './SectionCard';
import {
  prepareImagePickerAsset,
  submitMemoryItem,
  type MemoryPickedFile,
  type MemoryUiKind,
} from '../services/memorySubmit';
import { colors, spacing, typography } from '../theme';
import type { Branch } from '../types';

const memoryTypes = [
  { key: 'image', label: 'صورة' },
  { key: 'video', label: 'فيديو' },
  { key: 'audio', label: 'صوت' },
  { key: 'story', label: 'قصة' },
  { key: 'document', label: 'وثيقة' },
] as const;

type MemorySubmitPanelProps = {
  branches: Branch[];
  defaultBranch?: string;
};

function normalizeDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
}

function cleanPhone(value: string) {
  return normalizeDigits(value).replace(/[^\d]/g, '');
}

export function MemorySubmitPanel({ branches, defaultBranch }: MemorySubmitPanelProps) {
  const [branch, setBranch] = useState(defaultBranch ?? branches[0]?.id ?? 'زيدان');
  const [memoryType, setMemoryType] = useState<(typeof memoryTypes)[number]['key']>('image');
  const [memoryPerson, setMemoryPerson] = useState('');
  const [memoryLineage, setMemoryLineage] = useState('');
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryDescription, setMemoryDescription] = useState('');
  const [memoryStory, setMemoryStory] = useState('');
  const [memoryDate, setMemoryDate] = useState('');
  const [memoryYear, setMemoryYear] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickedMemoryFile, setPickedMemoryFile] = useState<MemoryPickedFile | null>(null);
  const [pickingMemoryFile, setPickingMemoryFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const pickMemoryFile = async () => {
    if (pickingMemoryFile || memoryType === 'story') return;
    setPickingMemoryFile(true);
    setStatus(null);
    try {
      if (memoryType === 'image' || memoryType === 'video') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setStatus({ kind: 'error', text: 'فعّل صلاحية الوصول للصور/الفيديو.' });
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: memoryType === 'image' ? ['images'] : ['videos'],
          quality: 0.85,
        });
        if (result.canceled || !result.assets?.length) return;
        const asset = await prepareImagePickerAsset(result.assets[0], memoryType);
        setPickedMemoryFile(asset);
        setStatus({
          kind: 'success',
          text: memoryType === 'image' ? 'تم اختيار الصورة.' : 'تم اختيار الفيديو.',
        });
        return;
      }

      let DocumentPicker;
      try {
        DocumentPicker = await import('expo-document-picker');
      } catch {
        setStatus({
          kind: 'error',
          text: 'اختيار الملفات غير متاح في هذا البناء. أعد بناء التطبيق: npx expo run:ios',
        });
        return;
      }
      const doc = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type:
          memoryType === 'audio'
            ? ['audio/*', 'audio/mpeg', 'audio/mp4']
            : ['application/pdf', 'application/msword', 'com.adobe.pdf'],
      });
      if (doc.canceled || !doc.assets?.length) return;
      const asset = doc.assets[0];
      setPickedMemoryFile({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.name,
        kind: memoryType as MemoryUiKind,
      });
      setStatus({ kind: 'success', text: 'تم اختيار الملف.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر اختيار الملف.',
      });
    } finally {
      setPickingMemoryFile(false);
    }
  };

  const submitMemory = async () => {
    setStatus(null);
    if (!submitterName.trim()) {
      setStatus({ kind: 'error', text: 'اكتب اسم المرسل.' });
      return;
    }
    if (cleanPhone(phone).length < 9) {
      setStatus({ kind: 'error', text: 'اكتب رقم جوال صحيح (9 أرقام على الأقل).' });
      return;
    }

    setSubmitting(true);
    try {
      await submitMemoryItem({
        branchKey: branch,
        uiKind: memoryType,
        personName: memoryPerson.trim(),
        personLineage: memoryLineage.trim(),
        title: memoryTitle.trim(),
        description: memoryDescription.trim(),
        storyText: memoryStory.trim(),
        memoryDate: memoryDate.trim(),
        memoryYear: memoryYear.trim(),
        pickedFile: pickedMemoryFile,
        submittedByName: submitterName.trim(),
        submittedByPhone: cleanPhone(phone),
        submittedByRelation: 'تطبيق الجوال',
      });

      setMemoryPerson('');
      setMemoryLineage('');
      setMemoryTitle('');
      setMemoryDescription('');
      setMemoryStory('');
      setMemoryDate('');
      setMemoryYear('');
      setPickedMemoryFile(null);
      setStatus({ kind: 'success', text: 'تم رفع الذكرى للمراجعة قبل النشر.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر إرسال الذكرى.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SectionCard eyebrow="من الذاكرة" title="أرسل ذكرى للعائلة">
        <Text style={styles.hint}>تُراجع الذكريات من الإدارة قبل النشر في الأرشيف.</Text>

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

        <View style={styles.branchPicker}>
          {memoryTypes.map((item) => {
            const active = item.key === memoryType;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMemoryType(item.key);
                  setPickedMemoryFile(null);
                }}
                style={[styles.chip, active && styles.activeChip]}
              >
                <Text style={[styles.chipText, active && styles.activeChipText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          onChangeText={setSubmitterName}
          placeholder="اسم المرسل *"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={submitterName}
        />
        <TextInput
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="جوال المرسل * (عربي أو إنجليزي)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={phone}
        />
        <TextInput
          onChangeText={setMemoryPerson}
          placeholder="اسم الشخص المرتبط بالذكرى *"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={memoryPerson}
        />
        <TextInput
          onChangeText={setMemoryLineage}
          placeholder="النسب/المسار (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={memoryLineage}
        />
        <TextInput
          onChangeText={setMemoryTitle}
          placeholder="عنوان الذكرى *"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={memoryTitle}
        />
        <TextInput
          multiline
          onChangeText={setMemoryDescription}
          placeholder="وصف مختصر (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.textArea]}
          textAlign="right"
          value={memoryDescription}
        />
        {memoryType === 'story' ? (
          <TextInput
            multiline
            onChangeText={setMemoryStory}
            placeholder="نص القصة *"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textArea]}
            textAlign="right"
            value={memoryStory}
          />
        ) : null}
        <TextInput
          onChangeText={setMemoryDate}
          placeholder="تاريخ/وصف زمني (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={memoryDate}
        />
        <TextInput
          onChangeText={setMemoryYear}
          placeholder="السنة (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={memoryYear}
        />
        {memoryType !== 'story' ? (
          <>
            <ActionButton
              label={
                pickingMemoryFile
                  ? 'جاري فتح الملفات...'
                  : memoryType === 'image'
                    ? 'اختيار صورة'
                    : memoryType === 'video'
                      ? 'اختيار فيديو'
                      : memoryType === 'audio'
                        ? 'اختيار ملف صوت'
                        : 'اختيار وثيقة'
              }
              onPress={pickMemoryFile}
            />
            <Text style={styles.fileHint}>
              {pickedMemoryFile?.fileName
                ? `تم اختيار: ${pickedMemoryFile.fileName}`
                : 'لم يُختَر ملف بعد — الرفع إلزامي لهذا النوع.'}
            </Text>
          </>
        ) : null}
        <ActionButton label={submitting ? 'جاري الرفع...' : 'إرسال الذكرى'} onPress={submitMemory} />
      </SectionCard>

      {status ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    marginBottom: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  branchPicker: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
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
    marginBottom: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  fileHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginBottom: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  status: {
    borderRadius: 16,
    marginTop: spacing.sm,
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
