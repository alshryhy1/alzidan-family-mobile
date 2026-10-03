import AsyncStorage from '@react-native-async-storage/async-storage';

import { canonicalizePhone, phonesMatch } from '../utils/phone';
import type { RemembranceKind } from '../utils/todayRemembrance';
import { insertPublicRow, isSupabaseConfigured, selectPublicRows } from './supabase';

const TABLE = 'family_remembrance_greetings';
const LOCAL_KEY = 'alzidan_remembrance_greetings_v1';

export type RemembranceGreeting = {
  id: string;
  personId: number;
  kind: RemembranceKind;
  dayKey: string;
  senderName: string;
  senderPhone: string;
  phrase: string;
};

type RemoteRow = {
  id?: string;
  person_id?: number | string;
  kind?: string;
  day_key?: string;
  sender_name?: string | null;
  sender_phone?: string | null;
  phrase?: string | null;
};

function mapRow(row: RemoteRow): RemembranceGreeting | null {
  const personId = Number(row.person_id);
  const kind = row.kind === 'death' ? 'death' : row.kind === 'birth' ? 'birth' : null;
  const dayKey = String(row.day_key || '').trim();
  const senderPhone = String(row.sender_phone || '').trim();
  if (!personId || !kind || !dayKey || !senderPhone) return null;
  return {
    id: String(row.id || `${personId}:${kind}:${senderPhone}`),
    personId,
    kind,
    dayKey,
    senderName: String(row.sender_name || '').trim(),
    senderPhone,
    phrase: String(row.phrase || '').trim(),
  };
}

async function readLocal(dayKey: string): Promise<RemembranceGreeting[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RemembranceGreeting[];
    return Array.isArray(parsed) ? parsed.filter((row) => row && row.dayKey === dayKey) : [];
  } catch {
    return [];
  }
}

async function rememberLocal(row: RemembranceGreeting) {
  const current = await readLocal(row.dayKey);
  const next = current.filter(
    (item) =>
      !(
        item.personId === row.personId &&
        item.kind === row.kind &&
        phonesMatch(item.senderPhone, row.senderPhone)
      ),
  );
  next.push(row);
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next.slice(-80)));
}

function mergeGreetings(rows: RemembranceGreeting[]) {
  const seen = new Set<string>();
  const out: RemembranceGreeting[] = [];
  for (const row of rows) {
    const phone = canonicalizePhone(row.senderPhone) || row.senderPhone;
    const key = `${row.personId}:${row.kind}:${phone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function loadRemembranceGreetings(dayKey: string) {
  const local = await readLocal(dayKey);
  if (!isSupabaseConfigured() || !dayKey) return local;
  try {
    const remote = await selectPublicRows<RemoteRow>(
      `${TABLE}?select=id,person_id,kind,day_key,sender_name,sender_phone,phrase&day_key=eq.${encodeURIComponent(dayKey)}&order=created_at.asc&limit=200`,
    );
    return mergeGreetings([...remote.map(mapRow).filter((row): row is RemembranceGreeting => Boolean(row)), ...local]);
  } catch {
    return local;
  }
}

export async function sendRemembranceGreeting(input: {
  personId: number;
  kind: RemembranceKind;
  dayKey: string;
  phrase: string;
  senderPhone: string;
  senderName?: string;
}) {
  const senderPhone = canonicalizePhone(input.senderPhone);
  if (!senderPhone) throw new Error('سجّل دخولك من ملفي عشان توصل تهنئتك.');
  const row: RemembranceGreeting = {
    id: `rg_${input.personId}_${input.kind}_${input.dayKey}_${Date.now().toString(36)}`,
    personId: input.personId,
    kind: input.kind,
    dayKey: input.dayKey,
    senderName: String(input.senderName || '').trim() || 'فرد من العائلة',
    senderPhone,
    phrase: input.phrase,
  };
  try {
    await insertPublicRow(TABLE, {
      id: row.id,
      person_id: row.personId,
      kind: row.kind,
      day_key: row.dayKey,
      sender_phone: row.senderPhone,
      sender_name: row.senderName,
      phrase: row.phrase,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('23505') || message.includes('duplicate')) {
      await rememberLocal(row);
      return row;
    }
    if (message.includes('PGRST205') || message.includes('42P01') || message.includes('family_remembrance_greetings')) {
      throw new Error('شغّل أمر «ذكريات اليوم» في الإدارة مرة واحدة، ثم أعد التهنئة.');
    }
    throw new Error('تعذر إيصال التهنئة الآن.');
  }
  await rememberLocal(row);
  return row;
}

export function remembranceGreeterLine(
  kind: RemembranceKind,
  greetings: RemembranceGreeting[],
  selfBirthday: boolean,
) {
  const names = greetings
    .map((row) => String(row.senderName || '').trim().split(/\s+/).filter(Boolean)[0] || '')
    .filter(Boolean);
  const unique = [...new Set(names)];
  if (!unique.length) return '';
  const shown = unique.slice(0, 3).join(' · ');
  const extra = unique.length - 3;
  const tail = extra > 0 ? ` و${extra}` : '';
  if (selfBirthday) return `هنّأك: ${shown}${tail}`;
  if (kind === 'death') return `دعا له: ${shown}${tail}`;
  return `هنّأه: ${shown}${tail}`;
}
