export type PublicScreen = 'home' | 'branches' | 'tree' | 'events' | 'memory' | 'profile' | 'about';

export type Branch = {
  id: string;
  name: string;
  fullName?: string;
  summary: string;
  familiesCount: number;
  membersCount: number;
};

export type TreeParent = {
  id: number;
  branchKey: string;
  name: string;
};

export type TreeChild = {
  id: number;
  branchKey: string;
  parentName: string;
  name: string;
  birthOrder: number | null;
  birthDateGregorian: string | null;
  birthDateHijri: string | null;
  birthYear: number | null;
  deathDateGregorian?: string | null;
  deathDateHijri?: string | null;
  city: string | null;
  area: string | null;
  isDeceased: boolean | null;
};

export type TreePerson = {
  id: string;
  name: string;
  fullName?: string;
  birthOrder?: number | null;
  birthDateGregorian?: string | null;
  birthDateHijri?: string | null;
  birthYear?: number | null;
  deathDateGregorian?: string | null;
  deathDateHijri?: string | null;
  city?: string | null;
  area?: string | null;
  isDeceased?: boolean | null;
  meta?: string;
  children?: TreePerson[];
};

export type FamilyEvent = {
  id: string;
  category: 'happy' | 'health' | 'condolence';
  categoryLabel: string;
  title: string;
  type?: string;
  person: string;
  date: string;
  eventDate?: string;
  details: string;
  imageUrl?: string;
  videoUrl?: string;
  branch: string;
  hospitalName?: string;
  hospitalDepartment?: string;
  contactMethod?: 'visit' | 'call' | 'whatsapp' | string;
  contactPhone?: string;
  visitDateFrom?: string;
  visitDateTo?: string;
  visitTimeFrom?: string;
  visitTimeTo?: string;
  createdAt?: string;
  showDays?: number | null;
};

export type PublicAffinityStats = {
  total: number;
  insideCount: number;
  outsideCount: number;
  unknownCount: number;
  insidePct: number;
  outsidePct: number;
  unknownPct: number;
  topInsideBranches: Array<{ name: string; count: number }>;
};

export type MemberRequest = {
  id: string;
  requestId: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  branchKey?: string;
  createdAt?: string;
  decisionDate?: string;
  rejectionReason?: string;
};
