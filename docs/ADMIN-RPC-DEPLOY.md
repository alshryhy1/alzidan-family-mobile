# نشر دوال إدارة التطبيق على Supabase

فحص حي بتاريخ 2026-09-11 على `wbskjfdqpugnwvrykqcn.supabase.co`:

| الحالة | العدد |
|--------|------|
| موجودة / تستجيب | 10 |
| **مفقودة (404 PGRST202)** | **19** |

## لماذا الإدارة تبدو شكلية؟

التطبيق يعرض الطلبات لأن `family_admin_requests_list_v1` **موجودة**.
لكن **البحث والربط والاعتماد** تعتمد على دوال **غير منشورة** — مثل:

- `family_admin_search_people_v1`
- `family_admin_request_bind_v1`
- `family_admin_request_reject_v1`

بدونها: ترى الطلب، تبحث، لا شيء يُنفَّذ.

## الدوال المفقودة (19)

### إدارة العائلة
- `family_admin_search_people_v1`
- `family_admin_update_person_v1`
- `family_admin_set_phone_v1`
- `family_admin_request_reject_v1`
- `family_admin_request_approve_v1`
- `family_admin_request_bind_v1`
- `family_admin_delegates_set_role_v1`
- `family_admin_delegates_set_enabled_v1`
- `family_admin_device_unbind_v1`

### إدارة النساء
- `women_manager_search_members_v1`
- `women_manager_add_member_v1`
- `women_manager_bind_phone_v1`
- `women_manager_set_member_phone_v1`
- `women_manager_set_pending_phone_v1`
- `women_manager_mother_children_v1`
- `women_manager_link_mother_v1`
- `women_manager_unlink_mother_v1`

### مندوب التطبيق
- `delegate_app_request_set_v1`
- `delegate_app_request_bind_v1`

## ملفات SQL للنشر (من مستودع الويب)

نفّذ في Supabase SQL Editor بالترتيب:

1. `alzidan-family/supabase/sql/COPY-ME-family-admin-app-v1.sql`
2. `alzidan-family/supabase/sql/COPY-ME-family-admin-delegates-v1.sql`
3. `alzidan-family/supabase/sql/COPY-ME-women-manager-phone-requests-v1.sql`
4. `alzidan-family/supabase/sql/COPY-ME-women-manager-members-v1.sql`
5. `alzidan-family/supabase/sql/COPY-ME-women-manager-mothers-v1.sql`
6. `alzidan-family/supabase/sql/COPY-ME-women-manager-search-match-v1.sql`
7. `alzidan-family/supabase/sql/COPY-ME-delegate-app-inbox-v1.sql`

## النشر السريع (ملف واحد)

الملف الجاهز: `supabase/deploy-admin-rpcs-bundle.sql` (~3079 سطر)

### الطريقة أ — SQL Editor (بدون أدوات)
1. افتح [Supabase Dashboard](https://supabase.com/dashboard) → مشروعك → **SQL Editor**
2. انسخ محتوى `supabase/deploy-admin-rpcs-bundle.sql` والصقه
3. اضغط **Run**

### الطريقة ب — سطر أوامر (تلقائي)
```bash
# من Supabase → Settings → Database → Connection string (URI)
SUPABASE_DB_URL='postgresql://postgres.[ref]:[PASSWORD]@...' npm run deploy:admin-rpcs
```

## إذا البحث لا يجد الاسم (إدارة شكلية)

شغّل أيضًا في SQL Editor:

`supabase/COPY-ME-family-admin-search-patch-v1.sql`

ثم حدّث التطبيق من PR #2.

## التحقق بعد النشر

```bash
npm run verify:admin-rpcs
```

يجب أن تظهر 29/29 OK (أو exists_error مع not_allowed/device_required — هذا يعني الدالة موجودة).

## إصلاح لوحة الإدارة على متصفح الجوال (الويب)

```bash
cd alzidan-family && git apply ../docs/web-admin-mobile-hub.patch
```

أو انسخ التعديلات من `docs/web-admin-mobile-hub.patch`.
