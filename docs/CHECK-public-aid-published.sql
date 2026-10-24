-- تحقق سريع: هل الطلبات المنشورة تصل للعامة / النبض؟
-- الصق في Supabase → SQL Editor → Run

-- 1) عدد المنشور في الجدول
select id, status, situation, left(need_text, 40) as need, published_at
from public.family_aid_requests
where status = 'published'
order by id desc;

-- 2) ماذا تُرجع دالة العامة (نفس ما يقرأه التطبيق)
select public.public_aid_requests_published_v1() as payload;

-- 3) عدد الصفوف داخل الـ payload
select jsonb_array_length(
  coalesce(public.public_aid_requests_published_v1()->'rows', '[]'::jsonb)
) as published_for_app;

-- إن كانت (1) فيها صفوف و (3) = 0 أو خطأ: أعد تشغيل
-- docs/COPY-ME-family-aid-pay-channels-v1.sql
-- ثم أعد (2) و (3).
