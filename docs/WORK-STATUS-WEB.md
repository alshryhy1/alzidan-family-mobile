# الحالة الوظيفية (موظف / متقاعد / عاطل)

## ماذا أُضيف؟

| المكان | التفاصيل |
| --- | --- |
| جدول `tree_children` | عمود `work_status` |
| القيم | `employed` · `retired` · `unemployed` · فارغ |
| الإدارة (ويب) | قائمة «الحالة الوظيفية» في إضافة/تعديل الشخص ومصدر الشجرة |
| إحصاء | دالة `tree_work_status_stats_v1(branch?)` للأحياء حسب الفرع |

## تشغيل الجداول (مرة واحدة)

1. افتح **إدارة العائلة → مساحة SQL**.
2. شغّل الأمر: **الحالة الوظيفية: موظف / متقاعد / عاطل**  
   (`maint.tree_children_work_status_v1`)  
   أو الصق الملف: `supabase/sql/COPY-ME-tree-children-work-status-v1.sql`
3. Hard Refresh لصفحة الإدارة.

## تطبيق تعديلات الويب

مستودع الويب `alzidan-family` غير قابل للدفع من هذه الجلسة. التعديلات جاهزة محلياً كباتش:

```bash
cd alzidan-family
git apply path/to/docs/web-work-status-v1.patch
# أو انسخ الملفات من الكوميت المحلي إن وُجد
```

الملفات المتأثرة في الويب:

- `supabase/sql/COPY-ME-tree-children-work-status-v1.sql`
- `assets/js/modules/admin-sql-presets.js`
- `assets/js/admin-family-mgmt.js`
- `assets/js/admin-source-tree.js`
- `assets/js/modules/family-management/family-children-section.js`
- `assets/js/modules/family-management/family-add-sheet.js`

## بعدها في التطبيق

بعد تعبئة الحالات من الويب، نقدر نعرض نسب الموظفين/المتقاعدين/العاطلين في **الفروع** (بلاطات أرقام).
