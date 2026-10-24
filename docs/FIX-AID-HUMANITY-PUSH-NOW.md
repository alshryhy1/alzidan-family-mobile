# إصلاح إشعار حالة إنسانية (الآن)

## ماذا وجدنا؟
الدالة تعمل وترسل لـ ~20 جهاز. غالب أسباب «ما وصل»:
1. إعادة نشر نفس الطلب خلال ١٥ دقيقة → dedupe يمنع الإعادة
2. المتصفح على سكربت قديم بلا استدعاء الإشعار
3. جهازك ما عليه رمز إشعار مربوط بالجوال

## على الماك — انسخ كاملًا

```bash
cd /Users/ahshryhy/Projects/alzidan-family
git pull origin main

curl -fsSL -o /tmp/web-aid-push-dedupe-fix-v1.patch \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/appstore-ship-e8cc/docs/web-aid-push-dedupe-fix-v1.patch"
git apply /tmp/web-aid-push-dedupe-fix-v1.patch

curl -fsSL -o assets/js/admin-aid-requests.js \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/appstore-ship-e8cc/docs/web-assets/admin-aid-requests.js"

# كسر الكاش إن وُجد السطر في admin.html
perl -pi -e 's/admin-aid-requests\.js\?v=[^"]+/admin-aid-requests.js?v=20261024hum1/' pages/admin.html

npx supabase functions deploy alzidan-push-notify --project-ref wbskjfdqpugnwvrykqcn --no-verify-jwt

git add -A
git commit -m "fix(web): إشعار حالة إنسانية لا يُحجب عند إعادة النشر"
git push origin main
```

ثم في المتصفح: Hard Refresh (Cmd+Shift+R) على لوحة الإدارة، وانشر طلبًا **جديدًا**.

بعد النجاح يجب أن تظهر جملة فيها عدد الأجهزة، مثل:
`وأُرسل إشعار عام: حالة إنسانية («20» جهاز).`
