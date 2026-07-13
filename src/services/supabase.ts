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

export async function insertPublicRowReturning<T extends Record<string, unknown>>(
  path: string,
  row: Record<string, unknown>,
) {
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
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `تعذر حفظ الطلب (${response.status}).`);
  }

  const data = (await response.json()) as T[] | T;
  return Array.isArray(data) ? data[0] : data;
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

export async function callPublicRpc<T = Record<string, unknown>>(
  functionName: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعداد اتصال Supabase غير مكتمل.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `تعذر استدعاء ${functionName} (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

function publicStorageUrl(bucket: string, path: string) {
  if (!supabaseUrl) return '';
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function storageObjectUrl(bucket: string, path: string) {
  if (!supabaseUrl) return '';
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = path
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`;
}

async function ensureReadableUploadUri(fileUri: string) {
  const uri = String(fileUri || '').trim();
  if (!uri) throw new Error('ملف الرفع غير متوفر.');
  if (uri.startsWith('file://')) return { uri, tempUri: '' };

  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!base) throw new Error('تعذر تجهيز ملف الرفع مؤقتًا.');

  const tempUri = `${base}upload_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`;
  await FileSystem.copyAsync({ from: uri, to: tempUri });
  return { uri: tempUri, tempUri };
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

  const objectUrl = storageObjectUrl(bucket, path);

  const response = await fetch(objectUrl, {
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

  const objectUrl = storageObjectUrl(bucket, path);
  const { uri, tempUri } = await ensureReadableUploadUri(fileUri);

  let firstError = '';

  try {
    const result = await FileSystem.uploadAsync(objectUrl, uri, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });

    if (result.status >= 200 && result.status < 300) {
      if (tempUri) {
        FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
      }
      return publicStorageUrl(bucket, path);
    }

    firstError = result.body || `تعذر رفع الملف (${result.status}).`;
  } catch (error) {
    firstError = error instanceof Error ? error.message : String(error);
  }

  try {
    const fileResponse = await fetch(uri);
    if (!fileResponse.ok) {
      throw new Error(`تعذر قراءة الملف المحلي (${fileResponse.status}).`);
    }

    const fileBlob = await fileResponse.blob();
    const fallbackResponse = await fetch(objectUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: fileBlob,
    });

    if (!fallbackResponse.ok) {
      const fallbackMessage = await fallbackResponse.text();
      throw new Error(fallbackMessage || `تعذر رفع الملف (${fallbackResponse.status}).`);
    }

    if (tempUri) {
      FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
    }
    return publicStorageUrl(bucket, path);
  } catch (fallbackError) {
    if (tempUri) {
      FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
    }
    const second = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    throw new Error(`فشل رفع الملف. المحاولة الأولى: ${firstError || 'غير معروف'}. المحاولة الثانية: ${second}`);
  }
}
