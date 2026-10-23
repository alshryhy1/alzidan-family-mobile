# جوال الزوجة (إضافة/تعديل) — نشر على alzidan.org

Pages ينشر من فرع `main` في `alzidan-family` → https://alzidan.org/

صلاحية دفع هذا المستودع غير متاحة لـ cursor[bot] من الجلسة السحابية؛ نفّذ من جهازك:

## أسرع طريق (باتش)

```bash
cd /path/to/alzidan-family
git checkout main
git pull origin main
git apply /path/to/alzidan-family-mobile/docs/web-wife-phone-v1.patch
git add -A
git commit -m "feat(web): خانة جوال عند إضافة/تعديل زوجة"
git push origin main
```

بعد الدفع ينشر GitHub Pages تلقائياً على الدومين.

## بديل (git bundle من نفس التغييرات)

```bash
cd /path/to/alzidan-family
git checkout main
git pull origin main
git pull /path/to/alzidan-family-mobile/docs/alzidan-family-wife-phone.bundle main
git push origin main
```

## قاعدة البيانات (إن لم تُنفَّذ)

في Supabase → SQL Editor:
`docs/COPY-ME-tree-spouses-wife-phone-v1.sql`
(أو أمر الصيانة من لوحة الإدارة بعد نشر الويب).

بعدها: إدارة العائلة → اختر الزوج → إضافة/تعديل زوجة → خانة «رقم الجوال».
