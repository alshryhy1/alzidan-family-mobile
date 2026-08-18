import type { Branch, FamilyEvent, PublicAffinityStats, TreeChild, TreeParent } from '../types';
import { eventTypeArabicLabel } from '../utils/eventTypeLabels';
import type { MaternalKinshipLabel, MotherLinkRow, SpouseRow } from '../utils/maternalKinship';
import {
  auntSpouseIdsForViewer,
  isEncounterKinshipLabel,
  linkKinshipByTargetId,
  mapFromRelativeSets,
  maternalRelativesForViewer,
  wifeRoleTowardViewer,
} from '../utils/maternalKinship';
import { collectBranchTreeStats, isTreePersonDeceased } from '../utils/treeStats';
import { isPublicLineageHiddenPerson } from '../utils/personVisibility';
import { callPublicRpc, selectPublicRows } from './supabase';

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
  gender?: string | null;
  photo_url?: string | null;
};

type EventRow = {
  id: number;
  branch_key: string;
  type: string;
  person: string;
  date_label: string | null;
  event_date: string | null;
  details: string | Record<string, unknown> | null;
  hospital_name: string | null;
  hospital_dept: string | null;
  contact_method: string | null;
  contact_phone: string | null;
  visit_date_from: string | null;
  visit_date_to: string | null;
  visit_time_from: string | null;
  visit_time_to: string | null;
  created_at: string;
  show_at?: string | null;
  end_at?: string | null;
  show_before_days?: number | null;
  manual_hidden?: boolean | null;
};

type SpouseSummaryRow = {
  wife_is_family_member: boolean | null;
  wife_branch_key: string | null;
  status: string | null;
};

function eventTitle(type: string) {
  // Align with web formatEventTypeLabel / eventTypeArabicLabel (مريض, زواج, …)
  return eventTypeArabicLabel(type);
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

type ParsedEventDetails = {
  text?: string;
  extra?: string;
  notes?: string;
  hospitalName?: string;
  hospital_name?: string;
  hospitalDept?: string;
  hospital_dept?: string;
  imageUrl?: string;
  image_url?: string;
  photoUrl?: string;
  photo_url?: string;
  videoUrl?: string;
  video_url?: string;
  show_at?: string;
  showAt?: string;
  end_at?: string;
  endAt?: string;
  show_before_days?: number;
  showBeforeDays?: number;
  manual_hidden?: boolean;
  manualHidden?: boolean;
  event?: Record<string, unknown>;
};

function parseEventDetails(details: string | ParsedEventDetails | null | undefined) {
  if (details == null || details === '') return null;
  if (typeof details === 'object') return details as ParsedEventDetails;
  try {
    return JSON.parse(String(details)) as ParsedEventDetails;
  } catch {
    return null;
  }
}

function extractEventDetails(details: string | ParsedEventDetails | null | undefined) {
  if (details == null || details === '') return '';
  const parsed = parseEventDetails(details);
  if (parsed) return parsed.text || parsed.extra || parsed.notes || '';
  return typeof details === 'string' ? details : '';
}

function extractEventImageUrl(details: string | ParsedEventDetails | null | undefined) {
  const parsed = parseEventDetails(details);
  return parsed?.imageUrl || parsed?.image_url || parsed?.photoUrl || parsed?.photo_url || '';
}

function extractEventVideoUrl(details: string | ParsedEventDetails | null | undefined) {
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

function extractShowDays(details: string | ParsedEventDetails | null | undefined): number | null {
  const parsed = parseEventDetails(details);
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = (parsed as { showDays?: unknown }).showDays;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function mapEvent(row: EventRow): FamilyEvent {
  const category = eventCategory(row.type);
  const parsed = parseEventDetails(row.details);
  const hospitalFromDetails = parsed?.hospitalName || parsed?.hospital_name || undefined;
  const deptFromDetails = parsed?.hospitalDept || parsed?.hospital_dept || undefined;
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
    hospitalName: row.hospital_name || hospitalFromDetails || undefined,
    hospitalDepartment: row.hospital_dept || deptFromDetails || undefined,
    contactMethod: row.contact_method ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    visitDateFrom: row.visit_date_from ?? undefined,
    visitDateTo: row.visit_date_to ?? undefined,
    visitTimeFrom: row.visit_time_from ?? undefined,
    visitTimeTo: row.visit_time_to ?? undefined,
    createdAt: row.created_at,
    showDays: extractShowDays(row.details),
    showAt: row.show_at || parsed?.show_at || parsed?.showAt || undefined,
    endAt: row.end_at || parsed?.end_at || parsed?.endAt || undefined,
    showBeforeDays: row.show_before_days ?? parsed?.show_before_days ?? parsed?.showBeforeDays ?? undefined,
    manualHidden: row.manual_hidden === true || parsed?.manual_hidden === true || parsed?.manualHidden === true,
    rawDetails: row.details ?? null,
  };
}

async function loadTreeChildren() {
  try {
    return await selectPublicRows<ChildRow>(
      'tree_children?select=id,branch_key,parent_name,name,child_name,birth_order,birth_date_g,birth_date_h,birth_year,death_date_g,death_date_h,city,area,is_deceased,deceased,gender,photo_url&order=id.asc',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const missingColumn =
      message.includes('does not exist') || message.includes('schema cache');
    const photoMissing = message.includes('photo_url') && missingColumn;
    const birthOrderMissing = message.includes('birth_order') && missingColumn;
    const genderMissing = message.includes('gender') && missingColumn;
    if (photoMissing) {
      return selectPublicRows<ChildRow>(
        'tree_children?select=id,branch_key,parent_name,name,child_name,birth_order,birth_date_g,birth_date_h,birth_year,death_date_g,death_date_h,city,area,is_deceased,deceased,gender&order=id.asc',
      );
    }
    if (genderMissing) {
      return selectPublicRows<ChildRow>(
        'tree_children?select=id,branch_key,parent_name,name,child_name,birth_order,birth_date_g,birth_date_h,birth_year,death_date_g,death_date_h,city,area,is_deceased,deceased&order=id.asc',
      );
    }
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
      'family_events?select=id,branch_key,type,person,date_label,event_date,details,hospital_name,hospital_dept,contact_method,contact_phone,visit_date_from,visit_date_to,visit_time_from,visit_time_to,created_at,show_at,show_before_days,end_at,manual_hidden&order=created_at.desc&limit=100',
    ),
    selectPublicRows<SpouseSummaryRow>(
      'tree_spouse_summary?select=wife_is_family_member,wife_branch_key,status&limit=5000',
    ),
  ]);

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
    isDeceased: isTreePersonDeceased(row.is_deceased, row.deceased) ? true : row.is_deceased ?? row.deceased ?? null,
    gender: row.gender ?? null,
    photoUrl: String(row.photo_url || '').trim() || null,
  }));

  const branches: Branch[] = branchRows.map((row) => {
    const branchParents = parentRows.filter((parent) => parent.branch_key === row.key);
    const branchChildren = children.filter((child) => child.branchKey === row.key);
    const publicBranchChildren = branchChildren.filter((child) => !isPublicLineageHiddenPerson(child));
    const rawBranchChildren = childRows.filter((child) => child.branch_key === row.key);
    return {
      id: row.key,
      name: row.key,
      fullName: row.title,
      summary: 'فرع عائلي موثق ضمن ذرية مطلق بن زيدان.',
      familiesCount: branchParents.length || rootParentCount(rawBranchChildren),
      membersCount: collectBranchTreeStats(publicBranchChildren, row.key).living,
    };
  });

  return {
    branches,
    parents,
    children,
    events: eventRows.map(mapEvent),
    affinityStats: buildAffinityStats(spouseSummaryRows),
  };
}

type KinshipRpcRow = {
  person_id?: number;
  label?: string;
};

type MemberViewerRpcRow = {
  id?: number;
  child_name?: string | null;
  parent_name?: string | null;
  branch_key?: string | null;
  gender?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
};

export async function loadMemberViewerPerson(phone: string): Promise<TreeChild | null> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  try {
    const data = await callPublicRpc<MemberViewerRpcRow[] | MemberViewerRpcRow>(
      'tree_member_viewer_v1',
      { p_phone: phone },
    );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) return null;
    const name = String(row.child_name || '').trim();
    const parentName = String(row.parent_name || '').trim();
    return {
      id: Number(row.id),
      branchKey: String(row.branch_key || ''),
      parentName,
      name: name || parentName,
      birthOrder: null,
      birthDateGregorian: null,
      birthDateHijri: null,
      birthYear: null,
      city: null,
      area: null,
      isDeceased: null,
      gender: row.gender ?? null,
      photoUrl: String(row.photo_url || '').trim() || null,
    };
  } catch {
    return null;
  }
}

export async function loadKinshipRpcForViewer(
  viewerId: number | null | undefined,
): Promise<Record<number, string>> {
  const id = Number(viewerId || 0);
  if (!id) return {};
  const fromRpc: Record<number, string> = {};
  const ingest = (data: KinshipRpcRow[] | KinshipRpcRow | null | undefined) => {
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    rows.forEach((row) => {
      const personId = Number(row?.person_id || 0);
      const label = String(row?.label || '').trim();
      if (!personId || !isEncounterKinshipLabel(label)) return;
      if (!fromRpc[personId]) fromRpc[personId] = label;
    });
  };
  try {
    ingest(
      await callPublicRpc<KinshipRpcRow[] | KinshipRpcRow>('tree_kinship_for_person_v1', {
        p_person_id: id,
      }),
    );
  } catch {
    /* RPC may be missing until SQL workspace is applied */
  }
  try {
    ingest(
      await callPublicRpc<KinshipRpcRow[] | KinshipRpcRow>('tree_maternal_kinship_for_viewer_v1', {
        p_viewer_id: id,
      }),
    );
  } catch {
    /* older maternal RPC is optional */
  }
  return fromRpc;
}

export async function loadKinshipForViewer(
  viewer: TreeChild | null | undefined,
  children: TreeChild[] = [],
): Promise<Record<number, string>> {
  const id = Number(viewer?.id || 0);
  if (!id) return {};
  const fromRpc = await loadKinshipRpcForViewer(id);
  const fromLocal = await loadKinshipFromPublicTables(viewer, children);
  return { ...fromRpc, ...fromLocal };
}

/** @deprecated use loadKinshipForViewer — kept for existing callers */
export async function loadMaternalKinshipForViewer(
  viewerId: number | null | undefined,
  children: TreeChild[] = [],
): Promise<Record<number, MaternalKinshipLabel>> {
  const stub = viewerId ? { id: Number(viewerId), name: '', parentName: '', branchKey: '' } as TreeChild : null;
  const map = await loadKinshipForViewer(stub, children);
  const out: Record<number, MaternalKinshipLabel> = {};
  Object.keys(map).forEach((key) => {
    const label = map[Number(key)];
    if (
      label === 'جدك من الأم' ||
      label === 'خالك' ||
      label === 'ابن خالك' ||
      label === 'ابن خالتك'
    ) {
      out[Number(key)] = label;
    }
  });
  return out;
}

type MotherLinkApiRow = {
  child_id?: number;
  spouse_id?: number;
  mother_name?: string | null;
  mother_lineage?: string | null;
  mother_is_family_member?: boolean | null;
  mother_branch_key?: string | null;
  confidence?: string | null;
};

type SpouseApiRow = {
  id?: number;
  husband_id?: number;
  wife_name?: string | null;
  wife_lineage?: string | null;
  wife_is_family_member?: boolean | null;
  wife_branch_key?: string | null;
  status?: string | null;
};

function mapSpouseRow(row: SpouseApiRow): SpouseRow | null {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    husbandId: Number(row.husband_id || 0),
    wifeName: row.wife_name,
    wifeLineage: row.wife_lineage,
    wifeIsFamilyMember: row.wife_is_family_member,
    wifeBranchKey: row.wife_branch_key,
    status: row.status,
  };
}

function mapMotherLinkRow(row: MotherLinkApiRow): MotherLinkRow | null {
  const childId = Number(row.child_id || 0);
  const spouseId = Number(row.spouse_id || 0);
  if (!childId || !spouseId) return null;
  return {
    childId,
    spouseId,
    motherName: row.mother_name,
    motherLineage: row.mother_lineage,
    motherIsFamilyMember: row.mother_is_family_member,
    motherBranchKey: row.mother_branch_key,
    confidence: row.confidence,
  };
}

async function loadMotherLinksForSpouseIds(spouseIds: number[]): Promise<MotherLinkRow[]> {
  const ids = [...new Set(spouseIds.map(Number).filter(Boolean))];
  if (!ids.length) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 80) chunks.push(ids.slice(i, i + 80));
  const out: MotherLinkRow[] = [];
  for (const chunk of chunks) {
    const rows = await selectPublicRows<MotherLinkApiRow>(
      `tree_mother_links?spouse_id=in.(${chunk.join(',')})&select=child_id,spouse_id,mother_name,mother_lineage,mother_is_family_member,mother_branch_key,confidence&limit=2000`,
    );
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const mapped = mapMotherLinkRow(row);
      if (mapped) out.push(mapped);
    });
  }
  return out;
}

async function loadKinshipFromPublicTables(
  viewer: TreeChild | null | undefined,
  children: TreeChild[],
): Promise<Record<number, string>> {
  if (!viewer?.id || !children.length) return {};
  try {
    const spouseRows = await selectPublicRows<SpouseApiRow>(
      'tree_spouses?wife_is_family_member=eq.true&select=id,husband_id,wife_name,wife_lineage,wife_is_family_member,wife_branch_key,status&limit=5000',
    );
    const spouses = (Array.isArray(spouseRows) ? spouseRows : [])
      .map(mapSpouseRow)
      .filter((row): row is SpouseRow => Boolean(row));

    const viewerLinks = await selectPublicRows<MotherLinkApiRow>(
      `tree_mother_links?child_id=eq.${viewer.id}&select=child_id,spouse_id,mother_name,mother_lineage,mother_is_family_member,mother_branch_key,confidence&limit=20`,
    );
    let motherLinks = (Array.isArray(viewerLinks) ? viewerLinks : [])
      .map(mapMotherLinkRow)
      .filter((row): row is MotherLinkRow => Boolean(row));

    const relatedIds: Record<number, boolean> = {};
    motherLinks.forEach((row) => {
      if (row.spouseId) relatedIds[row.spouseId] = true;
    });
    spouses.forEach((spouse) => {
      if (wifeRoleTowardViewer(spouse, viewer)) relatedIds[spouse.id] = true;
    });
    auntSpouseIdsForViewer(Number(viewer.id), spouses, motherLinks).forEach((id) => {
      relatedIds[id] = true;
    });
    const extraLinks = await loadMotherLinksForSpouseIds(
      Object.keys(relatedIds).map(Number).filter(Boolean),
    );
    const seenLink: Record<string, boolean> = {};
    motherLinks = motherLinks.concat(extraLinks).filter((row) => {
      const key = `${row.childId}:${row.spouseId}`;
      if (seenLink[key]) return false;
      seenLink[key] = true;
      return true;
    });

    const ctx = { children, motherLinks, spouses };
    const fromMaternal = mapFromRelativeSets(maternalRelativesForViewer(viewer.id, ctx));
    const fromLinks = linkKinshipByTargetId(viewer, ctx);
    return { ...fromMaternal, ...fromLinks };
  } catch {
    return {};
  }
}
