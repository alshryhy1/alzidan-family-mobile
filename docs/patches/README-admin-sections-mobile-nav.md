# إصلاح: زر «الأقسام» لا يرجع في متصفح الجوال

**المستودع المستهدف:** `alshryhy1/alzidan-family` (لوحة الإدارة على الويب)  
**ليس** مستودع الموبايل — الإصلاح هنا كـ patch لأن وكيل هذه الجلسة بلا صلاحية دفع لمستودع الويب.

## السبب

1. زر **الأقسام** كان يفتح درج القائمة الجانبية فقط (`admin-shell-nav-open`).
2. على الجوال الدرج `position:fixed` داخل `.page`، و`admin-mobile.css` يضع `overflow-x: hidden` على `.page` — WebKit يقصّ الدرج فيبدو الزر ميتاً.
3. التنقل بين الموديولات يستخدم `history.replaceState` فلا يعمل زر رجوع المتصفح للعودة للوحة التحكم.

النتيجة من داخل «إدارة الشجرة»: لا درج ظاهر ولا رجوع للمتصفح → عالق.

## الإصلاح (في الـ patch)

- ضغطة «الأقسام» من أي موديول على الشاشات الضيقة → `navigate("hub")`.
- استضافة الدرج على `document.body` عند ≤900px.
- إزالة قصّ overflow عن `.page` في وضع الشِلّ.
- `pushState` + `popstate` لزر رجوع المتصفح.
- تحديث cache-bust: `?v=20261007sec1`.

## التطبيق

```bash
cd /path/to/alzidan-family
git apply docs/../path-or:
git apply /path/to/2026-10-07-admin-sections-mobile-nav.patch
node scripts/test-admin-shell-mobile-sections.js
```

أو انسخ محتوى الـ patch إلى فرع في `alzidan-family` وادمج بعد المراجعة.
