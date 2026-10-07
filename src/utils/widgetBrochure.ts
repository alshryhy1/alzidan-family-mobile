import { Linking, Share } from 'react-native';

export const APP_STORE_URL = 'https://apps.apple.com/sa/app/id6797335229';

/** نص جاهز لقروب واتساب — خطوات إضافة الودجت. */
export function buildWidgetBrochureMessage() {
  return [
    'عائلة مطلق الزيدان',
    '',
    'ودجت أهلنا على شاشتك',
    'أخبار العائلة · من معنا الآن · أوقات الصلاة حسب موقعك',
    '',
    'كيف تضيف الودجت على الآيفون؟',
    '',
    '١) ثبّت التطبيق من App Store إن ما كان عندك:',
    APP_STORE_URL,
    '',
    '٢) افتح التطبيق مرة وادخل برقمك من «ملفي» حتى يتحدّث الودجت.',
    '',
    '٣) اضغط مطولاً على الشاشة الرئيسية حتى تهتز الأيقونات.',
    '',
    '٤) اضغط زر + أعلى اليسار (أو عدّل / Edit).',
    '',
    '٥) ابحث: عائلة الزيدان',
    '',
    '٦) اختر الحجم:',
    '   • صغير — خبر سريع',
    '   • متوسط — مناسبات ومن معنا',
    '   • كبير — مناسبات + الصلاة',
    '',
    '٧) اضغط «إضافة ودجت» / Add Widget',
    '',
    'شاشة القفل (اختياري):',
    'اضغط مطولاً على شاشة القفل → تخصيص → ودجت → ابحث «عائلة الزيدان».',
    '',
    'من قلب العائلة إلى شاشتك 🌿',
  ].join('\n');
}

export function widgetBrochureWhatsAppUrl() {
  return `whatsapp://send?text=${encodeURIComponent(buildWidgetBrochureMessage())}`;
}

/** يفتح واتساب بالنص؛ إن تعذّر يفتح ورقة المشاركة. */
export async function shareWidgetBrochure() {
  const message = buildWidgetBrochureMessage();
  const url = widgetBrochureWhatsAppUrl();
  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return { ok: true as const, via: 'whatsapp' as const };
    }
  } catch {
    /* fall through */
  }
  try {
    await Share.share({ message, title: 'ودجت عائلة الزيدان' });
    return { ok: true as const, via: 'share' as const };
  } catch {
    return { ok: false as const, via: 'none' as const };
  }
}
