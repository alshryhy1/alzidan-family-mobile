# إخفاء إدارة العائلة عن غير المخوّل

## السبب
صلاحية التطبيق كانت قد تُفعَّل عبر تطابق `person_id` حتى لو بطاقة الشجرة مختلفة، فيظهر زر **فتح إدارة العائلة** لعضو ليس مندوباً ولا مخوّلاً.

## 1) SQL في Supabase (مرة)
الصق ثم Run:

`docs/COPY-ME-family-admin-session-tighten-v1.sql`

## 2) راجع المنح بالخطأ
```sql
select g.tree_child_id, g.status, mp.phone, mp.display_name
from public.member_role_grants g
left join public.member_profiles mp on mp.tree_child_id = g.tree_child_id
where g.role_key = 'family_admin' and g.status = 'active';
```

لإيقاف منحة شخص:
```sql
update public.member_role_grants
set status = 'suspended', updated_at = now()
where role_key = 'family_admin'
  and tree_child_id = <ID_البطاقة>;
```

## 3) التطبيق
بعد بناء يتضمن التشديد: زر الإدارة لا يظهر إلا إذا `enabled === true` ومنحة على نفس `tree_child_id`، وطلبات الفرع فقط للمندوب.
