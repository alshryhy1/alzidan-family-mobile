/**
 * ردود الفنجال المنتهية لا تختلط مع جلسة فنجال جديدة في «وصلك من العائلة».
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

function isFinjalEventType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .startsWith('finjal_');
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

  if (isFinjalEventType(item.occasion_type)) {
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
  const yours = isFinjalEventType(type) || type === 'gathering' ? 'دعوتك' : 'مناسبتك';
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

const filteredWithBoard = filterCurrentOccasionInbox([oldFinjal, liveFinjal], {
  activeOccasionIds: [99],
  now,
});
const filteredByAge = filterCurrentOccasionInbox([oldFinjal, liveFinjal], { now });

const checks = [
  ['old finjal hidden when not on board', !filteredWithBoard.some((item) => item.occasion_id === 11)],
  ['live finjal kept when on board', filteredWithBoard.some((item) => item.occasion_id === 99)],
  ['age-only hides two-week finjal', !filteredByAge.some((item) => item.occasion_id === 11)],
  ['age-only keeps fresh finjal', filteredByAge.some((item) => item.occasion_id === 99)],
  [
    'finjal off board rejected even if recent',
    !isCurrentOccasionInboxItem(
      { ...liveFinjal, occasion_id: 77, latest_at: oneHourAgo },
      { activeOccasionIds: [99], now },
    ),
  ],
  [
    'empty board falls back to age',
    isCurrentOccasionInboxItem(liveFinjal, { activeOccasionIds: [], now }),
  ],
  ['headline names the invitation', occasionInboxHeadline(liveFinjal) === 'دعوة أحمد'],
  ['old reply shows weeks ago', formatOccasionInboxWhen(twoWeeksAgo, now) === 'قبل 2 أسابيع'],
  ['fresh reply shows one hour', formatOccasionInboxWhen(oneHourAgo, now) === 'قبل ساعة'],
  ['source exports filter', src.includes('export function filterCurrentOccasionInbox')],
  ['source exports headline', src.includes('export function occasionInboxHeadline')],
  ['source exports when label', src.includes('export function formatOccasionInboxWhen')],
  ['source hides previous finjal replies', src.includes('فنجال سابق') || src.includes('isFinjalEventType')],
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
