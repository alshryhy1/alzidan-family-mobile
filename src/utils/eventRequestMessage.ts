export type EventFamily = 'happy' | 'health' | 'death';

export type MobileEventType = {
  key: string;
  label: string;
  adminTypeLabel: string;
  family: EventFamily;
  personLabel: string;
};

export const MOBILE_EVENT_TYPES: MobileEventType[] = [
  { key: 'birth', label: 'عقيقة مولود', adminTypeLabel: 'مولود', family: 'happy', personLabel: 'اسم المولود' },
  { key: 'marriage', label: 'زواج', adminTypeLabel: 'زواج', family: 'happy', personLabel: 'اسم العريس' },
  { key: 'graduation', label: 'حفل تخرج', adminTypeLabel: 'تخرج', family: 'happy', personLabel: 'اسم الخريج' },
  { key: 'promotion', label: 'حفل ترقية', adminTypeLabel: 'ترقية', family: 'happy', personLabel: 'اسم صاحب الترقية' },
  { key: 'new_house', label: 'منزل جديد', adminTypeLabel: 'منزل جديد', family: 'happy', personLabel: 'اسم صاحب المنزل' },
  { key: 'gathering', label: 'اجتماع عائلي', adminTypeLabel: 'اجتماع', family: 'happy', personLabel: 'اسم الداعي' },
  { key: 'general', label: 'مناسبة عامة', adminTypeLabel: 'مناسبة عامة', family: 'happy', personLabel: 'اسم صاحب المناسبة' },
  { key: 'sick', label: 'مريض', adminTypeLabel: 'مريض', family: 'health', personLabel: 'اسم المريض' },
  { key: 'operation', label: 'عملية', adminTypeLabel: 'عملية', family: 'health', personLabel: 'اسم المريض' },
  { key: 'discharge', label: 'خروج من المستشفى', adminTypeLabel: 'خروج من المستشفى', family: 'health', personLabel: 'اسم المريض' },
  { key: 'death', label: 'وفاة', adminTypeLabel: 'وفاة', family: 'death', personLabel: 'اسم المتوفى' },
];

export function findMobileEventType(key: string) {
  return MOBILE_EVENT_TYPES.find((item) => item.key === key) ?? MOBILE_EVENT_TYPES[0];
}

export function eventFamilyOf(type: string): EventFamily {
  return findMobileEventType(type).family;
}

type EventRequestFacts = {
  branch: string;
  type: string;
  typeLabel: string;
  person: string;
  dateLabel: string;
  place: string;
  hospitalName: string;
  hospitalDept: string;
  contactPhone: string;
  prayerPlace: string;
  prayerTime: string;
  burialPlace: string;
  condolencePlace: string;
  text: string;
  imageUrl: string;
  videoUrl: string;
  pickedImageName: string;
  pickedVideoName: string;
  submitterName: string;
  submitterPhone: string;
  requestId: string;
  createdAt: string;
};

export function toIsoDateOrEmpty(value: string) {
  const raw = String(value || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim()
    .replace(/[.\s]+/g, '/');
  if (!raw) return '';
  let y: number | null = null;
  let m: number | null = null;
  let d: number | null = null;
  let mm = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (mm) {
    y = parseInt(mm[1], 10);
    m = parseInt(mm[2], 10);
    d = parseInt(mm[3], 10);
  } else {
    mm = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (mm) {
      d = parseInt(mm[1], 10);
      m = parseInt(mm[2], 10);
      y = parseInt(mm[3], 10);
    }
  }
  if (!y || !m || !d) return '';
  if (y < 1800 || y > 2100) return '';
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return '';
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function validateEventFacts(input: {
  type: string;
  person: string;
  dateLabel: string;
  text: string;
}) {
  const family = eventFamilyOf(input.type);
  if (!input.person.trim()) {
    if (family === 'death') return 'اكتب اسم المتوفى.';
    if (family === 'health') return 'اكتب اسم المريض.';
    return 'اكتب الاسم المطلوب لهذا النوع.';
  }
  if (!input.dateLabel.trim()) {
    if (family === 'death') return 'تاريخ الوفاة مطلوب. بدونه لا يُحدد وقت الظهور.';
    if (family === 'health') return 'تاريخ الحالة مطلوب. بدونه لا يُحدد وقت الظهور.';
    return 'تاريخ المناسبة مطلوب. بدونه لا يُحدد وقت الظهور.';
  }
  if (family === 'happy' && !input.text.trim()) {
    return 'اكتب نص المناسبة.';
  }
  return '';
}

export function buildMobileEventRequestMessage(input: EventRequestFacts) {
  const family = eventFamilyOf(input.type);
  const typeMeta = findMobileEventType(input.type);
  const person = input.person.trim();
  const dateLabel = input.dateLabel.trim();
  const place = input.place.trim();
  const hospitalName = input.hospitalName.trim() || (family === 'health' ? place : '');
  const hospitalDept = input.hospitalDept.trim();
  const condolencePlace = input.condolencePlace.trim() || (family === 'death' ? place : '');
  const notes = input.text.trim();
  const eventDateIso = toIsoDateOrEmpty(dateLabel);
  const lines: string[] = [];

  if (family === 'death') {
    lines.push('طلب نشر إعلان وفاة في تطبيق عائلة الزيدان');
  } else if (family === 'health') {
    lines.push('طلب نشر حالة مرضية في تطبيق عائلة الزيدان');
  } else {
    lines.push('طلب نشر مناسبة في تطبيق عائلة الزيدان');
  }

  lines.push(`رقم الطلب: ${input.requestId}`);
  lines.push(`الفرع: ${input.branch}`);
  lines.push(`النوع: ${typeMeta.adminTypeLabel}`);

  if (family === 'death') {
    lines.push(`اسم المتوفى: ${person}`);
    lines.push(`صاحب المناسبة: ${person}`);
  } else if (family === 'health') {
    lines.push(`نوع الحالة: ${typeMeta.adminTypeLabel}`);
    lines.push(`اسم المريض: ${person}`);
    lines.push(`صاحب المناسبة: ${person}`);
  } else {
    lines.push(`نوع المناسبة: ${typeMeta.adminTypeLabel}`);
    lines.push(`${typeMeta.personLabel}: ${person}`);
    lines.push(`صاحب المناسبة: ${person}`);
  }

  if (dateLabel) lines.push(`التاريخ: ${dateLabel}`);

  if (family === 'health') {
    if (hospitalName) lines.push(`المستشفى / المكان: ${hospitalName}`);
    if (hospitalDept) lines.push(`القسم: ${hospitalDept}`);
    if (input.contactPhone.trim()) lines.push(`جوال التواصل: ${input.contactPhone.trim()}`);
  } else if (family === 'death') {
    if (condolencePlace) lines.push(`موقع العزاء: ${condolencePlace}`);
    if (input.prayerPlace.trim()) lines.push(`مكان الصلاة: ${input.prayerPlace.trim()}`);
    if (input.prayerTime.trim()) lines.push(`وقت الصلاة: ${input.prayerTime.trim()}`);
    if (input.burialPlace.trim()) lines.push(`مكان الدفن: ${input.burialPlace.trim()}`);
  } else if (place) {
    lines.push(`المكان: ${place}`);
  }

  if (family === 'happy') {
    if (input.imageUrl) lines.push(`رابط الصورة: ${input.imageUrl}`);
    if (input.videoUrl) lines.push(`رابط الفيديو: ${input.videoUrl}`);
    if (input.pickedImageName) lines.push(`صورة مختارة من التطبيق: ${input.pickedImageName}`);
    if (input.pickedVideoName) lines.push(`فيديو مختار من التطبيق: ${input.pickedVideoName}`);
  }

  lines.push(family === 'happy' ? `النص: ${notes}` : `الملاحظات: ${notes}`);
  lines.push(`المرسل: ${input.submitterName}`);
  lines.push(`الجوال: ${input.submitterPhone}`);

  const details =
    family === 'death'
      ? {
          v: 1,
          kind: 'death_notice',
          requestId: input.requestId,
          notes,
          condolencePlace,
          prayerPlace: input.prayerPlace.trim(),
          prayerTime: input.prayerTime.trim(),
          burialPlace: input.burialPlace.trim(),
          phones: input.contactPhone.trim() ? [input.contactPhone.trim()] : [],
          showDays: 7,
        }
      : family === 'health'
        ? {
            v: 1,
            kind: 'health_notice',
            requestId: input.requestId,
            notes,
            hospitalName,
            hospitalDept,
            showDays: 7,
          }
        : {
            v: 1,
            kind: 'happy_notice',
            requestId: input.requestId,
            text: notes,
            imageUrl: input.imageUrl,
            videoUrl: input.videoUrl,
            place,
            showDays: 7,
          };

  const envelope = {
    v: 1,
    kind: 'event_card',
    source: 'mobile_app',
    event: {
      type: input.type,
      typeLabel: typeMeta.adminTypeLabel,
      branch_key: input.branch,
      person,
      date_label: dateLabel,
      event_date: eventDateIso,
      created_at: input.createdAt,
      hospital_name: family === 'health' ? hospitalName : '',
      hospital_dept: family === 'health' ? hospitalDept : '',
      contact_phone: input.contactPhone.trim() || input.submitterPhone,
      details,
    },
    submitter: {
      name: input.submitterName,
      phone: input.submitterPhone,
    },
  };

  lines.push('__JSON__:');
  lines.push(JSON.stringify(envelope));
  return lines.filter((line, index) => line || index === 0).join('\n');
}
