import { Alert, Platform } from 'react-native';
import { Contact, ContactField } from 'expo-contacts';

import { parsePhoneToParts } from '../utils/phone';

export type PickedContactPhone = {
  countryId: string;
  national: string;
  raw: string;
  contactName?: string;
};

function phoneLabelAr(label?: string | null) {
  const l = String(label || '').toLowerCase();
  if (/mobile|iphone|cell|جوال|موبايل/.test(l)) return 'جوال';
  if (/home|منزل|بيت/.test(l)) return 'منزل';
  if (/work|عمل|مكتب/.test(l)) return 'عمل';
  if (/main|رئيسي/.test(l)) return 'رئيسي';
  return label ? String(label) : 'رقم';
}

function chooseAmongPhones(
  phones: { number: string; label?: string | null }[],
  contactName?: string,
): Promise<string | null> {
  if (phones.length === 1) return Promise.resolve(phones[0].number);
  return new Promise((resolve) => {
    const buttons = [
      ...phones.slice(0, 5).map((p) => ({
        text: `${phoneLabelAr(p.label)} · ${p.number}`,
        onPress: () => resolve(p.number),
      })),
      { text: 'إلغاء', style: 'cancel' as const, onPress: () => resolve(null) },
    ];
    Alert.alert(
      contactName ? `اختر رقمًا لـ ${contactName}` : 'اختر رقمًا',
      'لجهة الاتصال أكثر من رقم',
      buttons,
    );
  });
}

/**
 * Opens the system contact picker and returns country + national for PhoneField.
 * User cancels → null. Contact without phone → alert + null.
 */
export async function pickPhoneFromContacts(): Promise<PickedContactPhone | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    Alert.alert('غير متاح', 'اختيار الأسماء متاح على الجوال فقط.');
    return null;
  }

  let contact: Contact | null = null;
  try {
    contact = await Contact.presentPicker();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    Alert.alert(
      'تعذر فتح الأسماء',
      /permission/i.test(message)
        ? 'امنح التطبيق صلاحية جهات الاتصال من إعدادات الجهاز ثم أعد المحاولة.'
        : 'تعذر فتح قائمة الأسماء. تأكد من صلاحية جهات الاتصال ثم أعد المحاولة.',
    );
    return null;
  }
  if (!contact) return null;

  let name: string | undefined;
  try {
    const details = await contact.getDetails([
      ContactField.FULL_NAME,
      ContactField.GIVEN_NAME,
      ContactField.FAMILY_NAME,
    ]);
    name =
      String(
        details.fullName ||
          [details.givenName, details.familyName].filter(Boolean).join(' ') ||
          '',
      ).trim() || undefined;
  } catch {
    name = undefined;
  }

  let phones: { number?: string | null; label?: string | null }[] = [];
  try {
    phones = await contact.getPhones();
  } catch {
    phones = [];
  }

  const usable = phones
    .map((p) => ({ number: String(p.number || '').trim(), label: p.label }))
    .filter((p) => p.number);
  if (!usable.length) {
    Alert.alert('بلا رقم', (name ? `${name} — ` : '') + 'جهة الاتصال بلا رقم جوال.');
    return null;
  }

  const raw = await chooseAmongPhones(usable, name);
  if (!raw) return null;

  const parts = parsePhoneToParts(raw);
  return {
    countryId: parts.countryId,
    national: parts.national,
    raw,
    contactName: name,
  };
}
