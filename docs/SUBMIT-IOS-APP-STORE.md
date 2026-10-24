# رفع عائلة الزيدان إلى App Store

**فرع الرفع الوحيد:** `cursor/appstore-ship-e8cc`  
الإصدار: `2.0.5` — `buildNumber` الحالي في الفرع: `73`  
(`production` مع `autoIncrement: true` قد يزيد الرقم تلقائياً عند البناء)

لا تستخدم فروع أخرى للستور.

## على الماك (بناء + رفع)

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git fetch origin cursor/appstore-ship-e8cc
git checkout cursor/appstore-ship-e8cc
git pull origin cursor/appstore-ship-e8cc

npx eas-cli build --platform ios --profile production --non-interactive
npx eas-cli submit --platform ios --profile production --latest --non-interactive
```

- `ascAppId`: `6797335229` (من `eas.json`)
- بعد الرفع: App Store Connect → الإصدار → ملاحظات ما الجديد → أرسل للمراجعة

## ملاحظات ما الجديد

```
فرص مساعدة سرية عبر عثيم وسداد الفواتير
إخفاء مشاركات الدعوة المنتهية من الملف
طلب مساعدة للأرملة والمطلقة فقط
```

## ملاحظة للوكيل السحابي

الحفظ والدفع لـ GitHub يتم من السحابة. بناء EAS ورفعه لـ App Store يحتاج تسجيل Expo على الماك (`eas login`) — لا يوجد `EXPO_TOKEN` في بيئة السحابة.
