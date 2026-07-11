/**
 * يتحقق أن رسالة event_card من EventsScreen تُفسَّر بشكل صحيح في Admin buildEventCardRow.
 * منطق Admin من assets/js/modules/request-actions.js
 */

function normalizeTreeCardText(v) {
  return String(v || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRequestMediaLinks(message) {
  const media = { image: '', video: '' };
  String(message || '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();
      const imageMatch = line.match(/^رابط الصورة\s*:\s*(https?:\/\/\S+)/i);
      const videoMatch = line.match(/^رابط الفيديو\s*:\s*(https?:\/\/\S+)/i);
      if (imageMatch && !media.image) media.image = imageMatch[1];
      if (videoMatch && !media.video) media.video = videoMatch[1];
    });
  return media;
}

function requestLineValue(message, labels) {
  const list = Array.isArray(labels) ? labels : [labels];
  for (const rawLine of String(message || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    for (const label of list) {
      const prefix = `${label}:`;
      if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
    }
  }
  return '';
}

function eventTypeFromLabel(label) {
  const s = normalizeTreeCardText(label || '');
  if (s === 'مولود') return 'birth';
  if (s === 'زواج') return 'marriage';
  if (s === 'تخرج') return 'graduation';
  if (s === 'ترقية') return 'promotion';
  if (s === 'اجتماع') return 'gathering';
  if (s === 'مريض') return 'sick';
  if (s === 'وفاة') return 'death';
  return 'gathering';
}

function buildEventCardRow(row) {
  const requestId = String(row?.request_id ?? '').trim();
  const msg = String(row?.message ?? '');
  const media = extractRequestMediaLinks(msg);
  const typeLabel = requestLineValue(msg, ['نوع المناسبة', 'النوع']);
  const text = requestLineValue(msg, ['النص']);
  const details = {
    v: 1,
    kind: 'happy_notice',
    requestId,
    text,
    imageUrl: media.image,
    videoUrl: media.video,
    showDays: 7,
  };
  return {
    branch_key: normalizeTreeCardText(row.branch_key || requestLineValue(msg, 'الفرع')),
    type: eventTypeFromLabel(typeLabel),
    person:
      requestLineValue(msg, ['اسم صاحب المناسبة', 'صاحب المناسبة']) || String(row.name || ''),
    date_label: requestLineValue(msg, 'التاريخ'),
    event_date: '',
    details: JSON.stringify(details),
    contact_phone: String(row.phone || ''),
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

function buildEventRequestMessage(payload) {
  return [
    'طلب إضافة مناسبة من تطبيق عائلة الزيدان',
    `الفرع: ${payload.branch}`,
    `النوع: ${payload.adminTypeLabel}`,
    `صاحب المناسبة: ${payload.person}`,
    payload.dateLabel ? `التاريخ: ${payload.dateLabel}` : '',
    payload.imageUrl ? `رابط الصورة: ${payload.imageUrl}` : '',
    payload.videoUrl ? `رابط الفيديو: ${payload.videoUrl}` : '',
    `النص: ${payload.text}`,
    `المرسل: ${payload.submitterName}`,
    `الجوال: ${payload.phone}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const ADMIN_EVENT_TYPE_LABELS = {
  birth: 'مولود',
  marriage: 'زواج',
  graduation: 'تخرج',
  promotion: 'ترقية',
  new_house: 'اجتماع',
  gathering: 'اجتماع',
  general: 'اجتماع',
};

const samples = [
  { key: 'birth', person: 'أحمد', expectedType: 'birth' },
  { key: 'marriage', person: 'سارة', expectedType: 'marriage' },
  { key: 'graduation', person: 'خالد', expectedType: 'graduation' },
  { key: 'promotion', person: 'نورة', expectedType: 'promotion' },
];

let failed = 0;

for (const sample of samples) {
  const message = buildEventRequestMessage({
    branch: 'زيدان',
    adminTypeLabel: ADMIN_EVENT_TYPE_LABELS[sample.key],
    person: sample.person,
    dateLabel: '2026-07-01',
    imageUrl: 'https://example.com/img.jpg',
    videoUrl: '',
    text: 'نص تجريبي',
    submitterName: 'مرسل',
    phone: '0500000000',
  });
  const row = {
    request_id: 'EVAPP-TEST-001',
    branch_key: 'زيدان',
    name: 'مرسل',
    phone: '0500000000',
    message,
    created_at: new Date().toISOString(),
  };
  const built = buildEventCardRow(row);
  const ok =
    built.branch_key === 'زيدان' &&
    built.type === sample.expectedType &&
    built.person === sample.person &&
    JSON.parse(built.details).imageUrl === 'https://example.com/img.jpg';
  console.log(`${ok ? 'OK' : 'FAIL'}: event_card type ${sample.key} → ${built.type}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed} عينة فشلت.`);
  process.exit(1);
}

console.log(`\nنجح التحقق: ${samples.length} عينة event_card متوافقة مع Admin.`);
