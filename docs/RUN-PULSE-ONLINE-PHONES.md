# أرقام جوالات المتصلين الآن (إدارة فقط)

## ماذا يظهر؟

- **الويب (رمز الإدارة):** قسم «أرقام جوالات المتصلين الآن»
- **التطبيق (إدارة العائلة فقط):** تبويب **متصلون** داخل إدارة العائلة
- يظهر جوال العضو **المسجّل** وهو داخل التطبيق خلال آخر ٣ دقائق
- الزائر بلا تسجيل يدخل في عدّاد المتواجدين فقط **بدون رقم**

## 1) SQL مرة واحدة

Supabase → SQL Editor → الصق ثم Run:

`docs/COPY-ME-pulse-online-phones-v1.sql`

## 2) نشر قسم الويب على alzidan.org

```bash
cd ~/alzidan-family
git checkout main && git pull origin main

# SQL داخل مستودع الويب
mkdir -p supabase/sql
curl -fsSL -o supabase/sql/COPY-ME-pulse-online-phones-v1.sql \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/admin-online-phones-e8cc/docs/COPY-ME-pulse-online-phones-v1.sql"

# سكربت لوحة الإدارة
mkdir -p assets/js
curl -fsSL -o assets/js/admin-pulse-online.js \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/admin-online-phones-e8cc/docs/web-assets/admin-pulse-online.js"
```

ثم في `pages/admin.html`:

1. الصق محتوى `docs/snippets/admin-pulse-online-section.html` داخل الصفحة (قرب أقسام الإدارة فقط).
2. أضف قبل `</body>`:

```html
<script src="../assets/js/admin-pulse-online.js?v=20261024pulse1"></script>
```

3. في `assets/js/admin-shell.js` أضف معرّف القسم إلى وحدة مناسبة (مثلاً `views`):

```js
sections: [ /* ... */ "admin-pulse-online-section"],
```

```bash
git add -A
git commit -m "feat(web): أرقام جوالات المتصلين الآن للإدارة"
git push origin main
```

Hard Refresh بعد النشر.

## 3) التطبيق

بعد دمج الفرع وبناء التطبيق: **ملفي → إدارة العائلة → متصلون**.
