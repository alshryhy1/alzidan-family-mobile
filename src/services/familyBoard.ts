import AsyncStorage from '@react-native-async-storage/async-storage';

import { insertPublicRowReturning, isSupabaseConfigured, selectPublicRows } from './supabase';
import { notifyFamilyBoardPublished } from './eventOutboundNotify';
import { canonicalizePhone } from '../utils/phone';

const LOCAL_KEY = 'alzidan_family_board_v1';
const DELETED_KEY = 'alzidan_family_board_deleted_v1';
const RSVP_KEY = 'alzidan_family_board_rsvp_v1';
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
  /** Invitation / timed window start */
  startsAt: string | null;
  expiresAt: string | null;
  urgent: boolean;
  /** Guests who tapped «أنا جاي» on majlis invitations */
  comingCount: number;
  /** Current viewer marked coming (device/session) */
  iAmComing?: boolean;
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
  /** Days until expiry; 0 = end of today. Ignored for majlis (12h window). */
  daysAlive: number;
  /** 0–23 local hour when category is majlis; window is always 12 hours. */
  windowStartHour?: number;
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
  starts_at?: string | null;
  expires_at?: string | null;
  is_active?: boolean | null;
  urgent?: boolean | null;
  coming_count?: number | null;
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
    hint: 'تقهوا · ١٢ ساعة',
    mark: 'م',
    kindHint: 'offer',
    titleExample: 'تقهوا',
    bodyExample: 'البيت معروف. تفضلوا.',
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
  return FAMILY_BOARD_CATEGORIES.filter(
    (row) => row.id !== 'majlis' && (row.kindHint === kind || row.kindHint === 'both'),
  );
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

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toArabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] || d);
}

/** Local clock label: ٤ م / ١٢ ص */
export function formatBoardHour(hour: number) {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h === 0) return '١٢ ص';
  if (h === 12) return '١٢ م';
  if (h < 12) return `${toArabicDigits(h)} ص`;
  return `${toArabicDigits(h - 12)} م`;
}

/** Fixed 12-hour window from a local start hour. */
export function buildTwelveHourWindow(startHour: number, from = new Date()) {
  const hour = ((Math.round(startHour) % 24) + 24) % 24;
  const start = new Date(from);
  start.setSeconds(0, 0);
  start.setMinutes(0);
  start.setHours(hour, 0, 0, 0);
  let end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
  if (end.getTime() <= from.getTime()) {
    start.setDate(start.getDate() + 1);
    end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
  }
  return {
    startsAt: start.toISOString(),
    expiresAt: end.toISOString(),
    startHour: hour,
    endHour: (hour + 12) % 24,
  };
}

export function familyBoardWindowLabel(post: Pick<FamilyBoardPost, 'startsAt' | 'expiresAt' | 'category'>) {
  if (!post.startsAt || !post.expiresAt) return '';
  const start = new Date(post.startsAt);
  const end = new Date(post.expiresAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '';
  return `من ${formatBoardHour(start.getHours())} إلى ${formatBoardHour(end.getHours())}`;
}

export const MAJLIS_START_HOURS = [12, 14, 16, 17, 18, 19, 20, 21, 22];

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
    startsAt: row.starts_at ? String(row.starts_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    urgent: row.urgent === true || asCategory(row.category) === 'faza',
    comingCount: Math.max(0, Number(row.coming_count) || 0),
  };
}

function normalizeLocalPost(row: FamilyBoardPost): FamilyBoardPost {
  return {
    ...row,
    comingCount: Math.max(0, Number(row.comingCount) || 0),
    startsAt: row.startsAt || null,
    expiresAt: row.expiresAt || null,
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
    return Array.isArray(parsed) ? parsed.map(normalizeLocalPost) : [];
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

async function readRsvpMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(RSVP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeRsvpMap(map: Record<string, string[]>) {
  await AsyncStorage.setItem(RSVP_KEY, JSON.stringify(map));
}

async function patchRemote(id: string, patch: Record<string, unknown>) {
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
      body: JSON.stringify(patch),
    });
  } catch {
    // Local state still applies.
  }
}

function attachRsvp(posts: FamilyBoardPost[], rsvp: Record<string, string[]>, viewerPhone?: string) {
  const phone = canonicalizePhone(viewerPhone || '');
  return posts.map((post) => {
    const phones = (rsvp[post.id] || []).map((row) => canonicalizePhone(row)).filter(Boolean);
    const localCount = phones.length;
    const comingCount = Math.max(post.comingCount || 0, localCount);
    return {
      ...post,
      comingCount,
      iAmComing: phone ? phones.includes(phone) : false,
    };
  });
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

export async function loadFamilyBoardPosts(viewerPhone?: string | null): Promise<FamilyBoardPost[]> {
  const [remote, local, deleted, rsvp] = await Promise.all([
    loadRemote(),
    readLocal(),
    readDeletedIds(),
    readRsvpMap(),
  ]);
  const merged = new Map<string, FamilyBoardPost>();
  for (const row of [...(remote || []), ...local]) {
    if (deleted.has(row.id)) continue;
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  const all = [...merged.values()];
  const live: FamilyBoardPost[] = [];
  const expired: FamilyBoardPost[] = [];
  for (const row of all) {
    if (isLive(row)) live.push(row);
    else expired.push(row);
  }
  for (const row of expired) {
    await rememberDeletedId(row.id);
    await softDeleteRemote(row.id);
    const nextRsvp = { ...rsvp };
    delete nextRsvp[row.id];
    await writeRsvpMap(nextRsvp);
  }
  const sorted = sortPosts(attachRsvp(live, rsvp, viewerPhone || undefined));
  await writeLocal(
    sorted.map((row) => ({
      ...row,
      iAmComing: undefined,
      comingCount: row.comingCount || 0,
    })),
  );
  return sorted;
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
  if (draft.category === 'majlis') {
    throw new Error('التقهوى تنشر من المناسبات.');
  }

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
    startsAt: null,
    expiresAt: endOfDayPlus(Math.max(0, Math.min(30, Math.round(draft.daysAlive)))),
    urgent: draft.urgent === true || draft.category === 'faza',
    comingCount: 0,
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
        starts_at: post.startsAt,
        expires_at: post.expiresAt,
        is_active: true,
        urgent: post.urgent,
        coming_count: 0,
      });
      const mapped = mapRemote(saved);
      if (mapped) {
        const local = await readLocal();
        await writeLocal([mapped, ...local.filter((row) => row.id !== mapped.id)]);
        const saved = { ...mapped, comingCount: mapped.comingCount || 0, iAmComing: false };
        void notifyFamilyBoardPublished(saved);
        return saved;
      }
    } catch {
      // Fall through to local persistence when table/RPC is not ready.
    }
  }

  const local = await readLocal();
  await writeLocal([post, ...local.filter((row) => row.id !== post.id)]);
  return { ...post, iAmComing: false };
}

export async function extendFamilyBoardHour(input: {
  id: string;
  authorPhone?: string | null;
}): Promise<FamilyBoardPost> {
  const id = String(input.id || '').trim();
  if (!id) throw new Error('تعذر التمديد.');
  const sessionPhone = canonicalizePhone(String(input.authorPhone || ''));
  if (!sessionPhone) throw new Error('سجّل دخولك من ملفي.');

  const local = await readLocal();
  const target = local.find((row) => row.id === id);
  if (!target) throw new Error('الإعلان غير موجود.');
  if (target.category !== 'majlis') throw new Error('التمديد للدعوة فقط.');
  if (canonicalizePhone(target.authorPhone) !== sessionPhone) {
    throw new Error('تقدر تمدّد دعوتك بس.');
  }
  if (!isLive(target)) throw new Error('الدعوة انتهت.');
  if (!target.expiresAt) throw new Error('ما فيه وقت للتمديد.');

  const end = Date.parse(target.expiresAt);
  if (!Number.isFinite(end)) throw new Error('تعذر التمديد.');
  const nextExpires = new Date(end + 60 * 60 * 1000).toISOString();
  const updated: FamilyBoardPost = {
    ...target,
    expiresAt: nextExpires,
    comingCount: target.comingCount || 0,
  };

  await writeLocal([updated, ...local.filter((row) => row.id !== id)]);
  await patchRemote(id, { expires_at: nextExpires });
  const rsvp = await readRsvpMap();
  return attachRsvp([updated], rsvp, sessionPhone)[0];
}

export async function toggleFamilyBoardComing(input: {
  id: string;
  phone?: string | null;
}): Promise<FamilyBoardPost> {
  const id = String(input.id || '').trim();
  const phone = canonicalizePhone(String(input.phone || ''));
  if (!id) throw new Error('تعذر التسجيل.');
  if (!phone) throw new Error('سجّل دخولك من ملفي عشان تقول أنا جاي.');

  const local = await readLocal();
  const target = local.find((row) => row.id === id);
  if (!target) throw new Error('الإعلان غير موجود.');
  if (target.category !== 'majlis') throw new Error('«أنا جاي» للدعوة فقط.');
  if (!isLive(target)) throw new Error('الدعوة انتهت.');
  if (canonicalizePhone(target.authorPhone) === phone) {
    throw new Error('هذي دعوتك. الضيوف يضغطون أنا جاي.');
  }

  const rsvp = await readRsvpMap();
  const phones = new Set((rsvp[id] || []).map((row) => canonicalizePhone(row)).filter(Boolean));
  if (phones.has(phone)) phones.delete(phone);
  else phones.add(phone);
  rsvp[id] = [...phones];
  await writeRsvpMap(rsvp);

  const comingCount = phones.size;
  const updated: FamilyBoardPost = {
    ...target,
    comingCount,
    iAmComing: phones.has(phone),
  };
  await writeLocal([{ ...target, comingCount }, ...local.filter((row) => row.id !== id)]);
  await patchRemote(id, { coming_count: comingCount });
  return updated;
}

export function familyBoardComingLabel(count: number) {
  if (count <= 0) return '';
  if (count === 1) return 'واحد جاي';
  if (count === 2) return 'اثنان جايون';
  if (count >= 3 && count <= 10) return `${count} جايين`;
  return `${count} جاي`;
}

export function familyBoardMetaLine(post: FamilyBoardPost) {
  const window = familyBoardWindowLabel(post);
  const coming =
    post.category === 'majlis' ? familyBoardComingLabel(post.comingCount || 0) : '';
  const bits = [
    post.branchKey ? `فرع ${post.branchKey}` : '',
    post.place,
    window || (post.expiresAt ? expiryLabel(post.expiresAt) : ''),
    coming,
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
