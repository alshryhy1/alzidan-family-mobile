/**
 * اختبار ثابت لمنطق formatFormalNotificationText (pushNotifications.ts)
 */

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeType(value) {
  return normalizeText(value).toLowerCase();
}

function formatFormalNotificationText(input) {
  const type = normalizeType(input.type);
  const person = normalizeText(input.person);
  const fallbackTitle = normalizeText(input.fallbackTitle) || 'إشعار جديد';
  const fallbackBody = normalizeText(input.fallbackBody) || 'ورد إشعار جديد في تطبيق عائلة الزيدان.';

  if (type === 'birth') {
    const subject = person ? `صدور إشعار مولود جديد يخص: ${person}` : 'صدور إشعار مولود جديد';
    return { typeLabel: 'إشعار مولود جديد', subject, title: `إشعار مولود جديد — ${subject}` };
  }
  if (type === 'death') {
    const subject = person ? `صدور إشعار وفاة يخص: ${person}` : 'صدور إشعار وفاة';
    return { typeLabel: 'إشعار وفاة', subject, title: `إشعار وفاة — ${subject}` };
  }
  if (type === 'sick') {
    const subject = person ? `صدور إشعار حالة صحية يخص: ${person}` : 'صدور إشعار حالة صحية';
    return { typeLabel: 'إشعار حالة صحية', subject, title: `إشعار حالة صحية — ${subject}` };
  }
  const defaultSubject = person ? `صدور إشعار مناسبة يخص: ${person}` : 'صدور إشعار مناسبة';
  return {
    typeLabel: 'إشعار مناسبة',
    subject: defaultSubject,
    title: fallbackTitle === 'إشعار جديد' ? `إشعار مناسبة — ${defaultSubject}` : fallbackTitle,
  };
}

function formatFormalNotificationFromPayload(payload) {
  const data = payload.data || {};
  const person = normalizeText(data.person || data.name || '');
  const type = normalizeText(data.type || data.event_type || data.kind || '');
  return formatFormalNotificationText({
    type,
    person,
    fallbackTitle: payload.title,
    fallbackBody: payload.body,
  });
}

const checks = [
  [
    'birth with person',
    formatFormalNotificationFromPayload({
      title: 'x',
      body: 'y',
      data: { type: 'birth', person: 'محمد' },
    }).typeLabel === 'إشعار مولود جديد',
  ],
  [
    'death with person',
    formatFormalNotificationFromPayload({
      data: { type: 'death', name: 'علي' },
    }).typeLabel === 'إشعار وفاة',
  ],
  [
    'sick maps health',
    formatFormalNotificationFromPayload({
      data: { event_type: 'sick', person: 'فهد' },
    }).typeLabel === 'إشعار حالة صحية',
  ],
  [
    'unknown type → مناسبة',
    formatFormalNotificationFromPayload({
      data: { type: 'marriage', person: 'نورة' },
    }).typeLabel === 'إشعار مناسبة',
  ],
  [
    'title includes subject',
    formatFormalNotificationFromPayload({
      data: { type: 'birth', person: 'سعد' },
    }).title.includes('سعد'),
  ],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'}: ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed} فحص(فحوص) فشل.`);
  process.exit(1);
}

console.log(`\nنجح التحقق: ${checks.length} فحص لتنسيق الإشعارات.`);
