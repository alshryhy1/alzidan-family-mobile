# رفع عائلة الزيدان إلى App Store

الفرع: `cursor/private-aid-requests-e8cc`  
الإصدار: `2.0.4` (رقم البناء يزيد تلقائياً مع `production`)

## على الماك

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git fetch origin cursor/private-aid-requests-e8cc
git checkout cursor/private-aid-requests-e8cc
git pull origin cursor/private-aid-requests-e8cc

npx eas-cli login
npx eas-cli build --platform ios --profile production --non-interactive
npx eas-cli submit --platform ios --profile production --latest --non-interactive
```

- `ascAppId`: `6797335229` (من `eas.json`)
- بعد الرفع: App Store Connect → الإصدار → أضف ملاحظات ما الجديد → أرسل للمراجعة

## ملاحظات ما الجديد (اختياري)

```
طلبات مساعدة سرية ونشر فرص بلا اسم
إشعار فرصة مساعدة عبر صندوق العائلة
تحسين بطاقة الأرملة والأبناء
خيار متزوجة من خارج العائلة
```
