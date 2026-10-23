# جوال الزوجة (إضافة/تعديل)

## 1) قاعدة البيانات
نفّذ مرة في Supabase → SQL Editor:
`docs/COPY-ME-tree-spouses-wife-phone-v1.sql`
(أو من أوامر الصيانة في لوحة الإدارة بعد تطبيق باتش الويب).

## 2) موقع الإدارة
من جذر مستودع `alzidan-family`:
```bash
git apply ../alzidan-family-mobile/docs/web-wife-phone-v1.patch
```
أو انسخ الملفات من الباتش يدوياً ثم انشر Pages.

بعدها: إدارة العائلة → اختر الزوج → إضافة/تعديل زوجة → خانة «رقم الجوال».
