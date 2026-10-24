# إعادة إرسال إشعار حالة إنسانية

للطلب المنشور يظهر زر **«إشعار حالة إنسانية»** بدون إعادة اعتماد.

```bash
cd /Users/ahshryhy/Projects/alzidan-family
git pull origin main
curl -fsSL -o assets/js/admin-aid-requests.js \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/appstore-ship-e8cc/docs/web-assets/admin-aid-requests.js"
perl -pi -e 's/admin-aid-requests\.js\?v=[^"]+/admin-aid-requests.js?v=20261024hum2/' pages/admin.html
git add -A
git commit -m "feat(web): زر إعادة إرسال إشعار حالة إنسانية للمنشور"
git push origin main
```

ثم Cmd+Shift+R على لوحة الإدارة → الطلب المنشور → **إشعار حالة إنسانية**.
