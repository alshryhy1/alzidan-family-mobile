import * as FileSystem from 'expo-file-system/legacy';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function selectPublicRows<T>(path: string): Promise<T[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعداد اتصال Supabase غير مكتمل.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `تعذر تحميل البيانات (${response.status}).`);
  }

  return response.json() as Promise<T[]>;
}

export async function insertPublicRow(path: string, row: Record<string, unknown>) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعداد اتصال Supabase غير مكتمل.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `تعذر حفظ الطلب (${response.status}).`);
  }
}


export async function upsertPublicRow(path: string, row: Record<string, unknown>, onConflict: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعداد اتصال Supabase غير مكتمل.');
  }

  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}${separator}on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `تعذر حفظ البيانات (${response.status}).`);
  }
}

function publicStorageUrl(bucket: string, path: string) {
  if (!supabaseUrl) return '';
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

export async function uploadPublicFile(
  bucket: string,
  path: string,
  file: Blob,
  contentType: string,
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعداد اتصال Supabase غير مكتمل.');
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: file,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `تعذر رفع الملف (${response.status}).`);
  }

  return publicStorageUrl(bucket, path);
}

export async function uploadPublicFileUri(
  bucket: string,
  path: string,
  fileUri: string,
  contentType: string,
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعداد اتصال Supabase غير مكتمل.');
  }

  const result = await FileSystem.uploadAsync(
    `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
    fileUri,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.body || `تعذر رفع الملف (${result.status}).`);
  }

  return publicStorageUrl(bucket, path);
}
