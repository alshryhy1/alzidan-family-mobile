import AsyncStorage from '@react-native-async-storage/async-storage';

import { insertPublicRowReturning, isSupabaseConfigured, selectPublicRows } from './supabase';
import { canonicalizePhone } from '../utils/phone';

const LOCAL_KEY = 'alzidan_family_board_v1';
const DELETED_KEY = 'alzidan_family_board_deleted_v1';
const TABLE = 'family_board_posts';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type FamilyBoardKind = 'offer' | 'request';

export type FamilyBoardCategory =
  | 'faza'
  | 'majlis'
  | 'car'
  | 'resthouse'
  | 'ride'
  | 'workshop'
  | 'contractor'
  | 'partner'
  | 'land'
  | 'gear'
  | 'other';

export type FamilyBoardPost = {
  id: string;
  kind: FamilyBoardKind;
  category: FamilyBoardCategory;
  title: string;
  body: string;
  place: string;
  branchKey: string;
  authorName: string;
  authorPhone: string;
  createdAt: string;
  expiresAt: string | null;
  urgent: boolean;
};

export type FamilyBoardDraft = {
  kind: FamilyBoardKind;
  category: FamilyBoardCategory;
  title: string;
  body: string;
  place: string;
  branchKey: string;
  authorName: string;
  authorPhone: string;
  /** Days until expiry; 0 = end of today */
  daysAlive: number;
  urgent?: boolean;
};

type RemoteRow = {
  id?: string;
  kind?: string;
  category?: string;
  title?: string;
  body?: string | null;
  place?: string | null;
  branch_key?: string | null;
  author_name?: string | null;
  author_phone?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  is_active?: boolean | null;
  urgent?: boolean | null;
};

export const FAMILY_BOARD_CATEGORIES: {
  id: FamilyBoardCategory;
  label: string;
  hint: string;
  mark: string;
  kindHint: FamilyBoardKind | 'both';
  titleExample: string;
  bodyExample: string;
}[] = [
  {
    id: 'faza',
    label: 'فزعة',
    hint: 'محتاج يد الآن',
    mark: '!',
    kindHint: 'request',
    titleExample: 'يحتاجون يد في نقل عفش',
    bodyExample: 'غداً العصر، شقتين. اثنين يكفي.',
  },
  {
    id: 'majlis',
    label: 'دعوة',
    hint: 'تقهوا · مجلس · زيارة',
    mark: 'م',
    kindHint: 'offer',
    titleExample: 'تقهوا الليلة',
    bodyExample: 'بعد العشاء، البيت معروف. تفضلوا.',
  },
  {
    id: 'car',
    label: 'سيارة',
    hint: 'بيع أو تنازل',
    mark: 'س',
    kindHint: 'offer',
    titleExample: 'كامري ٢٠١٩ للبيع',
    bodyExample: 'الممشى والمواصفات والسوم.',
  },
  {
    id: 'resthouse',
    label: 'استراحة',
    hint: 'متاحة للحجز',
    mark: 'ا',
    kindHint: 'offer',
    titleExample: 'استراحة متاحة الخميس والجمعة',
    bodyExample: 'السعر والموقع وكم تستوعب.',
  },
  {
    id: 'ride',
    label: 'توصيلة',
    hint: 'مسافر معك غرض',
    mark: 'ت',
    kindHint: 'both',
    titleExample: 'مسافر للرياض بكرة الصباح',
    bodyExample: 'أقدر أوصل أغراض صغيرة / أحتاج توصيلة.',
  },
  {
    id: 'workshop',
    label: 'ورشة',
    hint: 'خدمة أو خصم للعائلة',
    mark: 'و',
    kindHint: 'offer',
    titleExample: 'ورشة سمكرة — خصم للعائلة',
    bodyExample: 'نوع الخدمة ومكان الورشة.',
  },
  {
    id: 'contractor',
    label: 'مقاول',
    hint: 'ترشيح موثوق',
    mark: 'ق',
    kindHint: 'offer',
    titleExample: 'مقاول بناء مجرّب',
    bodyExample: 'نوع الشغل ومدينة العمل.',
  },
  {
    id: 'partner',
    label: 'شريك',
    hint: 'بحث عن شراكة',
    mark: 'ش',
    kindHint: 'request',
    titleExample: 'أبحث عن شريك في مشروع',
    bodyExample: 'فكرة المشروع وما تحتاجه من الشريك.',
  },
  {
    id: 'land',
    label: 'أرض',
    hint: 'بيع أو فرصة',
    mark: 'ض',
    kindHint: 'offer',
    titleExample: 'أرض للبيع في حائل',
    bodyExample: 'المساحة والموقع والسوم.',
  },
  {
    id: 'gear',
    label: 'معدات',
    hint: 'إعارة أو توفر',
    mark: 'ع',
    kindHint: 'offer',
    titleExample: 'عربة نقل متاحة للاستعارة',
    bodyExample: 'متى ومتى ترجع.',
  },
  {
    id: 'other',
    label: 'أخرى',
    hint: 'ما يندرج فوق',
    mark: '·',
    kindHint: 'both',
    titleExample: 'اكتب عنوانًا واضحًا',
    bodyExample: 'الموعد والمكان والتفاصيل.',
  },
];

export function familyBoardCategoryMeta(category: FamilyBoardCategory) {
  return FAMILY_BOARD_CATEGORIES.find((row) => row.id === category) || FAMILY_BOARD_CATEGORIES[FAMILY_BOARD_CATEGORIES.length - 1];
}

export function familyBoardCategoriesForKind(kind: FamilyBoardKind) {
  return FAMILY_BOARD_CATEGORIES.filter((row) => row.kindHint === kind || row.kindHint === 'both');
}

export function familyBoardCategoryLabel(category: FamilyBoardCategory) {
  return FAMILY_BOARD_CATEGORIES.find((row) => row.id === category)?.label || 'أخرى';
}

export function familyBoardKindLabel(kind: FamilyBoardKind) {
  return kind === 'request' ? 'طلب' : 'عرض';
}

function newId() {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function endOfDayPlus(days: number) {
  const at = new Date();
  at.setHours(23, 59, 59, 999);
  if (days > 0) at.setDate(at.getDate() + days);
  return at.toISOString();
}

function asCategory(value: unknown): FamilyBoardCategory {
  const raw = String(value || '').trim();
  if (FAMILY_BOARD_CATEGORIES.some((row) => row.id === raw)) return raw as FamilyBoardCategory;
  return 'other';
}

function asKind(value: unknown): FamilyBoardKind {
  return String(value || '').trim() === 'request' ? 'request' : 'offer';
}

function mapRemote(row: RemoteRow): FamilyBoardPost | null {
  const title = String(row.title || '').trim();
  if (!title) return null;
  if (row.is_active === false) return null;
  return {
    id: String(row.id || newId()),
    kind: asKind(row.kind),
    category: asCategory(row.category),
    title,
    body: String(row.body || '').trim(),
    place: String(row.place || '').trim(),
    branchKey: String(row.branch_key || '').trim(),
    authorName: String(row.author_name || '').trim(),
    authorPhone: String(row.author_phone || '').trim(),
    createdAt: String(row.created_at || new Date().toISOString()),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    urgent: row.urgent === true || asCategory(row.category) === 'faza',
  };
}

function isLive(post: FamilyBoardPost, now = Date.now()) {
  if (!post.expiresAt) return true;
  const end = Date.parse(post.expiresAt);
  if (!Number.isFinite(end)) return true;
  return end >= now;
}

function sortPosts(rows: FamilyBoardPost[]) {
  return [...rows].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (a.category === 'faza' && b.category !== 'faza') return -1;
    if (b.category === 'faza' && a.category !== 'faza') return 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

async function readLocal(): Promise<FamilyBoardPost[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FamilyBoardPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocal(rows: FamilyBoardPost[]) {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
}

async function readDeletedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(DELETED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

async function rememberDeletedId(id: string) {
  const set = await readDeletedIds();
  set.add(id);
  await AsyncStorage.setItem(DELETED_KEY, JSON.stringify([...set]));
}

async function softDeleteRemote(id: string) {
  if (!isSupabaseConfigured() || !supabaseUrl || !supabaseAnonKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ is_active: false }),
    });
  } catch {
    // Local delete still applies.
  }
}

async function loadRemote(): Promise<FamilyBoardPost[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const rows = await selectPublicRows<RemoteRow>(
      `${TABLE}?select=*&is_active=eq.true&order=created_at.desc&limit=80`,
    );
    return rows.map(mapRemote).filter((row): row is FamilyBoardPost => Boolean(row));
  } catch {
    return null;
  }
}

export async function loadFamilyBoardPosts(): Promise<FamilyBoardPost[]> {
  const [remote, local, deleted] = await Promise.all([loadRemote(), readLocal(), readDeletedIds()]);
  const merged = new Map<string, FamilyBoardPost>();
  for (const row of [...(remote || []), ...local]) {
    if (deleted.has(row.id)) continue;
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  const live = sortPosts([...merged.values()].filter((row) => isLive(row)));
  await writeLocal(live);
  return live;
}

export async function deleteFamilyBoardPost(input: {
  id: string;
  authorPhone?: string | null;
}): Promise<void> {
  const id = String(input.id || '').trim();
  if (!id) throw new Error('تعذر حذف الإعلان.');

  const local = await readLocal();
  const target = local.find((row) => row.id === id);
  const sessionPhone = canonicalizePhone(String(input.authorPhone || ''));
  if (target && sessionPhone) {
    const owner = canonicalizePhone(String(target.authorPhone || ''));
    if (owner && owner !== sessionPhone) {
      throw new Error('تقدر تحذف إعلانك بس.');
    }
  }

  await writeLocal(local.filter((row) => row.id !== id));
  await rememberDeletedId(id);
  await softDeleteRemote(id);
}

export async function createFamilyBoardPost(draft: FamilyBoardDraft): Promise<FamilyBoardPost> {
  const title = String(draft.title || '').trim();
  if (!title) throw new Error('اكتب عنوانًا واضحًا.');
  const phone = String(draft.authorPhone || '').trim();
  if (!phone) throw new Error('سجّل دخولك من ملفي قبل النشر.');

  const post: FamilyBoardPost = {
    id: newId(),
    kind: draft.kind,
    category: draft.category,
    title,
    body: String(draft.body || '').trim(),
    place: String(draft.place || '').trim(),
    branchKey: String(draft.branchKey || '').trim(),
    authorName: String(draft.authorName || '').trim() || 'فرد من العائلة',
    authorPhone: phone,
    createdAt: new Date().toISOString(),
    expiresAt: endOfDayPlus(Math.max(0, Math.min(30, Math.round(draft.daysAlive)))),
    urgent: draft.urgent === true || draft.category === 'faza',
  };

  if (isSupabaseConfigured()) {
    try {
      const saved = await insertPublicRowReturning<RemoteRow>(TABLE, {
        id: post.id,
        kind: post.kind,
        category: post.category,
        title: post.title,
        body: post.body || null,
        place: post.place || null,
        branch_key: post.branchKey || null,
        author_name: post.authorName || null,
        author_phone: post.authorPhone,
        created_at: post.createdAt,
        expires_at: post.expiresAt,
        is_active: true,
        urgent: post.urgent,
      });
      const mapped = mapRemote(saved);
      if (mapped) {
        const local = await readLocal();
        await writeLocal([mapped, ...local.filter((row) => row.id !== mapped.id)]);
        return mapped;
      }
    } catch {
      // Fall through to local persistence when table/RPC is not ready.
    }
  }

  const local = await readLocal();
  await writeLocal([post, ...local.filter((row) => row.id !== post.id)]);
  return post;
}

export function familyBoardMetaLine(post: FamilyBoardPost) {
  const bits = [
    post.branchKey ? `فرع ${post.branchKey}` : '',
    post.place,
    post.expiresAt ? expiryLabel(post.expiresAt) : '',
  ].filter(Boolean);
  return bits.join(' · ');
}

function expiryLabel(iso: string) {
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return '';
  const days = Math.ceil((end - Date.now()) / 86400000);
  if (days <= 0) return 'ينتهي اليوم';
  if (days === 1) return 'ينتهي غدًا';
  if (days <= 10) return `ينتهي خلال ${days} أيام`;
  return `ينتهي خلال ${days} يوم`;
}
