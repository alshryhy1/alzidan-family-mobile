import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

import { callPublicRpc, uploadPublicFileUri } from './supabase';

export function isSafePersonPhotoUrl(url?: string | null) {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) && !u.includes(' ') && !u.includes('<');
}

export async function uploadMemberPhoto(asset: ImagePickerAsset, personId: number) {
  const id = Number(personId || 0);
  if (!id) throw new Error('تعذر تحديد الشخص.');
  const converted = await ImageManipulator.manipulateAsync(asset.uri, [], {
    compress: 0.86,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const path = `person-photos/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  return uploadPublicFileUri('event-media', path, converted.uri, 'image/jpeg');
}

export async function saveMemberPhoto(phone: string, photoUrl: string) {
  const ok = await callPublicRpc<boolean>('tree_member_set_photo_v1', {
    p_phone: phone,
    p_photo_url: photoUrl || '',
  });
  if (ok === false) throw new Error('تعذر حفظ الصورة.');
  return true;
}
