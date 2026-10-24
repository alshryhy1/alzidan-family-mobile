/**
 * مشاركات الدعوة/الفنجال المنتهية لا تبقى في «وصلك من العائلة».
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/services/occasionInteractions.ts'), 'utf8');
const profile = readFileSync(join(root, 'src/screens/ProfileScreen.tsx'), 'utf8');
const app = readFileSync(join(root, 'App.tsx'), 'utf8');

const FINJAL_INBOX_KEEP_MS = 36 * 60 * 60 * 1000;
const OCCASION_INBOX_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

const RSVP_TYPES = new Set([
  'feast',
  'gathering',
  'family_meetup',
  'dinner',
  'lunch',
  'general',
  'finjal_asr',
  'finjal_isha',
  'finjal_hawlna',
]);
const CEREMONY_TYPES = new Set([
  'wedding',
  'contract',
  'graduation',
  'promotion',
  'retirement',
  'aqiqa',
]);

function isFinjalEventType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .startsWith('finjal_');
}

function isInviteInboxType(type) {
  const t = String(type || '')
    .trim()
    .toLowerCase();
  return isFinjalEventType(t) || RSVP_TYPES.has(t) || CEREMONY_TYPES.has(t);
}

function occasionInboxTimestampMs(item) {
  const latest = Date.parse(String(item.latest_at || ''));
  if (Number.isFinite(latest) && latest > 0) return latest;
  const messages = Array.isArray(item.messages) ? item.messages : [];
  let max = 0;
  for (const message of messages) {
    const at = Date.parse(String(message.created_at || ''));
    if (Number.isFinite(at) && at > max) max = at;
  }
  return max;
}

function isCurrentOccasionInboxItem(item, opts = {}) {
  const nowMs = (opts.now ?? new Date()).getTime();
  const id = String(item.occasion_id ?? '').trim();
  const active =
    opts.activeOccasionIds == null
      ? null
      : new Set([...opts.activeOccasionIds].map((value) => String(value).trim()).filter(Boolean));
  const boardReady = Boolean(active && active.size > 0);

  if (boardReady && id && active.has(id)) return true;

  const at = occasionInboxTimestampMs(item);
  const age = at > 0 ? nowMs - at : Number.POSITIVE_INFINITY;

  if (isInviteInboxType(item.occasion_type)) {
    if (boardReady && id && !active.has(id)) return false;
    return age <= FINJAL_INBOX_KEEP_MS;
  }

  return age <= OCCASION_INBOX_KEEP_MS;
}

function filterCurrentOccasionInbox(items, opts = {}) {
  return (items || []).filter((item) => isCurrentOccasionInboxItem(item, opts));
}

function occasionInboxHeadline(item) {
  const person = String(item.occasion_person || '').trim();
  const type = String(item.occasion_type || '');
  const yours = isInviteInboxType(type) ? 'دعوتك' : 'مناسبتك';
  if (!person) return yours;
  if (yours === 'دعوتك') return `دعوة ${person}`;
  return `${yours} · ${person}`;
}

function formatOccasionInboxWhen(raw, now = new Date()) {
  const at = Date.parse(String(raw || ''));
  if (!Number.isFinite(at) || at <= 0) return '';
  const diffMs = now.getTime() - at;
  if (diffMs < 0) return 'الآن';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'قبل ساعة' : `قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days < 14) return `قبل ${days} يوم`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return weeks === 1 ? 'قبل أسبوع' : `قبل ${weeks} أسابيع`;
  const d = new Date(at);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const now = new Date('2026-10-15T12:00:00+03:00');
const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

const oldFinjal = {
  occasion_id: 11,
  occasion_type: 'finjal_isha',
  occasion_person: 'أبو زيد',
  total: 2,
  latest_at: twoWeeksAgo,
  messages: [
    { id: 1, sender_name: 'مزيد خميس', message: 'أعتذر عن الحضور', created_at: twoWeeksAgo },
    { id: 2, sender_name: 'حسن خميس', message: 'بعيد ولا كان جيتك', created_at: twoWeeksAgo },
  ],
};

const liveFinjal = {
  occasion_id: 99,
  occasion_type: 'finjal_isha',
  occasion_person: 'أحمد',
  total: 1,
  latest_at: oneHourAgo,
  messages: [{ id: 3, sender_name: 'خالد', message: 'حاضر إن شاء الله', created_at: oneHourAgo }],
};

const oldDinner = {
  occasion_id: 44,
  occasion_type: 'dinner',
  occasion_person: 'سعيد',
  total: 3,
  latest_at: threeDaysAgo,
  messages: [{ id: 4, sender_name: 'ناصر', message: 'بتشرف', created_at: threeDaysAgo }],
};

const liveDinner = {
  occasion_id: 55,
  occasion_type: 'dinner',
  occasion_person: 'فهد',
  total: 1,
  latest_at: oneHourAgo,
  messages: [{ id: 5, sender_name: 'ماجد', message: 'إن شاء الله', created_at: oneHourAgo }],
};

const filteredWithBoard = filterCurrentOccasionInbox(
  [oldFinjal, liveFinjal, oldDinner, liveDinner],
  {
    activeOccasionIds: [99, 55],
    now,
  },
);
const filteredByAge = filterCurrentOccasionInbox([oldFinjal, liveFinjal, oldDinner], { now });

const checks = [
  ['old finjal hidden when not on board', !filteredWithBoard.some((item) => item.occasion_id === 11)],
  ['live finjal kept when on board', filteredWithBoard.some((item) => item.occasion_id === 99)],
  ['old dinner invite hidden when not on board', !filteredWithBoard.some((item) => item.occasion_id === 44)],
  ['live dinner kept when on board', filteredWithBoard.some((item) => item.occasion_id === 55)],
  ['age-only hides two-week finjal', !filteredByAge.some((item) => item.occasion_id === 11)],
  ['age-only keeps fresh finjal', filteredByAge.some((item) => item.occasion_id === 99)],
  [
    'age-only hides 3-day dinner without board',
    !filteredByAge.some((item) => item.occasion_id === 44),
  ],
  [
    'invite off board rejected even if recent',
    !isCurrentOccasionInboxItem(
      { ...liveDinner, occasion_id: 77, latest_at: oneHourAgo },
      { activeOccasionIds: [55], now },
    ),
  ],
  [
    'empty board falls back to age',
    isCurrentOccasionInboxItem(liveDinner, { activeOccasionIds: [], now }),
  ],
  ['headline names the invitation', occasionInboxHeadline(liveDinner) === 'دعوة فهد'],
  ['old reply shows weeks ago', formatOccasionInboxWhen(twoWeeksAgo, now) === 'قبل 2 أسابيع'],
  ['fresh reply shows one hour', formatOccasionInboxWhen(oneHourAgo, now) === 'قبل ساعة'],
  ['source exports filter', src.includes('export function filterCurrentOccasionInbox')],
  ['source exports invite helper', src.includes('export function isInviteInboxType')],
  ['source exports headline', src.includes('export function occasionInboxHeadline')],
  ['source exports when label', src.includes('export function formatOccasionInboxWhen')],
  ['profile filters visible inbox', profile.includes('filterCurrentOccasionInbox')],
  ['profile shows invitation person', profile.includes('occasionInboxHeadline')],
  ['profile shows reply time', profile.includes('formatOccasionInboxWhen')],
  ['profile accepts active ids', profile.includes('activeOccasionIds')],
  ['app passes active occasion ids', app.includes('activeOccasionIds={activeOccasionIds}')],
  ['app filters badge inbox', app.includes('filterCurrentOccasionInbox(occasionInbox')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(
    'verify-occasion-inbox-session failed:\n' + failed.map(([name]) => ` - ${name}`).join('\n'),
  );
  process.exit(1);
}
console.log(`verify-occasion-inbox-session: ${checks.length} checks ok`);
