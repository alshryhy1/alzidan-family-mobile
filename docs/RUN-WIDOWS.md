# قائمة الأرامل (إدارة) — نشر على alzidan.org

Pages ينشر من فرع `main` في `alzidan-family` → https://alzidan.org/

القسم داخل لوحة الإدارة → **صدقة ودعم** → «الأرامل — للمساعدات».
للإدارة فقط (لا نسبة عامة في التطبيق).

تعريف الأرملة: زوجة بحالة نشطة وزوجها متوفى في الشجرة.
فلاتر: الفرع · الجوال · أبناء قُصّر (&lt;١٨) · بحث بالاسم/الجوال.

صلاحية دفع مستودع الويب غير متاحة لـ cursor[bot] من الجلسة السحابية؛ نفّذ من جهازك:

## أسرع طريق (باتش)

استبدل المسارات بمساراتك الفعلية (مثال: `~/alzidan-family` و `~/alzidan-family-mobile`):

```bash
cd ~/alzidan-family
git checkout main
git pull origin main
git apply ~/alzidan-family-mobile/docs/web-widows-aid-list-v1.patch
git add -A
git commit -m "feat(web): قائمة الأرامل في إدارة صدقة ودعم"
git push origin main
```

بعد الدفع ينشر GitHub Pages تلقائياً. ثم افتح الإدارة → صدقة ودعم → حدّث الصفحة بقوة (Hard Refresh) → «تحميل الأرامل».

## بديل (git bundle)

```bash
cd ~/alzidan-family
git checkout main
git pull origin main
git pull ~/alzidan-family-mobile/docs/alzidan-family-widows-aid.bundle main
git push origin main
```

لا يلزم SQL جديد؛ يعتمد على `tree_spouses` و`tree_children` و`tree_mother_links` وعمود `wife_phone` إن وُجد.
