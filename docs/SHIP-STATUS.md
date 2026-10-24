# حالة الرفع الشاملة — 2.0.5

تاريخ المزامنة: 2026-10-24 (آسيا/الرياض)

## التطبيق (مستودع alzidan-family-mobile)

| البند | القيمة |
|---|---|
| الفرع | `cursor/appstore-ship-e8cc` |
| PR | https://github.com/alshryhy1/alzidan-family-mobile/pull/28 |
| version | **2.0.5** |
| buildNumber في git | **78** |
| آخر بناء على Connect | **78** |
| المطلوب للمتجر الآن | مرفوع **78** — Submit for Review ثم Submit for Review |

### إصلاحات داخل الفرع
1. مساعدة سرية + قنوات عثيم/سوا  
2. إخفاء مشاركات الدعوة القديمة  
3. تشديد إدارة العائلة  
4. إشعار حالة إنسانية + فتح شاشة التبرع  
5. **المتواجدون في نبض** + **أرقام الآن / الأجهزة** في إدارة التطبيق (مؤكَّد بالكود + RPC حي)  

انظر أيضاً: `docs/VERIFY-PULSE-ONLINE.md`

## الويب (مستودع alzidan-family → alzidan.org)

| البند | الحالة |
|---|---|
| main | مرفوع (آخرها إصلاح dedupe الإشعار) |
| admin-aid-requests.js | `?v=20261024hum1` |
| edge `alzidan-push-notify` | منشور — عنوان «حالة إنسانية» |

## SQL
| ملف | الغرض |
|---|---|
| `COPY-ME-family-admin-session-tighten-v1.sql` | إخفاء الإدارة عن غير المخوّل |

## ملاحظة فوترة Supabase
حساب Free عليه تحذير كوتة — راقب الفوترة حتى لا تتوقف الطلبات/الإشعارات.
