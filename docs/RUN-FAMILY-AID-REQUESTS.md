# طلبات المساعدة السرية (أرملة / مطلقة)

## المسار

1. العضو من التطبيق → **ملفي** → **طلب مساعدة خاص** (أو تبرع → فرص مساعدة)  
2. يرسل طلباً للإدارة (إخفاء الاسم افتراضي)  
3. الإدارة في الويب → **صدقة ودعم** → **طلبات المساعدة — نشر سري** → اعتماد ونشر  
4. المنشور للعامة **بلا اسم** + ملاحظة: التحويل عبر **صندوق العائلة**  
5. أهل العائلة يساعدون عبر التواصل مع الإدارة

## 1) SQL مرة واحدة

Supabase → SQL Editor → الصق ثم Run:

`docs/COPY-ME-family-aid-requests-v1.sql`

(أو من مستودع الويب بعد الباتش: `supabase/sql/COPY-ME-family-aid-requests-v1.sql`)

## 2) نشر لوحة الإدارة على alzidan.org

```bash
cd ~/alzidan-family
git checkout main && git pull origin main
curl -fsSL -o /tmp/web-family-aid-requests-v1.patch \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/private-aid-requests-e8cc/docs/web-family-aid-requests-v1.patch"
git apply /tmp/web-family-aid-requests-v1.patch
git add -A
git commit -m "feat(web): طلبات مساعدة سرية ونشر بلا اسم"
git push origin main
```

ثم Hard Refresh → صدقة ودعم → طلبات المساعدة.
