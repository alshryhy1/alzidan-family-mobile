# إشعار «فرصة مساعدة» بعد اعتماد الطلب

عند **اعتماد ونشر** طلب مساعدة من الإدارة، يُرسل إشعار عام للأعضاء المسجّلين في التطبيق:

- العنوان: **فرصة مساعدة**
- النص: **هناك فرصة مساعدة عبر صندوق العائلة.**
- بلا اسم ولا جوال ولا حالة (أرملة/مطلقة)
- الضغط يفتح: **تبرع → فرص مساعدة**
- جوال مقدمة الطلب يُستثنى من الإشعار

## 1) نشر Edge Function (مرة عند التحديث)

من مستودع الويب بعد تطبيق الباتش:

```bash
cd ~/alzidan-family
npx supabase functions deploy alzidan-push-notify --project-ref wbskjfdqpugnwvrykqcn --no-verify-jwt
```

(يلزم `EXPO_ACCESS_TOKEN` و`SUPABASE_SERVICE_ROLE_KEY` كما لإشعارات المناسبات.)

## 2) نشر لوحة الإدارة

```bash
cd ~/alzidan-family
git checkout main && git pull origin main
curl -fsSL -o /tmp/web-aid-opportunity-push-v1.patch \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/private-aid-requests-e8cc/docs/web-aid-opportunity-push-v1.patch"
git apply /tmp/web-aid-opportunity-push-v1.patch
git add -A
git commit -m "feat(web): إشعار فرصة مساعدة عند نشر طلب سري"
git push origin main
```

ثم Hard Refresh لصفحة الإدارة.

## 3) التطبيق

فرع `cursor/private-aid-requests-e8cc` — الضغط على الإشعار يفتح شاشة فرص المساعدة.
