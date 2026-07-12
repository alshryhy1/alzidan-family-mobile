import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

import { uploadPublicFileUri } from './supabase';

export type MemoryUiKind = 'image' | 'video' | 'audio' | 'story' | 'document';

export type MemoryPickedFile = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  kind: MemoryUiKind;
};

const KIND_MAP: Record<MemoryUiKind, string> = {
  image: 'general',
  video: 'video',
  audio: 'audio',
  story: 'story',
  document: 'document',
};

const MEMORY_MEDIA_MAX_BYTES = 50 * 1024 * 1024;

export type MemorySubmitInput = {
  branchKey: string;
  uiKind: MemoryUiKind;
  personName: string;
  personLineage?: string;
  title: string;
  description?: string;
  storyText?: string;
  memoryDate?: string;
  memoryYear?: string;
  pickedFile?: MemoryPickedFile | null;
  submittedByName: string;
  submittedByPhone: string;
  submittedByRelation?: string;
};

function cleanText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
}

function cleanPhone(value: string) {
  return normalizeDigits(value).replace(/[^\d]/g, '');
}

function requiresFile(kind: MemoryUiKind) {
  return kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'document';
}

function mediaDbType(kind: MemoryUiKind) {
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'audio';
  if (kind === 'document') return 'document';
  return 'image';
}

function memoryRequestId() {
  return `MEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function extensionFromName(name: string, fallback: string) {
  const base = String(name || '').trim();
  const idx = base.lastIndexOf('.');
  if (idx < 0) return fallback;
  const ext = base.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || fallback;
}

function defaultExt(kind: MemoryUiKind) {
  if (kind === 'video') return 'mp4';
  if (kind === 'audio') return 'm4a';
  if (kind === 'document') return 'pdf';
  return 'jpg';
}

function defaultMime(kind: MemoryUiKind) {
  if (kind === 'video') return 'video/mp4';
  if (kind === 'audio') return 'audio/mp4';
  if (kind === 'document') return 'application/pdf';
  return 'image/jpeg';
}

export function validateMemorySubmit(input: MemorySubmitInput) {
  if (!cleanText(input.branchKey)) return 'اختر الفرع.';
  if (!cleanText(input.personName)) return 'اسم الشخص مطلوب.';
  if (!cleanText(input.title)) return 'عنوان الذكرى مطلوب.';
  if (!cleanText(input.submittedByName)) return 'اسم المرسل مطلوب.';
  if (cleanPhone(input.submittedByPhone).length < 9) return 'رقم جوال صحيح مطلوب (9 أرقام على الأقل).';
  if (input.uiKind === 'story' && !cleanText(input.storyText ?? '')) return 'نص القصة مطلوب.';
  if (requiresFile(input.uiKind) && !input.pickedFile) {
    if (input.uiKind === 'image') return 'اختر صورة للرفع.';
    if (input.uiKind === 'video') return 'اختر فيديو للرفع.';
    if (input.uiKind === 'audio') return 'اختر ملف صوت للرفع.';
    if (input.uiKind === 'document') return 'اختر وثيقة للرفع.';
  }
  return '';
}

export async function uploadMemoryPickedFile(picked: MemoryPickedFile, requestId = memoryRequestId()) {
  let uploadUri = picked.uri;
  let contentType = picked.mimeType || defaultMime(picked.kind);
  let ext = extensionFromName(picked.fileName || '', defaultExt(picked.kind));

  if (picked.kind === 'image') {
    const converted = await ImageManipulator.manipulateAsync(picked.uri, [], {
      compress: 0.86,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    uploadUri = converted.uri;
    contentType = 'image/jpeg';
    ext = 'jpg';
  }

  const path = `memory-pending/${requestId}/${picked.kind}-${Date.now()}.${ext}`;
  return uploadPublicFileUri('event-media', path, uploadUri, contentType);
}

export async function prepareImagePickerAsset(
  asset: ImagePickerAsset,
  kind: 'image' | 'video',
): Promise<MemoryPickedFile> {
  return {
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    kind,
  };
}

async function callMemorySubmitRpc(item: Record<string, unknown>, media: Record<string, unknown>[]) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعداد اتصال Supabase غير مكتمل.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/memory_submit_item_v1`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_item: item, p_media: media }),
  });

  if (!response.ok) {
    const message = await response.text();
    if (response.status === 404 || message.includes('memory_submit_item_v1')) {
      throw new Error('نفّذ family_memory_delegate_fix.sql على Supabase ثم أعد المحاولة.');
    }
    throw new Error(message || `تعذر إرسال الذكرى (${response.status}).`);
  }

  return response.json() as Promise<string | number>;
}

export async function submitMemoryItem(input: MemorySubmitInput) {
  const issue = validateMemorySubmit(input);
  if (issue) throw new Error(issue);

  const memoryKind = KIND_MAP[input.uiKind] || 'general';
  const requestId = memoryRequestId();
  let mediaUrl = '';

  if (input.pickedFile) {
    mediaUrl = await uploadMemoryPickedFile(input.pickedFile, requestId);
  }

  const item = {
    branch_key: cleanText(input.branchKey),
    person_id: null,
    person_name: cleanText(input.personName),
    person_lineage: cleanText(input.personLineage ?? '') || null,
    title: cleanText(input.title),
    description: cleanText(input.description ?? '') || null,
    story_text: memoryKind === 'story' ? cleanText(input.storyText ?? '') : null,
    memory_kind: memoryKind,
    memory_date: cleanText(input.memoryDate ?? '') || null,
    memory_year: cleanText(input.memoryYear ?? '') || null,
    submitted_by_name: cleanText(input.submittedByName),
    submitted_by_phone: cleanPhone(input.submittedByPhone),
    submitted_by_relation: cleanText(input.submittedByRelation ?? '') || 'public',
    is_featured: false,
    display_order: 0,
    tags: [],
  };

  const mediaPayload = mediaUrl
    ? [
        {
          media_type: mediaDbType(input.uiKind),
          media_url: mediaUrl,
          thumbnail_url: null,
          caption: null,
          display_order: 0,
        },
      ]
    : [];

  const id = await callMemorySubmitRpc(item, mediaPayload);
  return { ok: true as const, id };
}
