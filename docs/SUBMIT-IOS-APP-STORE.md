# رفع عائلة الزيدان إلى App Store

**فرع الرفع الوحيد:** `cursor/appstore-ship-e8cc`  
**الإصدار:** `2.0.5`  
**buildNumber في الفرع الآن:** `78` (آخر مرفوع)  
**البناء التالي:** مع `autoIncrement` يصير **79**

لا تستخدم فروع أخرى للستور.

## يشمل هذا الفرع

| الإصلاح | موجود |
|---|---|
| فرص مساعدة + عثيم / كهرباء / إيجار / ماء | نعم |
| إخفاء مشاركات الدعوة المنتهية من «وصلك من العائلة» | نعم |
| تشديد زر إدارة العائلة (للمخوّل فقط) | نعم |
| إشعار عام «حالة إنسانية» + فتح تبرع/فرص | نعم |
| طلب مساعدة للأرملة/المطلقة فقط | نعم |

## على الماك — بناء ورفع للمتجر (بناء 78)

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git fetch origin cursor/appstore-ship-e8cc
git checkout cursor/appstore-ship-e8cc
git reset --hard origin/cursor/appstore-ship-e8cc

grep -A2 '"ios"' app.json | head -5

npx eas-cli build --platform ios --profile production --non-interactive
npx eas-cli submit --platform ios --profile production --latest --non-interactive
```

المتوقع في اللوج: `Bumping expo.ios.buildNumber from 77 to 78`  
ثم في App Store Connect: **2.0.5 (78)**

بعد الرفع في Connect: اختر البناء **78** (مرفوع) → Submit for Review.

## ملاحظات ما الجديد

```
فرص مساعدة سرية عبر عثيم وسداد الفواتير
إخفاء مشاركات الدعوة المنتهية
إشعار حالة إنسانية للعيلة
إدارة العائلة للمخوّلين فقط
```
