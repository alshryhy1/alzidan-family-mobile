import type { Branch, FamilyEvent, PublicAffinityStats, TreeChild, TreeParent } from '../types';
import { eventTypeArabicLabel } from '../utils/eventTypeLabels';
import { eventFamilyOf, eventTextIsTypeEcho, newsIncidentDateIsPlausible, normalizePlaceKind, parseCoordinates } from '../utils/eventRequestMessage';
import type { MaternalKinshipLabel, MotherLinkRow, SpouseRow } from '../utils/maternalKinship';
import {
  auntSpouseIdsForViewer,
  isEncounterKinshipLabel,
  linkKinshipByTargetId,
  mapFromRelativeSets,
  maternalRelativesForViewer,
  wifeRoleTowardViewer,
} from '../utils/maternalKinship';
import { leafPersonName, nodePathId, normalizePathKey } from '../utils/personEncounter';
import { childrenOfPersonInGraph, partnerNameForMarriage, siblingsInGraph } from '../utils/selfPath';
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
  const family = eventFamilyOf(type);
  if (family === 'death') return 'condolence';
  if (family === 'health') return 'health';
  return 'happy';
}

function categoryLabel(category: FamilyEvent['category'], type?: string) {
  if (category === 'condolence') return 'تعزية';
  if (category === 'health') return 'اطمئنان';
  if (eventFamilyOf(type || '') === 'occasion') return 'دعوة';
  return 'فرح';
}

type ParsedEventDetails = {
  text?: string;
  extra?: string;
  notes?: string;
  place_kind?: string;
  placeKind?: string;
  place?: string;
  placeName?: string;
  lat?: number;
  lng?: number;
  coords?: string;
  coordinates?: string;
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
  if (parsed) {
    if (parsed.text) return parsed.text;
    if (parsed.notes) return parsed.notes;
    if (parsed.place_kind || parsed.placeKind) return '';
    return parsed.extra || '';
  }
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
  const family = eventFamilyOf(row.type);
  const incident = String(row.date_label || row.event_date || '').trim();
  if (family === 'news' || family === 'health') {
    if (newsIncidentDateIsPlausible(incident, row.created_at)) return incident;
    if (row.created_at) {
      const ms = Date.parse(row.created_at);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    return '';
  }
  return incident;
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
    categoryLabel: categoryLabel(category, row.type),
    title: eventTitle(row.type),
    type: row.type,
    person: row.person,
    date: formatEventDate(row),
    eventDate: row.event_date ?? undefined,
    details: (() => {
      const raw = extractEventDetails(row.details);
      return eventTextIsTypeEcho(row.type, raw) ? '' : raw;
    })(),
    imageUrl: extractEventImageUrl(row.details) || undefined,
    videoUrl: extractEventVideoUrl(row.details) || undefined,
    branch: `فرع ${row.branch_key}`,
    branchKey: row.branch_key,
    sourcePhone: String(
      (parsed as { submitter_phone?: string; source_phone?: string } | null)?.submitter_phone ||
        (parsed as { submitter_phone?: string; source_phone?: string } | null)?.source_phone ||
        '',
    ).trim() || null,
    hospitalName: row.hospital_name || hospitalFromDetails || undefined,
    hospitalDepartment: row.hospital_dept || deptFromDetails || undefined,
    contactMethod: row.contact_method ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    visitDateFrom: row.visit_date_from ?? undefined,
    visitDateTo: row.visit_date_to ?? undefined,
    visitTimeFrom: row.visit_time_from ?? undefined,
    visitTimeTo: row.visit_time_to ?? undefined,
    placeKind: normalizePlaceKind(parsed?.place_kind || parsed?.placeKind) || undefined,
    placeName: String(parsed?.extra || parsed?.place || parsed?.placeName || '').trim() || undefined,
    lat: parseCoordinates(
      parsed?.lat != null && parsed?.lng != null ? `${parsed.lat},${parsed.lng}` : parsed?.coords || parsed?.coordinates || '',
    )?.lat ?? (typeof parsed?.lat === 'number' ? parsed.lat : undefined),
    lng: parseCoordinates(
      parsed?.lat != null && parsed?.lng != null ? `${parsed.lat},${parsed.lng}` : parsed?.coords || parsed?.coordinates || '',
    )?.lng ?? (typeof parsed?.lng === 'number' ? parsed.lng : undefined),
    createdAt: row.created_at,
    showDays: extractShowDays(row.details),
    showAt: row.show_at || parsed?.show_at || parsed?.showAt || undefined,
    endAt: row.end_at || parsed?.end_at || parsed?.endAt || undefined,
    showBeforeDays: row.show_before_days ?? parsed?.show_before_days ?? parsed?.showBeforeDays ?? undefined,
    manualHidden: row.manual_hidden === true || parsed?.manual_hidden === true || parsed?.manualHidden === true,
    rawDetails: row.details ?? null,
  };
}

function mapChildRow(row: ChildRow): TreeChild {
  return {
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

  const children: TreeChild[] = childRows.map(mapChildRow);

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

/**
 * Logged-in female: full tree (women and men). Male: empty — public tree stays men-only;
 * his close circle is مسار الذات, not الفروع.
 */
export async function loadMemberLineageChildren(phone: string): Promise<TreeChild[]> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return [];
  try {
    const data = await callPublicRpc<ChildRow[] | ChildRow>(
      'tree_member_lineage_children_v1',
      { p_phone: phone },
    );
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    return rows
      .filter((row) => row && Number(row.id) > 0)
      .map((row) => {
        const raw = row as ChildRow & { parent?: string };
        const parentName = String(raw.parent_name || raw.parent || '');
        return mapChildRow({
          id: Number(row.id),
          branch_key: String(row.branch_key || ''),
          parent_name: parentName,
          name: String(row.name || row.child_name || ''),
          child_name: row.child_name ?? row.name ?? null,
          birth_order: row.birth_order ?? null,
          birth_date_g: row.birth_date_g ?? null,
          birth_date_h: row.birth_date_h ?? null,
          birth_year: row.birth_year ?? null,
          death_date_g: row.death_date_g ?? null,
          death_date_h: row.death_date_h ?? null,
          city: row.city ?? null,
          area: row.area ?? null,
          is_deceased: row.is_deceased ?? null,
          deceased: row.deceased ?? null,
          gender: row.gender ?? null,
          photo_url: row.photo_url ?? null,
        });
      });
  } catch {
    return [];
  }
}

export async function loadMemberViewerPerson(phone: string): Promise<TreeChild | null> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
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
      if (wifeRoleTowardViewer(spouse, viewer, children)) relatedIds[spouse.id] = true;
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

export type SelfPathLoadedFacts = {
  motherName: string | null;
  spousePartnerName: string | null;
  spouseRole: 'husband' | 'wife' | null;
  childNames: string[];
  daughterNames: string[];
  sisterNames: string[];
  externalOffspringNames: string[];
};

type SelfChildRpcRow = {
  id?: number;
  leaf_name?: string | null;
  gender?: string | null;
  birth_order?: number | null;
};

function selfChildLeafKey(name: string) {
  return name.replace(/\s+/g, ' ').trim();
}


type ExternalOffspringRpcRow = {
  id?: number;
  offspring_id?: string | null;
  child_name?: string | null;
  gender?: string | null;
  father_name?: string | null;
};

async function loadExternalOffspringByPhone(phone: string): Promise<string[]> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return [];
  try {
    const data = await callPublicRpc<ExternalOffspringRpcRow[] | ExternalOffspringRpcRow>(
      'tree_external_offspring_for_self_v1',
      { p_phone: phone },
    );
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const seen: Record<string, boolean> = {};
    const names: string[] = [];
    rows.forEach((row) => {
      const name = leafPersonName(String(row?.child_name || ''));
      if (!name) return;
      const key = selfChildLeafKey(name);
      if (seen[key]) return;
      seen[key] = true;
      names.push(name);
    });
    return names;
  } catch {
    return [];
  }
}

async function loadSelfSiblingsByPhone(phone: string): Promise<SelfChildRpcRow[]> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return [];
  try {
    const data = await callPublicRpc<SelfChildRpcRow[] | SelfChildRpcRow>(
      'tree_self_siblings_v1',
      { p_phone: phone },
    );
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const seen: Record<string, boolean> = {};
    return rows.filter((row) => {
      const id = Number(row?.id || 0);
      const name = selfChildLeafKey(String(row?.leaf_name || ''));
      if (!id && !name) return false;
      const key = id ? `id:${id}` : `n:${name}`;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  } catch {
    return [];
  }
}

async function loadSelfChildrenByPhone(phone: string): Promise<SelfChildRpcRow[]> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return [];
  try {
    const data = await callPublicRpc<SelfChildRpcRow[] | SelfChildRpcRow>(
      'tree_self_children_v1',
      { p_phone: phone },
    );
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const seen: Record<string, boolean> = {};
    return rows.filter((row) => {
      const id = Number(row?.id || 0);
      const name = selfChildLeafKey(String(row?.leaf_name || ''));
      if (!id && !name) return false;
      const key = id ? `id:${id}` : `n:${name}`;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  } catch {
    return [];
  }
}

function isActiveSpouseStatus(status: string | null | undefined) {
  const value = String(status || '')
    .trim()
    .toLowerCase();
  if (!value) return true;
  if (
    value === 'divorced' ||
    value === 'inactive' ||
    value === 'ended' ||
    value === 'مطلقة' ||
    value === 'مطلق' ||
    value === 'طليق' ||
    value.includes('طلق')
  ) {
    return false;
  }
  return value === 'active';
}

function isConfirmedMotherLink(confidence: string | null | undefined) {
  const value = String(confidence || '').trim().toLowerCase();
  return !value || value === 'confirmed';
}

/**
 * Documented self-path facts after login. Gate is session + person id, not gender.
 * Public tree/search stay unchanged (RLS + public filter). Own daughters and
 * sisters are loaded only for this login via tree_self_children_v1 /
 * tree_self_siblings_v1.
 */
export async function loadSelfPathFacts(
  viewer: TreeChild | null | undefined,
  children: TreeChild[],
  phone?: string | null,
): Promise<SelfPathLoadedFacts> {
  const empty: SelfPathLoadedFacts = {
    motherName: null,
    spousePartnerName: null,
    spouseRole: null,
    childNames: [],
    daughterNames: [],
    sisterNames: [],
    externalOffspringNames: [],
  };
  const id = Number(viewer?.id || 0);
  if (!id || !viewer) return empty;

  let motherName: string | null = null;
  try {
    const motherRows = await selectPublicRows<MotherLinkApiRow>(
      `tree_mother_links?child_id=eq.${id}&select=child_id,spouse_id,mother_name,mother_lineage,mother_is_family_member,mother_branch_key,confidence&limit=20`,
    );
    const motherRaw = (Array.isArray(motherRows) ? motherRows : []).find((row) =>
      isConfirmedMotherLink(row.confidence),
    );
    const motherLink = motherRaw ? mapMotherLinkRow(motherRaw) : null;
    motherName =
      String(
        motherLink?.motherName ||
          motherLink?.motherLineage ||
          motherRaw?.mother_name ||
          motherRaw?.mother_lineage ||
          '',
      ).trim() || null;
  } catch {
    motherName = null;
  }

  let uniqueSpouses: SpouseRow[] = [];
  try {
    const asHusbandRows = await selectPublicRows<SpouseApiRow>(
      `tree_spouses?husband_id=eq.${id}&select=id,husband_id,wife_name,wife_lineage,wife_is_family_member,wife_branch_key,status&limit=40`,
    );
    let familyWifeRows: SpouseApiRow[] = [];
    try {
      familyWifeRows = await selectPublicRows<SpouseApiRow>(
        'tree_spouses?wife_is_family_member=eq.true&select=id,husband_id,wife_name,wife_lineage,wife_is_family_member,wife_branch_key,status&limit=5000',
      );
    } catch {
      familyWifeRows = [];
    }
    const seenSpouse: Record<number, boolean> = {};
    uniqueSpouses = [...(Array.isArray(asHusbandRows) ? asHusbandRows : []), ...familyWifeRows]
      .map(mapSpouseRow)
      .filter((row): row is SpouseRow => Boolean(row))
      .filter((row) => {
        if (seenSpouse[row.id]) return false;
        seenSpouse[row.id] = true;
        return true;
      });
  } catch {
    uniqueSpouses = [];
  }

  const viewerId = Number(viewer.id);
  const ranked = uniqueSpouses
    .map((spouse) => {
      const partner = partnerNameForMarriage(viewer, spouse, children);
      return partner ? { spouse, partner, active: isActiveSpouseStatus(spouse.status) } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      const aOwn = Number(a.spouse.husbandId) === viewerId ? 1 : 0;
      const bOwn = Number(b.spouse.husbandId) === viewerId ? 1 : 0;
      if (aOwn !== bOwn) return bOwn - aOwn;
      return Number(b.active) - Number(a.active);
    });

  const currentMarriage = ranked.find((row) => row.active) || null;
  const picked = currentMarriage || ranked[0] || null;
  let husband = picked?.partner.husband || null;
  if (picked?.partner.role === 'wife' && !husband && picked.partner.husbandId) {
    try {
      const rows = await selectPublicRows<ChildRow>(
        `tree_children?id=eq.${picked.partner.husbandId}&select=id,branch_key,parent_name,name,child_name&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.id) {
        husband = {
          id: Number(row.id),
          branchKey: row.branch_key,
          parentName: row.parent_name || '',
          name: row.child_name || row.name || '',
          birthOrder: null,
          birthDateGregorian: null,
          birthDateHijri: null,
          birthYear: null,
          city: null,
          area: null,
          isDeceased: null,
        };
      }
    } catch {
      husband = null;
    }
  }

  const spousePartnerName = currentMarriage
    ? (currentMarriage.partner.name || (husband ? leafPersonName(husband.name) : '')).trim() || null
    : null;

  let childNames: string[] = [];
  let daughterNames: string[] = [];
  try {
    const spouseIds = picked ? [picked.spouse.id] : [];
    const childLinks = spouseIds.length ? await loadMotherLinksForSpouseIds(spouseIds) : [];
    const fromLinks = childLinks
      .filter((row) => isConfirmedMotherLink(row.confidence))
      .map((row) => children.find((person) => Number(person.id) === Number(row.childId)))
      .filter((row): row is TreeChild => Boolean(row));
    const parentForChildren =
      picked?.partner.role === 'wife' ? husband : viewer;
    const fromGraph = parentForChildren
      ? childrenOfPersonInGraph(parentForChildren, children)
      : [];
    const seenChild: Record<number, boolean> = {};
    [...fromLinks, ...fromGraph].forEach((row) => {
      if (seenChild[row.id]) return;
      seenChild[row.id] = true;
      const name = leafPersonName(row.name);
      if (!name) return;
      if (isPublicLineageHiddenPerson(row)) daughterNames.push(name);
      else childNames.push(name);
    });
  } catch {
    childNames = [];
    daughterNames = [];
  }

  const rpcChildren = await loadSelfChildrenByPhone(String(phone || ''));
  if (rpcChildren.length) {
    const siblingKeys = new Set(
      siblingsInGraph(viewer, children)
        .map((row) => normalizePathKey(nodePathId(row)))
        .filter(Boolean),
    );
    const viewerKey = normalizePathKey(nodePathId(viewer));
    const husbandKey =
      picked?.partner.role === 'husband'
        ? viewerKey
        : picked?.partner.husband
          ? normalizePathKey(nodePathId(picked.partner.husband))
          : '';
    const sons: string[] = [];
    const daughters: string[] = [];
    const seenLeaf: Record<string, boolean> = {};
    rpcChildren.forEach((row) => {
      const person = children.find((item) => Number(item.id) === Number(row.id));
      if (person) {
        const parentKey = normalizePathKey(person.parentName);
        if (parentKey && siblingKeys.has(parentKey)) return;
        const underViewer = Boolean(viewerKey && parentKey === viewerKey);
        const underHusband = Boolean(husbandKey && parentKey === husbandKey);
        if (!underViewer && !underHusband) return;
      } else if (!picked) {
        return;
      }
      const name = leafPersonName(String(row.leaf_name || ''));
      if (!name) return;
      const key = selfChildLeafKey(name);
      if (seenLeaf[key]) return;
      seenLeaf[key] = true;
      if (isPublicLineageHiddenPerson({ gender: row.gender })) daughters.push(name);
      else sons.push(name);
    });
    childNames = sons;
    daughterNames = daughters;
  }

  const daughterKeys = new Set(daughterNames.map((name) => selfChildLeafKey(name)));
  childNames = childNames.filter((name) => !daughterKeys.has(selfChildLeafKey(name)));

  let sisterNames: string[] = [];
  const rpcSiblings = await loadSelfSiblingsByPhone(String(phone || ''));
  if (rpcSiblings.length) {
    const seenLeaf: Record<string, boolean> = {};
    rpcSiblings.forEach((row) => {
      if (!isPublicLineageHiddenPerson({ gender: row.gender })) return;
      const name = leafPersonName(String(row.leaf_name || ''));
      if (!name) return;
      const key = selfChildLeafKey(name);
      if (seenLeaf[key]) return;
      seenLeaf[key] = true;
      sisterNames.push(name);
    });
  }

  const externalOffspringNames = await loadExternalOffspringByPhone(String(phone || ''));

  return {
    motherName,
    spousePartnerName,
    spouseRole: currentMarriage?.partner.role || null,
    childNames,
    daughterNames,
    sisterNames,
    externalOffspringNames,
  };
}
