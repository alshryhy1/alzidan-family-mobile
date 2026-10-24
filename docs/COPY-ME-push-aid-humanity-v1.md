# إشعار عام للعيلة: حالة إنسانية

عند **اعتماد ونشر** طلب مساعدة من لوحة الإدارة يُرسل إشعار **لكل الأعضاء** المسجّلين في التطبيق (بلا اسم المستفيدة):

- العنوان: **حالة إنسانية**
- النص: **توجد حالة إنسانية في العائلة — للمساهمة من التبرع.**
- جوال صاحبة الطلب يُستثنى
- الضغط يفتح فرص المساعدة

هذا **ليس** إشعار إدارة — إشعار عامة العائلة.

## مطلوب مرة واحدة: نشر دالة الإشعار

بدون هذا النشر، الاعتماد ينجح لكن الإشعار العام لا يُرسل.

```bash
cd /Users/ahshryhy/Projects/alzidan-family
git pull origin main

curl -fsSL -o /tmp/web-aid-humanity-push-v1.patch \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/appstore-ship-e8cc/docs/web-aid-humanity-push-v1.patch"
git apply /tmp/web-aid-humanity-push-v1.patch || true

curl -fsSL -o assets/js/admin-aid-requests.js \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/appstore-ship-e8cc/docs/web-assets/admin-aid-requests.js"

npx supabase functions deploy alzidan-push-notify --project-ref wbskjfdqpugnwvrykqcn --no-verify-jwt
git add -A && git commit -m "feat(web): إشعار عام حالة إنسانية للعيلة" && git push origin main
```

## بعد النشر

1. Hard Refresh للوحة الإدارة  
2. اعتمد وانشر طلب مساعدة تجريبي  
3. المفروض يظهر: **وأُرسل إشعار عام: حالة إنسانية**  
4. يصل الإشعار لأجهزة العائلة المفتوحة/المسجّلة
