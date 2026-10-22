# جهة العمل + الدرجة العلمية — تشغيل الصيانة

الأمر **ما يظهر في قائمة الصيانة** حتى يُرفع مستودع الويب `alzidan-family`
(الحقول + preset `maint.tree_children_workplace_education_v1`).

إلى أن يحدث ذلك: نفّذ SQL يدويًا من **مساحة SQL** في الإدارة.

## 1) الحالة الوظيفية (إن لم تُشغَّل من قبل)

الصق محتوى:

`docs/COPY-ME-tree-children-work-status-v1.sql`

ثم نفّذ. النتيجة المتوقعة: أعمدة/دوال `work_status` = true.

## 2) جهة العمل + الدرجة العلمية (متوسط…دكتوراه)

الصق محتوى:

`docs/COPY-ME-tree-children-workplace-education-v1.sql`

ثم نفّذ. النتيجة المتوقعة:

- `has_workplace_column` = true
- `has_education_degree_column` = true
- `has_admin_set_workplace` / `has_admin_set_education` / `has_stats` = true

## 3) حفظ من الجوال (إضافة/تعديل مثل الموقع)

الصق ونفّذ أيضًا:

`docs/COPY-ME-member-set-person-profile-v1.sql`

بعدها من شجرتك في التطبيق: تعديل الاسم يضم المدينة والحي وموظف/متقاعد/عاطل والشهادة — نفس أعمدة `tree_children`.

## 4) بعد نجاح SQL

- Hard Refresh لصفحة الإدارة
- من إدارة العائلة أو من الجوال: عبّئ **وين موظف** و **الدرجة العلمية**
- المستويات: متوسط → ثانوي → دبلوم → بكالوريوس → ماجستير → دكتوراه

## 5) ظهور الزر في قائمة الصيانة

ارفع باتش الويب:

`docs/web-workplace-education-v1.patch`

على مستودع `alzidan-family` (فرع ثم نشر)، ثم Hard Refresh —

سيظهر الأمر بعنوان:

**جهة العمل + الدرجة العلمية (متوسط…دكتوراه)**
