import { selectPublicRows } from './supabase';

export type MemoryUiKind = 'image' | 'video' | 'audio' | 'story' | 'document' | 'other';

export type MemoryItem = {
  id: string;
  branchKey: string;
  personId: string;
  personName: string;
  personLineage: string;
  title: string;
  description: string;
  storyText: string;
  memoryKind: MemoryUiKind;
  memoryDate: string;
  memoryYear: number | null;
  submittedByName: string;
  submittedByPhone: string;
  createdAt: string;
  displayOrder: number | null;
  media: MemoryMedia[];
  people: MemoryPerson[];
};

export type MemoryMedia = {
  id: string;
  memoryId: string;
  mediaType: MemoryUiKind;
  mediaUrl: string;
  thumbnailUrl: string;
  caption: string;
  displayOrder: number | null;
};

export type MemoryPerson = {
  id: string;
  memoryId: string;
  personId: string;
  personName: string;
  personLineage: string;
  relationNote: string;
};

export type MemoryReaction = {
  id: string;
  memoryId: string;
  reactionType: string;
  senderName: string;
  senderPhone: string;
  text: string;
  createdAt: string;
};

type MemoryItemRow = {
  id: string | null;
  branch_key: string | null;
  person_id: string | null;
  person_name: string | null;
  person_lineage: string | null;
  title: string | null;
  description: string | null;
  story_text: string | null;
  memory_kind: string | null;
  memory_date: string | null;
  memory_year: number | null;
  submitted_by_name: string | null;
  submitted_by_phone: string | null;
  created_at: string | null;
  display_order: number | null;
};

type MemoryMediaRow = {
  id: string | null;
  memory_id: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  display_order: number | null;
};

type MemoryPersonRow = {
  id: string | null;
  memory_id: string | null;
  person_id: string | null;
  person_name: string | null;
  person_lineage: string | null;
  relation_note: string | null;
};

type MemoryReactionRow = {
  id: string | null;
  memory_id: string | null;
  reaction_type: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  text: string | null;
  created_at: string | null;
};

function cleanText(value: unknown) {
  return String(value || '').trim();
}

function uiKindFromItemKind(kind: unknown): MemoryUiKind {
  const value = cleanText(kind).toLowerCase();
  if (value === 'video') return 'video';
  if (value === 'audio') return 'audio';
  if (value === 'story') return 'story';
  if (value === 'document') return 'document';
  if (value === 'photo_album' || value === 'image') return 'image';
  return 'other';
}

function uiKindFromMediaType(kind: unknown): MemoryUiKind {
  const value = cleanText(kind).toLowerCase();
  if (value === 'video') return 'video';
  if (value === 'audio') return 'audio';
  if (value === 'document') return 'document';
  return 'image';
}

function inFilter(ids: string[]) {
  const valid = ids.map((id) => cleanText(id)).filter(Boolean);
  if (!valid.length) return '';
  return `in.(${valid.join(',')})`;
}

export async function fetchApprovedMemoryItems(limit = 240): Promise<MemoryItem[]> {
  const rows = await selectPublicRows<MemoryItemRow>(
    `family_memory_items?select=id,branch_key,person_id,person_name,person_lineage,title,description,story_text,memory_kind,memory_date,memory_year,submitted_by_name,submitted_by_phone,created_at,display_order&status=eq.approved&order=display_order.asc.nullslast&order=created_at.desc&limit=${limit}`,
  );

  const items: MemoryItem[] = rows
    .map((row) => ({
      id: cleanText(row.id),
      branchKey: cleanText(row.branch_key),
      personId: cleanText(row.person_id),
      personName: cleanText(row.person_name),
      personLineage: cleanText(row.person_lineage),
      title: cleanText(row.title),
      description: cleanText(row.description),
      storyText: cleanText(row.story_text),
      memoryKind: uiKindFromItemKind(row.memory_kind),
      memoryDate: cleanText(row.memory_date),
      memoryYear: typeof row.memory_year === 'number' ? row.memory_year : null,
      submittedByName: cleanText(row.submitted_by_name),
      submittedByPhone: cleanText(row.submitted_by_phone),
      createdAt: cleanText(row.created_at),
      displayOrder: typeof row.display_order === 'number' ? row.display_order : null,
      media: [],
      people: [],
    }))
    .filter((row) => row.id);

  if (!items.length) return [];

  const ids = items.map((item) => item.id);
  const idsFilter = inFilter(ids);

  const [mediaRows, peopleRows] = await Promise.all([
    selectPublicRows<MemoryMediaRow>(
      `family_memory_media?select=id,memory_id,media_type,media_url,thumbnail_url,caption,display_order&memory_id=${idsFilter}&order=display_order.asc.nullslast`,
    ),
    selectPublicRows<MemoryPersonRow>(
      `family_memory_people?select=id,memory_id,person_id,person_name,person_lineage,relation_note&memory_id=${idsFilter}`,
    ),
  ]);

  const mediaByMemory = new Map<string, MemoryMedia[]>();
  mediaRows.forEach((row) => {
    const memoryId = cleanText(row.memory_id);
    if (!memoryId) return;
    const bucket = mediaByMemory.get(memoryId) || [];
    bucket.push({
      id: cleanText(row.id),
      memoryId,
      mediaType: uiKindFromMediaType(row.media_type),
      mediaUrl: cleanText(row.media_url),
      thumbnailUrl: cleanText(row.thumbnail_url),
      caption: cleanText(row.caption),
      displayOrder: typeof row.display_order === 'number' ? row.display_order : null,
    });
    mediaByMemory.set(memoryId, bucket);
  });

  const peopleByMemory = new Map<string, MemoryPerson[]>();
  peopleRows.forEach((row) => {
    const memoryId = cleanText(row.memory_id);
    if (!memoryId) return;
    const bucket = peopleByMemory.get(memoryId) || [];
    bucket.push({
      id: cleanText(row.id),
      memoryId,
      personId: cleanText(row.person_id),
      personName: cleanText(row.person_name),
      personLineage: cleanText(row.person_lineage),
      relationNote: cleanText(row.relation_note),
    });
    peopleByMemory.set(memoryId, bucket);
  });

  return items.map((item) => {
    const media = mediaByMemory.get(item.id) || [];
    const people = peopleByMemory.get(item.id) || [];

    return {
      ...item,
      media,
      people,
    };
  });
}

export async function fetchApprovedReactionsByMemoryIds(memoryIds: string[]): Promise<MemoryReaction[]> {
  const idsFilter = inFilter(memoryIds);
  if (!idsFilter) return [];

  const rows = await selectPublicRows<MemoryReactionRow>(
    `family_memory_reactions?select=id,memory_id,reaction_type,sender_name,sender_phone,text,created_at&status=eq.approved&memory_id=${idsFilter}&order=created_at.desc`,
  );

  return rows
    .map((row) => ({
      id: cleanText(row.id),
      memoryId: cleanText(row.memory_id),
      reactionType: cleanText(row.reaction_type),
      senderName: cleanText(row.sender_name),
      senderPhone: cleanText(row.sender_phone),
      text: cleanText(row.text),
      createdAt: cleanText(row.created_at),
    }))
    .filter((row) => row.id && row.memoryId && row.text);
}
