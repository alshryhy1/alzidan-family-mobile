# تحقق المتواجدين / المتصلين / الأجهزة

تاريخ التحقق: 2026-10-24

## التطبيق (فرع `cursor/appstore-ship-e8cc`) — موجود ومؤكَّد

| المكان | ماذا يظهر | الحالة في الكود |
|---|---|---|
| **نبض** (الرئيسية) | عدد «المتواجدون» فقط | `pulseHeartbeat` كل ٤٥ ثانية → `PulseLiveBoard` |
| **ملفي → إدارة العائلة → أرقام الآن** | جوالات الأعضاء المسجّلين (٣ دقائق) | `family_admin_pulse_online_v1` |
| **ملفي → إدارة العائلة → جهاز** | أجهزة موثوقة + فك الربط | `family_admin_devices_list_v1` — يظهر فقط لجوال الإدارة `…551840058` |

### اختبار حي على السيرفر
- `pulse_heartbeat_v1` → يعمل (`online` يُرجَع)
- `family_admin_pulse_online_v1` / `family_admin_devices_list_v1` → موجودان (يرفضان رقم غير مخوّل كما يُفترض)

### شروط الظهور
1. التطبيق مفتوح في المقدمة (مو بالخلفية)
2. لإظهار **الرقم** في «أرقام الآن»: دخول من ملفي برقم عضو مسجّل على الشجرة
3. الزائر يزيد العدد في نبض فقط بلا رقم

## ويب لوحة الإدارة — ناقص على الدومين حالياً

`admin-pulse-online.js` غير منشور على alzidan.org (404).  
لنشره مرة:

```bash
cd /Users/ahshryhy/Projects/alzidan-family
git pull origin main
mkdir -p assets/js supabase/sql
curl -fsSL -o assets/js/admin-pulse-online.js \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/appstore-ship-e8cc/docs/web-assets/admin-pulse-online.js"
curl -fsSL -o supabase/sql/COPY-ME-pulse-online-phones-v1.sql \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/appstore-ship-e8cc/docs/COPY-ME-pulse-online-phones-v1.sql"
```

ثم أضف قسم `docs/snippets/admin-pulse-online-section.html` داخل `pages/admin.html` والسكربت:
`<script src="../assets/js/admin-pulse-online.js?v=20261024pulse1"></script>`

SQL مرة إن لزم: `COPY-ME-pulse-online-phones-v1.sql` في Supabase.
