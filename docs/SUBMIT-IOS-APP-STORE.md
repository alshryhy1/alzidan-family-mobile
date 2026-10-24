# رفع عائلة الزيدان إلى App Store

**فرع الرفع الوحيد:** `cursor/appstore-ship-e8cc`  
**الإصدار:** `2.0.5`  
**buildNumber في الفرع:** `76`  
(عند `eas build --profile production` مع `autoIncrement` يصير التالي **77**)

لا تستخدم فروع أخرى للستور.

## يشمل هذا الفرع

| الإصلاح | موجود |
|---|---|
| فرص مساعدة + عثيم / كهرباء / إيجار / ماء | نعم |
| إخفاء مشاركات الدعوة المنتهية من «وصلك من العائلة» | نعم |
| تشديد زر إدارة العائلة (للمخوّل فقط) | نعم |
| إشعار عام «حالة إنسانية» + فتح تبرع/فرص | نعم |
| طلب مساعدة للأرملة/المطلقة فقط | نعم |

## ويب (alzidan.org) — مرفوع على main

- خانات المساهمة + إشعار حالة إنسانية + nonce إعادة النشر
- `admin-aid-requests.js?v=20261024hum1`
- دالة `alzidan-push-notify` منشورة على Supabase

## SQL لمرة (إن لم يُنفَّذ)

- `docs/COPY-ME-family-admin-session-tighten-v1.sql`

## على الماك — بناء ورفع

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git fetch origin cursor/appstore-ship-e8cc
git checkout cursor/appstore-ship-e8cc
git reset --hard origin/cursor/appstore-ship-e8cc

# تأكيد النسخة
grep -A2 '"ios"' app.json | head -5

npx eas-cli build --platform ios --profile production --non-interactive
npx eas-cli submit --platform ios --profile production --latest --non-interactive
```

المتوقع في اللوج: `Bumping expo.ios.buildNumber from 76 to 77`  
ثم في App Store Connect: **2.0.5 (77)**

## ملاحظات ما الجديد

```
فرص مساعدة سرية عبر عثيم وسداد الفواتير
إخفاء مشاركات الدعوة المنتهية
إشعار حالة إنسانية للعيلة
إدارة العائلة للمخوّلين فقط
```
