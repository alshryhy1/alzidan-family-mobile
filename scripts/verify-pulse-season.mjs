/**
 * Keep in sync with src/utils/pulseSeason.ts, pulseNotices.ts, pulseSky.ts, pulseOccasionTheme.ts.
 * Calendar + ticker + sky — no family-occasion listing on Pulse.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));
const moment = require('moment-hijri');

function assert(cond, message) {
  if (cond) {
    console.log('  ok  ' + message);
    return;
  }
  console.error('  FAIL  ' + message);
  process.exitCode = 1;
}

function latinDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function hijriYmd(hYear, hMonth, hDay) {
  const stamp = moment(`${hYear}/${hMonth}/${hDay}`, 'iYYYY/iM/iD');
  if (!stamp.isValid()) return '';
  return latinDigits(stamp.format('YYYY-MM-DD'));
}

function daysWord(n) {
  if (n === 0) return 'اليوم';
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومان';
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يوم`;
}

function remainingOccasionPhrase(label, days) {
  if (days <= 0) return `${label} اليوم`;
  return `متبقي على ${label} ${daysWord(days)}`;
}

function weatherSkyKind(code) {
  if (code == null) return 'clear';
  if ((code >= 51 && code <= 67) || (code >= 71 && code <= 82) || code >= 95) return 'rain';
  if (code >= 1) return 'cloudy';
  return 'clear';
}

function weatherSkyAssetKey(kind, isNight) {
  if (kind === 'rain') return isNight ? 'nightRain' : 'dayRain';
  if (kind === 'cloudy') return isNight ? 'nightCloudy' : 'dayCloudy';
  return isNight ? 'nightClear' : 'dayClear';
}

function pulseNameBlockedFromTicker(value) {
  const name = String(value || '').trim();
  if (!name) return true;
  return /(^|\s|\/)(بنت|ابنة|ابنت|زوجة|الأم|الام|والدة)(\s|\/|$)/.test(name);
}

function formatPulseNotice(row) {
  if (row.kind === 'dua') return String(row.name || '').trim();
  const name = String(row.name || '').trim();
  if (!name || pulseNameBlockedFromTicker(name)) return '';
  if (row.kind === 'phone') return `تم تسجيل رقم جوال ${name} تستطيع الآن التسجيل برقم جوالك`;
  if (row.kind === 'son') return `تم إضافة الابن ${name}`;
  if (row.kind === 'rename') return `تم تعديل اسم ${name}`;
  const branch = String(row.branchKey || '').trim();
  if (!branch) return `تم إضافة ${name} مندوباً`;
  return `تم إضافة ${name} مندوباً لعائلة ${branch}`;
}

function noticeStillLive(row, now) {
  if (row.kind === 'dua') return true;
  const at = Date.parse(row.at);
  if (!Number.isFinite(at) || now - at < 0) return false;
  if (row.kind === 'delegate') return now - at <= 24 * 60 * 60 * 1000;
  return now - at <= 3 * 60 * 60 * 1000;
}

function pulseHourSlot(now) {
  return Math.floor((now + 3 * 60 * 60 * 1000) / (60 * 60 * 1000));
}

const PULSE_SHORT_DUAS = [
  'اللهم صل وسلم على نبينا محمد',
  'سبحان الله وبحمده سبحان الله العظيم',
  'حسبي الله ونعم الوكيل',
  'رب اغفر لي ولوالدي وللمؤمنين',
  'لا حول ولا قوة إلا بالله',
  'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار',
];

function pickPulseTickerItems(input) {
  const now = input.now ?? Date.now();
  const live = [...(input.notices || []), ...(input.delegates || [])].filter(
    (row) => row.kind !== 'dua' && noticeStillLive(row, now),
  );
  if (live.length) return live;
  const name = PULSE_SHORT_DUAS[Math.abs(pulseHourSlot(now)) % PULSE_SHORT_DUAS.length];
  return [{ kind: 'dua', name }];
}

const schoolStart = { start: '2026-08-16', end: '2026-09-30', label: 'بداية الدراسة' };
const today = '2026-08-27';
const ramadan1447 = hijriYmd(1447, 9, 1);
const nationalDays = Math.round(
  (Date.UTC(2026, 8, 22) - Date.UTC(2026, 7, 27)) / 86400000,
);

console.log('pulse live board smoke');

assert(/^\d{4}-\d{2}-\d{2}$/.test(ramadan1447), 'تاريخ هجري يُحفظ بأرقام لاتينية: ' + ramadan1447);
assert(
  ramadan1447 <= '2026-02-22' && hijriYmd(1447, 9, 30) >= '2026-02-22',
  '٢٢ فبراير ٢٠٢٦ داخل رمضان ١٤٤٧',
);
assert(today >= schoolStart.start && today <= schoolStart.end, '٢٧ أغسطس ٢٠٢٦ داخل بداية الدراسة');
assert(today < '2026-09-22' || today > '2026-09-24', '٢٧ أغسطس ليس نافذة اليوم الوطني');
assert(nationalDays === 26, 'من ٢٧ أغسطس إلى ٢٢ سبتمبر = ٢٦ يومًا: ' + nationalDays);
assert(
  remainingOccasionPhrase('اليوم الوطني', 26) === 'متبقي على اليوم الوطني 26 يوم',
  'عبارة العدّ التنازلي لليوم الوطني',
);
assert(
  remainingOccasionPhrase('اليوم الوطني', 0) === 'اليوم الوطني اليوم',
  'يوم المناسبة نفسها',
);
assert(remainingOccasionPhrase('عيد الفطر', 1) === 'متبقي على عيد الفطر يوم', 'يوم واحد');

assert(weatherSkyKind(0) === 'clear', 'صحو');
assert(weatherSkyKind(3) === 'cloudy', 'غائم');
assert(weatherSkyKind(61) === 'rain', 'مطر');
assert(weatherSkyAssetKey('cloudy', true) === 'nightCloudy', 'ليل غائم = صورة الليل');
assert(weatherSkyAssetKey('clear', false) === 'dayClear', 'نهار صحو = صورة النهار');
assert(weatherSkyAssetKey('rain', true) === 'nightRain', 'ليل ممطر');

const headerAt = new Date('2026-08-27T12:00:00+03:00');
const headerWeekday = new Intl.DateTimeFormat('ar-SA', {
  timeZone: 'Asia/Riyadh',
  weekday: 'long',
}).format(headerAt);
const headerHijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  timeZone: 'Asia/Riyadh',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(headerAt);
const headerGregorian = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
  timeZone: 'Asia/Riyadh',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(headerAt);
assert(headerWeekday.includes('خميس'), '٢٧ أغسطس ٢٠٢٦ يوم الخميس: ' + headerWeekday);
assert(/1448|١٤٤٨/.test(headerHijri), 'التاريخ الهجري لترويسة ٢٧ أغسطس: ' + headerHijri);
assert(/أغسطس/.test(headerGregorian) && /2026|٢٠٢٦/.test(headerGregorian), 'التاريخ الميلادي في الترويسة: ' + headerGregorian);

function riyadhWeekday(at) {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      weekday: 'short',
    }).format(at) || ''
  );
}

function fridaySalawatFromMidnight(at) {
  if (riyadhWeekday(at) !== 'Fri') return null;
  return 'صلوا على محمد';
}

assert(
  fridaySalawatFromMidnight(new Date('2026-08-27T23:59:00+03:00')) === null,
  'الخميس ليلاً قبل ١٢ لا تُظهر الصلاة على النبي',
);
assert(
  fridaySalawatFromMidnight(new Date('2026-08-28T00:00:00+03:00')) === 'صلوا على محمد',
  'من ١٢ ليلاً عند دخول الجمعة: صلوا على محمد',
);
assert(
  fridaySalawatFromMidnight(new Date('2026-08-28T11:00:00+03:00')) === 'صلوا على محمد',
  'الجمعة صباحاً تبقى ظاهرة',
);
assert(
  fridaySalawatFromMidnight(new Date('2026-08-29T00:00:00+03:00')) === null,
  'السبت منتصف الليل تختفي',
);

const now = Date.parse('2026-08-27T12:00:00+03:00');
assert(
  noticeStillLive({ kind: 'phone', at: '2026-08-27T10:00:00+03:00' }, now) === true,
  'إشعار الجوال داخل ثلاث ساعات',
);
assert(
  noticeStillLive({ kind: 'son', at: '2026-08-27T08:00:00+03:00' }, now) === false,
  'إشعار الابن يختفي بعد ثلاث ساعات',
);
assert(
  formatPulseNotice({
    kind: 'phone',
    name: 'ماجد بن طيسان بن حمد',
  }).includes('تستطيع الآن التسجيل برقم جوالك'),
  'نص تسجيل رقم العضو الذكر',
);
assert(
  formatPulseNotice({
    kind: 'phone',
    name: 'نورة بنت محمد',
  }) === '',
  'رقم الابنة لا يظهر في النبض',
);
assert(
  formatPulseNotice({
    kind: 'son',
    name: 'فاطمة بنت عبدالله',
  }) === '',
  'إضافة ابنة لا تظهر في النبض',
);
assert(
  formatPulseNotice({
    kind: 'phone',
    name: 'زوجة محمد بن حمد',
  }) === '',
  'رقم الزوجة لا يظهر في النبض',
);
assert(
  formatPulseNotice({
    kind: 'phone',
    name: 'والدة ماجد بن محمد',
  }) === '',
  'رقم الأم لا يظهر في النبض',
);
assert(
  formatPulseNotice({
    kind: 'delegate',
    name: 'حسن بن مزيد',
    branchKey: 'مزيد',
  }) === 'تم إضافة حسن بن مزيد مندوباً لعائلة مزيد',
  'نص إضافة مندوب ليوم واحد',
);
assert(
  noticeStillLive(
    { kind: 'delegate', at: '2026-08-26T12:00:00+03:00' },
    now,
  ) === true,
  'إضافة مندوب تبقى يوماً',
);
assert(
  noticeStillLive(
    { kind: 'delegate', at: '2026-08-25T11:00:00+03:00' },
    now,
  ) === false,
  'إضافة مندوب تختفي بعد يوم',
);
assert(
  pickPulseTickerItems({ notices: [], delegates: [], now }).length === 1,
  'دعاء واحد في الساعة لا قائمة سريعة',
);
assert(
  pickPulseTickerItems({ notices: [], delegates: [], now })[0]?.name ===
    pickPulseTickerItems({ notices: [], delegates: [], now: now + 59 * 60 * 1000 })[0]?.name,
  'الدعاء نفسه يبقى داخل الساعة',
);
assert(
  pickPulseTickerItems({ notices: [], delegates: [], now })[0]?.name !==
    pickPulseTickerItems({ notices: [], delegates: [], now: now + 60 * 60 * 1000 })[0]?.name,
  'الدعاء يتغير بعد ساعة',
);
assert(
  pickPulseTickerItems({
    notices: [],
    delegates: [{ kind: 'delegate', name: 'مشاري', branchKey: 'لاحم' }],
    now,
  })[0]?.kind === 'dua',
  'مندوب بلا تاريخ إضافة لا يُدار في الشريط',
);

function occasionMotif(id) {
  if (id === 'national') return 'national_flag';
  if (id === 'founding') return 'founding';
  if (id === 'ramadan') return 'ramadan';
  if (id === 'eid_fitr' || id === 'eid_adha') return 'eid';
  if (id === 'hajj_ten') return 'hajj';
  if (id === 'school_start') return 'school';
  return 'plain';
}

function pulseTickerKindLabel(kind) {
  if (kind === 'phone' || kind === 'son') return 'إضافة';
  if (kind === 'rename') return 'تعديل';
  if (kind === 'delegate') return 'مندوب';
  if (kind === 'dua') return 'دعاء';
  return '';
}

assert(occasionMotif('national') === 'national_flag', 'اليوم الوطني = علم السعودية');
assert(occasionMotif('ramadan') === 'ramadan', 'رمضان = هلال ونجوم');
assert(occasionMotif('eid_fitr') === 'eid', 'عيد الفطر = شموع وأعلام');
assert(occasionMotif('eid_adha') === 'eid', 'عيد الأضحى = شموع وأعلام');
assert(pulseTickerKindLabel('son') === 'إضافة', 'خبر الإضافة');
assert(pulseTickerKindLabel('rename') === 'تعديل', 'خبر التعديل');
assert(pulseTickerKindLabel('delegate') === 'مندوب', 'خبر إضافة مندوب');
assert(pulseTickerKindLabel('dua') === 'دعاء', 'خبر الدعاء');

if (process.exitCode) {
  console.error('pulse live board smoke failed');
  process.exit(1);
}
console.log('pulse live board smoke passed');
