# حالة الزوجة «متوفاة» + استبعادها من قائمة الأرامل

## 1) SQL مرة واحدة (مهم قبل الحفظ)

بدون هذا الأمر، الحفظ عبر RPC قد يحوّل «متوفاة» إلى «مطلقة».

في Supabase → SQL Editor → الصق ثم Run:

`docs/COPY-ME-tree-spouses-wife-deceased-status-v1.sql`

(أو من مستودع الويب بعد تطبيق الباتش: `supabase/sql/COPY-ME-tree-spouses-wife-deceased-status-v1.sql`)

## 2) نشر الويب على alzidan.org

```bash
cd ~/alzidan-family
git checkout main && git pull origin main
curl -fsSL -o /tmp/web-wife-deceased-status-v1.patch \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/wife-deceased-status-e8cc/docs/web-wife-deceased-status-v1.patch"
git apply /tmp/web-wife-deceased-status-v1.patch
git add -A
git commit -m "feat(web): حالة زوجة متوفاة واستبعادها من قائمة الأرامل"
git push origin main
```

## 3) الاستخدام

1. Hard Refresh للوحة الإدارة  
2. إدارة العائلة → الزوج → تعديل الزوجة → حالة الزوجية → **متوفاة** → حفظ  
3. صدقة ودعم → تحميل الأرامل — المتوفاة لا تظهر
