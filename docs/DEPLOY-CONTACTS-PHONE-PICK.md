# اختيار الجوال من الأسماء / ملف جهات اتصال

## التطبيق (هذا المستودع)
- زر **«من الأسماء في الجهاز»** في كل `PhoneField`
- يحتاج بناء جديد (صلاحية Contacts + `expo-contacts`)

## الويب (alzidan.org)

```bash
cd /Users/ahshryhy/Projects/alzidan-family
git pull origin main
curl -fsSL -o assets/js/modules/phone-intl.js \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/contacts-phone-pick-e8cc/docs/web-assets/phone-intl.js"
curl -fsSL -o assets/css/phone-intl.css \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/contacts-phone-pick-e8cc/docs/web-assets/phone-intl.css"
perl -pi -e 's/phone-intl\.js\?v=[^"]+/phone-intl.js?v=20261026contacts1/; s/phone-intl\.css\?v=[^"]+/phone-intl.css?v=20261026contacts1/' pages/admin.html pages/delegate.html 2>/dev/null
# إن وُجدت صفحات أخرى تستخدم phone-intl حدّثها كذلك
git add -A
git commit -m "feat(web): اختيار جوال من الأسماء أو ملف vCard/CSV"
git push origin main
```

### على آيفون (سفاري)
زر **من الأسماء** يعرض الخطوات ثم يفتح اختيار ملف:
1. الأسماء → الشخص → **مشاركة جهة الاتصال** → احفظ في الملفات  
2. في النموذج اضغط موافق واختر ملف `.vcf`

(آبل لا تسمح للموقع بفتح قائمة الأسماء مباشرة من سفاري.)

### على الماك
زر **من الأسماء** أو **ملف جهات اتصال**: Contacts → Export vCard ثم اختر الملف.

### على أندرويد كروم
زر **من الأسماء** يفتح Contact Picker مباشرة.

### تحديث كاش الويب
`phone-intl.js?v=20261026contacts2` و `phone-intl.css?v=20261026contacts2`
