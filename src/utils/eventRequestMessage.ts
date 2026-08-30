export type EventFamily = 'news' | 'health' | 'death' | 'occasion';
export type MobileEventFamily = EventFamily;

export type MobileEventType = {
  key: string;
  label: string;
  adminTypeLabel: string;
  family: EventFamily;
  personLabel: string;
  /** notice = تهنئة/خبر/صحة/وفاة؛ occasion = مناسبة بموعد */
  mode: 'notice' | 'occasion';
  requiresDate?: boolean;
  requiresTime?: boolean;
  requiresPlace?: boolean;
  requiresPlaceKind?: boolean;
};

export const EVENT_FAMILIES: { key: EventFamily; label: string }[] = [
  { key: 'news', label: 'تهاني وأخبار' },
  { key: 'health', label: 'صحة وعافية' },
  { key: 'death', label: 'وفاة وتعزية' },
  { key: 'occasion', label: 'مناسبات ودعوات' },
];

export const MOBILE_EVENT_FAMILIES = EVENT_FAMILIES;

/** كتالوج موحّد مع الويب — بدون جدول Supabase. */
export const MOBILE_EVENT_TYPES: MobileEventType[] = [
  // تهاني وأخبار
  { key: 'promotion_notice', label: 'ترقية', adminTypeLabel: 'ترقية', family: 'news', personLabel: 'اسم المُهنَّأ', mode: 'notice' },
  { key: 'graduation_notice', label: 'تخرج', adminTypeLabel: 'تخرج', family: 'news', personLabel: 'اسم الخريج', mode: 'notice' },
  { key: 'success', label: 'نجاح', adminTypeLabel: 'نجاح', family: 'news', personLabel: 'اسم المُهنَّأ', mode: 'notice' },
  { key: 'marriage', label: 'زواج', adminTypeLabel: 'زواج', family: 'news', personLabel: 'اسم العريس/العروسين', mode: 'notice' },
  { key: 'birth', label: 'مولود جديد', adminTypeLabel: 'مولود جديد', family: 'news', personLabel: 'اسم المولود أو الأب', mode: 'notice' },
  { key: 'achievement', label: 'تكريم وإنجاز', adminTypeLabel: 'تكريم وإنجاز', family: 'news', personLabel: 'اسم صاحب الإنجاز', mode: 'notice' },
  { key: 'appointment', label: 'تعيين / منصب', adminTypeLabel: 'تعيين / منصب', family: 'news', personLabel: 'اسم المعيَّن', mode: 'notice' },
  { key: 'retirement_notice', label: 'تقاعد', adminTypeLabel: 'تقاعد', family: 'news', personLabel: 'اسم المتقاعد', mode: 'notice' },
  { key: 'certification', label: 'شهادة / اعتماد', adminTypeLabel: 'شهادة / اعتماد', family: 'news', personLabel: 'اسم الحاصل على الشهادة', mode: 'notice' },
  { key: 'new_house', label: 'منزل جديد', adminTypeLabel: 'منزل جديد', family: 'news', personLabel: 'اسم صاحب المنزل', mode: 'notice' },
  { key: 'family_news', label: 'خبر عائلي', adminTypeLabel: 'خبر عائلي', family: 'news', personLabel: 'الاسم المرتبط بالخبر', mode: 'notice' },

  // صحة
  { key: 'sick', label: 'مريض', adminTypeLabel: 'مريض', family: 'health', personLabel: 'اسم المريض', mode: 'notice' },
  { key: 'operation', label: 'عملية', adminTypeLabel: 'عملية', family: 'health', personLabel: 'اسم المريض', mode: 'notice' },
  { key: 'healing', label: 'شفاء', adminTypeLabel: 'شفاء', family: 'health', personLabel: 'اسم المتعافي', mode: 'notice' },
  { key: 'discharge', label: 'خروج من المستشفى', adminTypeLabel: 'خروج من المستشفى', family: 'health', personLabel: 'اسم المريض', mode: 'notice' },
  { key: 'safety', label: 'سلامة', adminTypeLabel: 'سلامة', family: 'health', personLabel: 'اسم الشخص', mode: 'notice' },

  // وفاة وتعزية
  { key: 'death', label: 'إعلان وفاة', adminTypeLabel: 'إعلان وفاة', family: 'death', personLabel: 'اسم المتوفى', mode: 'notice' },
  { key: 'condolence', label: 'تعزية', adminTypeLabel: 'تعزية', family: 'death', personLabel: 'اسم المتوفى / أهل الفقيد', mode: 'notice' },

  // مناسبات ودعوات
  { key: 'wedding', label: 'حفل زواج', adminTypeLabel: 'حفل زواج', family: 'occasion', personLabel: 'اسم العريس', mode: 'occasion', requiresDate: true, requiresTime: true, requiresPlace: true },
  { key: 'contract', label: 'عقد قران', adminTypeLabel: 'عقد قران', family: 'occasion', personLabel: 'اسم العريس', mode: 'occasion', requiresDate: true, requiresPlace: true },
  { key: 'graduation', label: 'حفل تخرج', adminTypeLabel: 'حفل تخرج', family: 'occasion', personLabel: 'اسم الخريج', mode: 'occasion', requiresDate: true },
  { key: 'aqiqa', label: 'عقيقة', adminTypeLabel: 'عقيقة', family: 'occasion', personLabel: 'اسم المولود / الأب', mode: 'occasion', requiresDate: true },
  { key: 'feast', label: 'وليمة', adminTypeLabel: 'وليمة', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true, requiresTime: true },
  { key: 'gathering', label: 'اجتماع عائلي', adminTypeLabel: 'اجتماع عائلي', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true, requiresTime: true },
  { key: 'family_meetup', label: 'لقاء عائلي', adminTypeLabel: 'لقاء عائلي', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true, requiresTime: true },
  { key: 'promotion', label: 'حفل ترقية', adminTypeLabel: 'حفل ترقية', family: 'occasion', personLabel: 'اسم صاحب الحفل', mode: 'occasion', requiresDate: true, requiresPlace: true },
  { key: 'retirement', label: 'حفل تقاعد', adminTypeLabel: 'حفل تقاعد', family: 'occasion', personLabel: 'اسم المتقاعد', mode: 'occasion', requiresDate: true },
  { key: 'dinner', label: 'دعوة عشاء', adminTypeLabel: 'دعوة عشاء', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true, requiresTime: true },
  { key: 'lunch', label: 'دعوة غداء', adminTypeLabel: 'دعوة غداء', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true, requiresTime: true },
  { key: 'finjal_asr', label: 'فنجال بعد صلاة العصر', adminTypeLabel: 'فنجال بعد صلاة العصر', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true },
  { key: 'finjal_isha', label: 'فنجال بعد صلاة العشاء', adminTypeLabel: 'فنجال بعد صلاة العشاء', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true },
  { key: 'finjal_hawlna', label: 'فنجال والم اللي حولنا', adminTypeLabel: 'فنجال والم اللي حولنا', family: 'occasion', personLabel: 'اسم الداعي', mode: 'occasion', requiresDate: true, requiresTime: true },
  { key: 'general', label: 'مناسبة عامة', adminTypeLabel: 'مناسبة عامة', family: 'occasion', personLabel: 'اسم صاحب المناسبة', mode: 'occasion', requiresDate: true },
];

export function findMobileEventType(key: string) {
  const normalized = normalizeMobileEventType(key);
  return (
    MOBILE_EVENT_TYPES.find((item) => item.key === normalized) ||
    MOBILE_EVENT_TYPES.find((item) => item.key === 'general') ||
    MOBILE_EVENT_TYPES[0]
  );
}

export function listMobileEventTypesByFamily(family: EventFamily) {
  return MOBILE_EVENT_TYPES.filter((item) => item.family === family);
}

export function eventFamilyOf(type: string): EventFamily {
  return findMobileEventType(type).family;
}

export function isNoticeEventType(type: string) {
  return findMobileEventType(type).mode === 'notice';
}

const TYPE_ALIASES: Record<string, string> = {
  invitation: 'dinner',
  meeting: 'gathering',
  engagement: 'marriage',
  congratulation: 'family_news',
  travel: 'family_news',
  happy: 'family_news',
  other: 'general',
  'اجتماع عائلي': 'gathering',
  اجتماع: 'gathering',
  'لقاء عائلي': 'family_meetup',
  'دعوة عائلية': 'dinner',
  دعوة: 'dinner',
  'دعوة عشاء': 'dinner',
  'دعوة غداء': 'lunch',
  وليمة: 'feast',
  'فنجال بعد صلاة العصر': 'finjal_asr',
  'فنجال العصر': 'finjal_asr',
  'فنجال بعد صلاة العشاء': 'finjal_isha',
  'فنجال بعد صلاه العشاء': 'finjal_isha',
  'فنجال العشاء': 'finjal_isha',
  'فنجال والم اللي حولنا': 'finjal_hawlna',
  'فنجال والم الي حولنا': 'finjal_hawlna',
  'مناسبة عامة': 'general',
  'حفل زواج': 'wedding',
  'عقد قران': 'contract',
  زواج: 'marriage',
  'مولود جديد': 'birth',
  مولود: 'birth',
  'حفل تخرج': 'graduation',
  تخرج: 'graduation_notice',
  'حفل ترقية': 'promotion',
  ترقية: 'promotion_notice',
  'حفل تقاعد': 'retirement',
  تقاعد: 'retirement_notice',
  عقيقة: 'aqiqa',
  وفاة: 'death',
  تعزية: 'condolence',
};

export function normalizeMobileEventType(raw?: string | null) {
  const key = String(raw || '').trim();
  if (!key) return 'general';
  const lower = key.toLowerCase();
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
  if (TYPE_ALIASES[lower]) return TYPE_ALIASES[lower];
  if (MOBILE_EVENT_TYPES.some((item) => item.key === lower)) return lower;
  const byLabel = MOBILE_EVENT_TYPES.find(
    (item) => item.label === key || item.adminTypeLabel === key,
  );
  return byLabel ? byLabel.key : lower;
}

export function eventRequiresDate(type: string) {
  const meta = findMobileEventType(type);
  if (meta.requiresDate != null) return !!meta.requiresDate;
  return meta.mode === 'occasion';
}

export function eventRequiresPlace(type: string) {
  return !!findMobileEventType(type).requiresPlace;
}

export function eventRequiresPlaceKind(type: string) {
  return !!findMobileEventType(type).requiresPlaceKind;
}

export function eventRequiresTime(type: string) {
  return !!findMobileEventType(type).requiresTime;
}

export const EVENT_PLACE_KINDS: Array<{ key: string; label: string }> = [
  { key: 'home', label: 'بالمنزل' },
  { key: 'farm', label: 'بالمزرعة' },
  { key: 'desert', label: 'بالبر' },
  { key: 'resthouse', label: 'بالاستراحة' },
];

const PLACE_KIND_ALIASES: Record<string, string> = {
  home: 'home',
  بالمنزل: 'home',
  المنزل: 'home',
  منزل: 'home',
  farm: 'farm',
  بالمزرعة: 'farm',
  المزرعة: 'farm',
  مزرعة: 'farm',
  desert: 'desert',
  بالبر: 'desert',
  البر: 'desert',
  بر: 'desert',
  resthouse: 'resthouse',
  بالاستراحة: 'resthouse',
  الاستراحة: 'resthouse',
  استراحة: 'resthouse',
};

export function normalizePlaceKind(raw?: string | null) {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (EVENT_PLACE_KINDS.some((item) => item.key === key)) return key;
  return PLACE_KIND_ALIASES[key] || PLACE_KIND_ALIASES[key.toLowerCase()] || '';
}

export function placeKindArabicLabel(kind?: string | null) {
  const key = normalizePlaceKind(kind);
  return EVENT_PLACE_KINDS.find((item) => item.key === key)?.label || '';
}

export function parseCoordinates(raw?: string | null) {
  const s = String(raw || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();
  if (!s) return null;
  const m =
    s.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/) ||
    s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ||
    s.match(/geo:(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ||
    s.match(/^(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

export function mapsUrlFromCoords(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return '';
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  return `https://maps.google.com/?q=${a},${b}`;
}

export function eventTextIsTypeEcho(type: string, text: string) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return true;
  const meta = findMobileEventType(type);
  return t === meta.label || t === meta.adminTypeLabel || t === meta.key || t === String(type || '').trim();
}

export function newsIncidentDateIsPlausible(dateValue: string, createdAt?: string | null) {
  const iso = toIsoDateOrEmpty(dateValue);
  if (!iso) return false;
  const day = Date.parse(`${iso}T12:00:00`);
  if (!Number.isFinite(day)) return false;
  const createdMs = createdAt ? Date.parse(String(createdAt)) : Date.now();
  const created = Number.isFinite(createdMs) ? createdMs : Date.now();
  const createdDay = new Date(created);
  createdDay.setHours(12, 0, 0, 0);
  const incident = new Date(day);
  incident.setHours(12, 0, 0, 0);
  const diffDays = Math.round((createdDay.getTime() - incident.getTime()) / 86400000);
  return diffDays >= -1 && diffDays <= 30;
}

export function formatVenueLine(input: {
  placeKind?: string | null;
  extra?: string | null;
  place?: string | null;
}) {
  const kindLabel = placeKindArabicLabel(input.placeKind);
  const extra = String(input.extra || input.place || '').trim();
  return [kindLabel, extra].filter(Boolean).join(' — ');
}

/** محتوى إعلامي يسمح بصورة/فيديو (تهاني + مناسبات). */
export function eventAllowsMedia(type: string) {
  const family = eventFamilyOf(type);
  return family === 'news' || family === 'occasion';
}

type EventRequestFacts = {
  branch: string;
  type: string;
  typeLabel: string;
  person: string;
  dateLabel: string;
  place: string;
  placeKind?: string;
  coords?: string;
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
  place?: string;
  placeKind?: string;
  coords?: string;
  text: string;
}) {
  const family = eventFamilyOf(input.type);
  if (!input.person.trim()) {
    if (family === 'death') return 'اكتب اسم المتوفى أو أهل الفقيد.';
    if (family === 'health') return 'اكتب اسم المريض.';
    return 'اكتب الاسم المطلوب لهذا النوع.';
  }
  if (eventRequiresDate(input.type) && !input.dateLabel.trim()) {
    return 'تاريخ المناسبة مطلوب.';
  }
  if (eventRequiresPlaceKind(input.type) && !normalizePlaceKind(input.placeKind)) {
    return 'اختر نوع الموقع: بالمنزل أو المزرعة أو البر أو الاستراحة.';
  }
  if (eventRequiresPlace(input.type) && !eventRequiresPlaceKind(input.type) && !String(input.place || '').trim()) {
    return 'المكان مطلوب لهذا النوع.';
  }
  if (String(input.coords || '').trim() && !parseCoordinates(input.coords)) {
    return 'الإحداثيات غير صحيحة. اكتب مثل: 24.7136, 46.6753 أو الصق رابط خرائط.';
  }
  if ((family === 'news' || family === 'occasion') && !input.text.trim()) {
    if (family === 'occasion') return 'اكتب نص المناسبة.';
  }
  return '';
}

export function buildMobileEventRequestMessage(input: EventRequestFacts) {
  const family = eventFamilyOf(input.type);
  const typeMeta = findMobileEventType(input.type);
  const notice = typeMeta.mode === 'notice';
  const person = input.person.trim();
  const dateLabel = input.dateLabel.trim();
  const place = input.place.trim();
  const placeKind = normalizePlaceKind(input.placeKind);
  const coords = parseCoordinates(input.coords);
  const hospitalName = input.hospitalName.trim() || (family === 'health' ? place : '');
  const hospitalDept = input.hospitalDept.trim();
  const condolencePlace = input.condolencePlace.trim() || (family === 'death' ? place : '');
  const notes = input.text.trim();
  const eventDateIso = toIsoDateOrEmpty(dateLabel);
  const lines: string[] = [];

  if (family === 'death') {
    lines.push(
      typeMeta.key === 'condolence'
        ? 'طلب نشر تعزية في تطبيق عائلة الزيدان'
        : 'طلب نشر إعلان وفاة في تطبيق عائلة الزيدان',
    );
  } else if (family === 'health') {
    lines.push('طلب نشر خبر صحي في تطبيق عائلة الزيدان');
  } else if (notice) {
    lines.push('طلب نشر تهنئة / خبر عائلي في تطبيق عائلة الزيدان');
  } else {
    lines.push('طلب نشر مناسبة في تطبيق عائلة الزيدان');
  }

  lines.push(`رقم الطلب: ${input.requestId}`);
  lines.push(`الفرع: ${input.branch}`);
  lines.push(`النوع: ${typeMeta.adminTypeLabel}`);
  if (notice) lines.push('التصنيف: خبر/تهنئة (بدون اشتراط موعد حفل)');

  if (family === 'death') {
    lines.push(`الاسم: ${person}`);
  } else if (family === 'health') {
    lines.push(`اسم المريض: ${person}`);
  } else {
    lines.push(`${typeMeta.personLabel}: ${person}`);
  }

  if (dateLabel) {
    if (typeMeta.key === 'birth') lines.push(`تاريخ الولادة: ${dateLabel}`);
    else if (family === 'health') lines.push(`تاريخ الحالة: ${dateLabel}`);
    else if (family === 'death') lines.push(`تاريخ الوفاة: ${dateLabel}`);
    else if (notice) lines.push(`تاريخ الخبر: ${dateLabel}`);
    else lines.push(`التاريخ: ${dateLabel}`);
  }
  if (family === 'health') {
    if (hospitalName) lines.push(`المستشفى / المكان: ${hospitalName}`);
    if (hospitalDept) lines.push(`القسم: ${hospitalDept}`);
  } else if (family === 'death') {
    if (condolencePlace) lines.push(`مكان العزاء: ${condolencePlace}`);
    if (input.prayerPlace.trim()) lines.push(`مكان الصلاة: ${input.prayerPlace.trim()}`);
    if (input.prayerTime.trim()) lines.push(`وقت الصلاة: ${input.prayerTime.trim()}`);
    if (input.burialPlace.trim()) lines.push(`مكان الدفن: ${input.burialPlace.trim()}`);
  } else if (placeKind || place || coords) {
    const venue = formatVenueLine({ placeKind, extra: place });
    if (venue) lines.push(`المكان: ${venue}`);
    if (coords) lines.push(`الإحداثيات: ${coords.lat}, ${coords.lng}`);
  }

  if (notes) {
    lines.push('');
    lines.push(notice ? 'نص التهنئة / الخبر:' : 'النص:');
    lines.push(notes);
  }

  lines.push('');
  lines.push('بيانات المرسل:');
  lines.push(`الاسم: ${input.submitterName.trim()}`);
  lines.push(`الجوال: ${input.submitterPhone.trim()}`);
  lines.push(`التاريخ: ${new Date(input.createdAt).toLocaleString('ar-SA')}`);
  lines.push('');
  lines.push('__JSON__:');
  lines.push(
    JSON.stringify({
      v: 1,
      kind:
        family === 'death'
          ? 'death_notice'
          : family === 'health'
            ? 'health_notice'
            : notice
              ? 'family_notice'
              : 'happy_notice',
      mode: typeMeta.mode,
      family,
      type: typeMeta.key,
      typeLabel: typeMeta.adminTypeLabel,
      person,
      date_label: dateLabel || null,
      event_date: eventDateIso || null,
      place: place || null,
      place_kind: placeKind || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      hospital_name: hospitalName || null,
      hospital_dept: hospitalDept || null,
      prayer_place: input.prayerPlace.trim() || null,
      prayer_time: input.prayerTime.trim() || null,
      burial_place: input.burialPlace.trim() || null,
      condolence_place: condolencePlace || null,
      text: notes,
      image_url: input.imageUrl.trim() || null,
      video_url: input.videoUrl.trim() || null,
      contact_phone: input.contactPhone.trim() || null,
      submitter_name: input.submitterName.trim(),
      submitter_phone: input.submitterPhone.trim(),
      request_id: input.requestId,
      created_at: input.createdAt,
      showDays: 7,
    }),
  );

  return lines.join('\n');
}
