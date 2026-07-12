import type { Branch, FamilyEvent, PublicAffinityStats, TreeChild, TreeParent } from '../types';
import { eventTypeArabicLabel } from '../utils/eventTypeLabels';
import { selectPublicRows } from './supabase';

type BranchRow = {
  key: string;
  title: string;
};

type ParentRow = {
  id: number;
  branch_key: string;
  name: string;
};

type ChildRow = {
  id: number;
  branch_key: string;
  parent_name: string;
  name: string;
  child_name: string | null;
  birth_order?: number | null;
  birth_date_g: string | null;
  birth_date_h: string | null;
  birth_year?: number | null;
  death_date_g?: string | null;
  death_date_h?: string | null;
  city: string | null;
  area: string | null;
  is_deceased: boolean | null;
  deceased: boolean | null;
};

type EventRow = {
  id: number;
  branch_key: string;
  type: string;
  person: string;
  date_label: string | null;
  event_date: string | null;
  details: string | null;
  hospital_name: string | null;
  hospital_dept: string | null;
  contact_method: string | null;
  contact_phone: string | null;
  visit_date_from: string | null;
  visit_date_to: string | null;
  visit_time_from: string | null;
  visit_time_to: string | null;
  created_at: string;
};

type SpouseSummaryRow = {
  wife_is_family_member: boolean | null;
  wife_branch_key: string | null;
  status: string | null;
};

const eventTitles: Record<string, string> = {
  birth: 'مولود جديد',
  engagement: 'خطوبة',
  contract: 'عقد قران',
  marriage: 'زواج',
  graduation: 'تخرج',
  success: 'نجاح وتفوق',
  promotion: 'ترقية أو وظيفة',
  new_house: 'منزل جديد',
  travel: 'سفر',
  gathering: 'اجتماع عائلي',
  sick: 'خبر صحي',
  operation: 'عملية',
  discharge: 'خروج من المستشفى',
  death: 'وفاة',
  general: 'مناسبة عامة',
};

function eventTitle(type: string) {
  return eventTitles[type] || eventTypeArabicLabel(type);
}

function eventCategory(type: string): FamilyEvent['category'] {
  if (type === 'death') return 'condolence';
  if (type === 'sick' || type === 'operation' || type === 'discharge') return 'health';
  return 'happy';
}

function categoryLabel(category: FamilyEvent['category']) {
  if (category === 'condolence') return 'تعزية';
  if (category === 'health') return 'اطمئنان';
  return 'فرح';
}

function parseEventDetails(details: string | null) {
  if (!details) return null;
  try {
    return JSON.parse(details) as {
      text?: string;
      extra?: string;
      notes?: string;
      imageUrl?: string;
      image_url?: string;
      photoUrl?: string;
      photo_url?: string;
      videoUrl?: string;
      video_url?: string;
    };
  } catch {
    return null;
  }
}

function extractEventDetails(details: string | null) {
  if (!details) return '';
  const parsed = parseEventDetails(details);
  if (parsed) return parsed.text || parsed.extra || parsed.notes || '';
  return details;
}

function extractEventImageUrl(details: string | null) {
  const parsed = parseEventDetails(details);
  return parsed?.imageUrl || parsed?.image_url || parsed?.photoUrl || parsed?.photo_url || '';
}

function extractEventVideoUrl(details: string | null) {
  const parsed = parseEventDetails(details);
  return parsed?.videoUrl || parsed?.video_url || '';
}

function formatEventDate(row: EventRow) {
  return row.date_label || row.event_date || '';
}

function rootParentCount(rows: ChildRow[]) {
  const childNames = new Set(rows.map((row) => row.child_name || row.name));
  return new Set(rows.map((row) => row.parent_name).filter((name) => !childNames.has(name))).size;
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part * 1000) / total) / 10;
}

function buildAffinityStats(rows: SpouseSummaryRow[]): PublicAffinityStats {
  const active = rows.filter((row) => String(row.status || 'active') === 'active');
  const total = active.length;
  const insideCount = active.filter((row) => row.wife_is_family_member === true).length;
  const outsideCount = active.filter((row) => row.wife_is_family_member === false).length;
  const unknownCount = Math.max(0, total - insideCount - outsideCount);

  const branchMap = new Map<string, number>();
  active.forEach((row) => {
    if (row.wife_is_family_member !== true) return;
    const name = String(row.wife_branch_key || '').trim() || 'غير محدد';
    branchMap.set(name, (branchMap.get(name) || 0) + 1);
  });

  const topInsideBranches = Array.from(branchMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    total,
    insideCount,
    outsideCount,
    unknownCount,
    insidePct: pct(insideCount, total),
    outsidePct: pct(outsideCount, total),
    unknownPct: pct(unknownCount, total),
    topInsideBranches,
  };
}

function mapEvent(row: EventRow): FamilyEvent {
  const category = eventCategory(row.type);
  return {
    id: String(row.id),
    category,
    categoryLabel: categoryLabel(category),
    title: eventTitle(row.type),
    type: row.type,
    person: row.person,
    date: formatEventDate(row),
    eventDate: row.event_date ?? undefined,
    details: extractEventDetails(row.details),
    imageUrl: extractEventImageUrl(row.details) || undefined,
    videoUrl: extractEventVideoUrl(row.details) || undefined,
    branch: `فرع ${row.branch_key}`,
    hospitalName: row.hospital_name ?? undefined,
    hospitalDepartment: row.hospital_dept ?? undefined,
    contactMethod: row.contact_method ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    visitDateFrom: row.visit_date_from ?? undefined,
    visitDateTo: row.visit_date_to ?? undefined,
    visitTimeFrom: row.visit_time_from ?? undefined,
    visitTimeTo: row.visit_time_to ?? undefined,
    createdAt: row.created_at,
  };
}

async function loadTreeChildren() {
  try {
    return await selectPublicRows<ChildRow>(
      'tree_children?select=id,branch_key,parent_name,name,child_name,birth_order,birth_date_g,birth_date_h,birth_year,death_date_g,death_date_h,city,area,is_deceased,deceased&order=id.asc',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const birthOrderMissing =
      message.includes('birth_order') &&
      (message.includes('does not exist') || message.includes('schema cache'));
    if (!birthOrderMissing) throw error;

    return selectPublicRows<ChildRow>(
      'tree_children?select=id,branch_key,parent_name,name,child_name,birth_date_g,birth_date_h,birth_year,death_date_g,death_date_h,city,area,is_deceased,deceased&order=id.asc',
    );
  }
}

export async function loadPublicData() {
  const [branchRows, parentRows, childRows, eventRows, spouseSummaryRows] = await Promise.all([
    selectPublicRows<BranchRow>('tree_branches?select=key,title&order=key.asc'),
    selectPublicRows<ParentRow>('tree_parents?select=id,branch_key,name&order=id.asc'),
    loadTreeChildren(),
    selectPublicRows<EventRow>(
      'family_events?select=id,branch_key,type,person,date_label,event_date,details,hospital_name,hospital_dept,contact_method,contact_phone,visit_date_from,visit_date_to,visit_time_from,visit_time_to,created_at&order=created_at.desc&limit=100',
    ),
    selectPublicRows<SpouseSummaryRow>(
      'tree_spouse_summary?select=wife_is_family_member,wife_branch_key,status&limit=5000',
    ),
  ]);

  const branches: Branch[] = branchRows.map((row) => {
    const branchParents = parentRows.filter((parent) => parent.branch_key === row.key);
    const branchChildren = childRows.filter((child) => child.branch_key === row.key);
    return {
      id: row.key,
      name: row.key,
      fullName: row.title,
      summary: 'فرع عائلي موثق ضمن ذرية مطلق بن زيدان.',
      familiesCount: branchParents.length || rootParentCount(branchChildren),
      membersCount: branchChildren.length,
    };
  });

  const parents: TreeParent[] = parentRows.map((row) => ({
    id: row.id,
    branchKey: row.branch_key,
    name: row.name,
  }));

  const children: TreeChild[] = childRows.map((row) => ({
    id: row.id,
    branchKey: row.branch_key,
    parentName: row.parent_name,
    name: row.child_name || row.name,
    birthOrder: row.birth_order ?? null,
    birthDateGregorian: row.birth_date_g,
    birthDateHijri: row.birth_date_h,
    birthYear: row.birth_year ?? null,
    deathDateGregorian: row.death_date_g ?? null,
    deathDateHijri: row.death_date_h ?? null,
    city: row.city,
    area: row.area,
    isDeceased: row.is_deceased ?? row.deceased ?? null,
  }));

  return {
    branches,
    parents,
    children,
    events: eventRows.map(mapEvent),
    affinityStats: buildAffinityStats(spouseSummaryRows),
  };
}
