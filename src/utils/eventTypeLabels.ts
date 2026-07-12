const ARABIC_LABELS: Record<string, string> = {
  birth: 'عقيقة مولود',
  marriage: 'زواج',
  engagement: 'خطوبة',
  contract: 'عقد قران',
  graduation: 'حفل تخرج',
  promotion: 'حفل ترقية',
  success: 'نجاح / تفوق',
  new_house: 'منزل جديد',
  travel: 'سفر',
  gathering: 'اجتماع عائلي',
  meeting: 'اجتماع عائلي',
  sick: 'مريض',
  operation: 'عملية',
  discharge: 'خروج من المستشفى',
  death: 'وفاة',
  general: 'مناسبة عامة',
  happy: 'فرح',
  other: 'أخرى',
};

export function eventTypeArabicLabel(type?: string | null) {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  if (!key) return 'مناسبة عائلية';
  return ARABIC_LABELS[key] || 'مناسبة عائلية';
}
