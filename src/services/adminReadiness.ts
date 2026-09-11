import {
  DelegateInboxRpcMissingError,
  fetchDelegateInboxSession,
  searchDelegateInboxPeople,
} from './delegateInbox';
import {
  FamilyAdminRpcMissingError,
  fetchFamilyAdminRequests,
  fetchFamilyAdminSession,
  searchFamilyAdminPeople,
} from './familyAdmin';
import {
  WomenManagerRpcMissingError,
  fetchWomenManagerSession,
  fetchWomenPhoneRequests,
  searchWomenMembers,
} from './womenManager';

export type AdminSurface = 'family' | 'women' | 'delegate';

export type AdminBackendStatus = {
  surface: AdminSurface;
  ready: boolean;
  sessionEnabled: boolean;
  message: string;
};

const PROBE_QUERY = 'اختبار';

function missingMessage(surface: AdminSurface) {
  if (surface === 'family') {
    return 'إدارة العائلة غير جاهزة على السيرفر. التطبيق يعرض الواجهة فقط حتى تُنشر دوال Supabase (family_admin_*). راجِع الإدارة التقنية.';
  }
  if (surface === 'women') {
    return 'إدارة النساء غير جاهزة على السيرفر. التطبيق يعرض الواجهة فقط حتى تُنشر دوال Supabase (women_manager_*).';
  }
  return 'طلبات الفرع غير جاهزة على السيرفر. التطبيق يعرض الواجهة فقط حتى تُنشر دوال Supabase (delegate_app_*).';
}

export async function probeFamilyAdminBackend(phone: string): Promise<AdminBackendStatus> {
  const cleaned = String(phone || '').trim();
  if (!cleaned) {
    return { surface: 'family', ready: false, sessionEnabled: false, message: 'لا توجد جلسة جوال.' };
  }
  const session = await fetchFamilyAdminSession(cleaned);
  if (!session.enabled) {
    return {
      surface: 'family',
      ready: false,
      sessionEnabled: false,
      message: 'هذا الرقم ليس إدارة عائلة مفعّلة.',
    };
  }
  try {
    await fetchFamilyAdminRequests(cleaned);
    await searchFamilyAdminPeople(cleaned, PROBE_QUERY);
    return { surface: 'family', ready: true, sessionEnabled: true, message: '' };
  } catch (error) {
    if (error instanceof FamilyAdminRpcMissingError) {
      return {
        surface: 'family',
        ready: false,
        sessionEnabled: true,
        message: missingMessage('family'),
      };
    }
    const code = error instanceof Error ? error.message : String(error || '');
    if (/not_allowed|device_required/i.test(code)) {
      return {
        surface: 'family',
        ready: false,
        sessionEnabled: true,
        message: 'الجلسة لا تملك صلاحية تنفيذ إدارة العائلة من هذا الجهاز.',
      };
    }
    return { surface: 'family', ready: true, sessionEnabled: true, message: '' };
  }
}

export async function probeWomenAdminBackend(phone: string): Promise<AdminBackendStatus> {
  const cleaned = String(phone || '').trim();
  if (!cleaned) {
    return { surface: 'women', ready: false, sessionEnabled: false, message: 'لا توجد جلسة جوال.' };
  }
  const session = await fetchWomenManagerSession(cleaned);
  if (!session.enabled) {
    return {
      surface: 'women',
      ready: false,
      sessionEnabled: false,
      message: 'هذا الرقم ليس مسؤولة نسائية مفعّلة.',
    };
  }
  try {
    await fetchWomenPhoneRequests(cleaned);
    await searchWomenMembers(cleaned, PROBE_QUERY);
    return { surface: 'women', ready: true, sessionEnabled: true, message: '' };
  } catch (error) {
    if (error instanceof WomenManagerRpcMissingError) {
      return {
        surface: 'women',
        ready: false,
        sessionEnabled: true,
        message: missingMessage('women'),
      };
    }
    return { surface: 'women', ready: true, sessionEnabled: true, message: '' };
  }
}

export async function probeDelegateInboxBackend(phone: string): Promise<AdminBackendStatus> {
  const cleaned = String(phone || '').trim();
  if (!cleaned) {
    return { surface: 'delegate', ready: false, sessionEnabled: false, message: 'لا توجد جلسة جوال.' };
  }
  const session = await fetchDelegateInboxSession(cleaned);
  if (!session.enabled) {
    return {
      surface: 'delegate',
      ready: false,
      sessionEnabled: false,
      message: 'هذا الرقم ليس مندوب فرع معتمدًا على جهاز موثوق.',
    };
  }
  try {
    await searchDelegateInboxPeople(cleaned, PROBE_QUERY);
    return { surface: 'delegate', ready: true, sessionEnabled: true, message: '' };
  } catch (error) {
    if (error instanceof DelegateInboxRpcMissingError) {
      return {
        surface: 'delegate',
        ready: false,
        sessionEnabled: true,
        message: missingMessage('delegate'),
      };
    }
    return { surface: 'delegate', ready: true, sessionEnabled: true, message: '' };
  }
}
