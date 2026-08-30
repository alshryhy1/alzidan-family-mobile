export type PulseNoticeKind = 'phone' | 'son' | 'rename' | 'delegate' | 'dua';

export type PulseBoardNotice = {
  kind: PulseNoticeKind;
  name: string;
  branchKey?: string;
  at?: string;
};

const KIND_ORDER: Record<PulseNoticeKind, number> = {
  phone: 0,
  son: 1,
  rename: 2,
  delegate: 3,
  dua: 4,
};

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const RIYADH_OFFSET_MS = 3 * HOUR_MS;

/** Quran and Sunnah — short ma'thura lines for the Pulse ticker. */
export const PULSE_SHORT_DUAS = [
  'اللهم صل وسلم على نبينا محمد',
  'اللهم صل على محمد وعلى آل محمد',
  'سبحان الله وبحمده سبحان الله العظيم',
  'سبحان الله والحمد لله ولا إله إلا الله والله أكبر',
  'لا حول ولا قوة إلا بالله',
  'حسبي الله ونعم الوكيل',
  'حسبنا الله ونعم الوكيل',
  'لا إله إلا الله وحده لا شريك له له الملك وله الحمد وهو على كل شيء قدير',
  'أستغفر الله وأتوب إليه',
  'أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه',
  'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار',
  'ربنا لا تزغ قلوبنا بعد إذ هديتنا وهب لنا من لدنك رحمة',
  'ربنا اغفر لنا ذنوبنا وإسرافنا في أمرنا وثبت أقدامنا',
  'ربنا لا تؤاخذنا إن نسينا أو أخطأنا',
  'رب اشرح لي صدري ويسر لي أمري',
  'رب زدني علما',
  'رب اغفر لي ولوالدي وللمؤمنين',
  'رب اغفر لي وتب علي إنك أنت التواب الرحيم',
  'لا إله إلا أنت سبحانك إني كنت من الظالمين',
  'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم',
  'ربنا هب لنا من أزواجنا وذرياتنا قرة أعين واجعلنا للمتقين إماما',
  'رب أوزعني أن أشكر نعمتك التي أنعمت علي وعلى والدي',
  'ربنا تقبل منا إنك أنت السميع العليم',
  'ربنا آتنا من لدنك رحمة وهيئ لنا من أمرنا رشدا',
  'ربنا أفرغ علينا صبرا وتوفنا مسلمين',
  'ربنا اغفر لي ولوالدي وللمؤمنين يوم يقوم الحساب',
  'اللهم إني أسألك العفو والعافية',
  'اللهم إني أسألك الهدى والتقى والعفاف والغنى',
  'اللهم إني أسألك الجنة وأعوذ بك من النار',
  'اللهم إني أسألك علما نافعا ورزقا طيبا وعملا متقبلا',
  'اللهم إني أعوذ بك من الهم والحزن',
  'اللهم إني أعوذ بك من العجز والكسل',
  'اللهم إني أعوذ بك من علم لا ينفع',
  'يا مقلب القلوب ثبت قلبي على دينك',
  'اللهم مصرف القلوب صرف قلوبنا على طاعتك',
  'أعوذ بكلمات الله التامات من شر ما خلق',
  'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم',
  'اللهم إني ظلمت نفسي ظلما كثيرا فاغفر لي',
  'اللهم اهدني فيمن هديت',
  'اللهم بارك لنا فيما رزقتنا',
  'اللهم أعني على ذكرك وشكرك وحسن عبادتك',
  'اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام',
  'رضيت بالله ربا وبالإسلام دينا وبمحمد صلى الله عليه وسلم نبيا',
  'اللهم إني أسألك الثبات في الأمر',
  'توكلت على الحي الذي لا يموت',
  'اللهم إني أسألك من فضلك',
  'اللهم اغفر لي خطيئتي وجهلي وإسرافي في أمري',
  'اللهم إني أعوذ بك من شر ما عملت ومن شر ما لم أعمل',
] as const;

export function pulseHourSlot(now = Date.now()) {
  return Math.floor((now + RIYADH_OFFSET_MS) / HOUR_MS);
}

export function pulseNasabFromPath(value?: string | null) {
  const parts = String(value || '')
    .split('/')
    .map((part) =>
      part
        .trim()
        .replace(/\s*رحمه الله\s*/g, '')
        .replace(/\s*\(رحمه الله\)\s*/g, ''),
    )
    .filter(Boolean)
    .slice(-3)
    .reverse();
  const unique = parts.filter((part, index) => index === 0 || part !== parts[index - 1]);
  return unique.join(' بن ');
}

export function pulseNameBlockedFromTicker(value?: string | null) {
  const name = String(value || '').trim();
  if (!name) return true;
  return /(^|\s|\/)(بنت|ابنة|ابنت|زوجة|الأم|الام|والدة)(\s|\/|$)/.test(name);
}

export function pulseTickerKindLabel(kind: PulseNoticeKind) {
  if (kind === 'phone' || kind === 'son') return 'إضافة';
  if (kind === 'rename') return 'تعديل';
  if (kind === 'delegate') return 'مندوب';
  if (kind === 'dua') return 'دعاء';
  return '';
}

export function formatPulseNotice(row: PulseBoardNotice) {
  if (row.kind === 'dua') return String(row.name || '').trim();
  const name = String(row.name || '').trim();
  if (!name || pulseNameBlockedFromTicker(name)) return '';
  if (row.kind === 'phone') {
    return `تم تسجيل رقم جوال ${name} تستطيع الآن التسجيل برقم جوالك`;
  }
  if (row.kind === 'son') {
    return `تم إضافة الابن ${name}`;
  }
  if (row.kind === 'rename') {
    return `تم تعديل اسم ${name}`;
  }
  const branch = String(row.branchKey || '').trim();
  if (!branch) return `تم إضافة ${name} مندوباً`;
  return `تم إضافة ${name} مندوباً لعائلة ${branch}`;
}

export function noticeStillLive(row: PulseBoardNotice, now = Date.now()) {
  if (row.kind === 'dua') return true;
  if (!row.at) return false;
  const at = Date.parse(row.at);
  if (!Number.isFinite(at) || now - at < 0) return false;
  if (row.kind === 'delegate') return now - at <= ONE_DAY_MS;
  return now - at <= THREE_HOURS_MS;
}

export function sortPulseNotices(rows: PulseBoardNotice[]) {
  return [...rows].sort((a, b) => {
    const kind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kind !== 0) return kind;
    return Date.parse(b.at || '') - Date.parse(a.at || '') || 0;
  });
}

export function pulseDuaItems(now = Date.now()): PulseBoardNotice[] {
  const list = PULSE_SHORT_DUAS;
  if (!list.length) return [];
  const name = list[Math.abs(pulseHourSlot(now)) % list.length];
  return [{ kind: 'dua', name }];
}

/** Phone / son / rename (3h) and a newly added delegate (1 day). Else one ma'thura dua per hour. */
export function pickPulseTickerItems(input: {
  notices?: PulseBoardNotice[];
  delegates?: PulseBoardNotice[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const live = sortPulseNotices(
    [...(input.notices || []), ...(input.delegates || [])].filter(
      (row) =>
        row.kind !== 'dua' &&
        noticeStillLive(row, now) &&
        (row.kind === 'delegate' || !pulseNameBlockedFromTicker(row.name)),
    ),
  );
  if (live.length) return live;
  return pulseDuaItems(now);
}
