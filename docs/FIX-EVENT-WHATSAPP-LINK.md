# إصلاح رابط المناسبة في واتساب

## السبب
واتساب **لا يفتح** روابط المخطط المخصص مثل:
`com.alzidan.family2://events/98`

يحتاج رابط **https** يعمل بالنقر.

## الحل
1. المشاركة تصير: `https://alzidan.org/pages/open-event.html?id=98`
2. الصفحة تحاول فتح التطبيق: `com.alzidan.family2://events/98`

## نشر الصفحة على الويب

```bash
cd /Users/ahshryhy/Projects/alzidan-family
git pull origin main
mkdir -p pages
curl -fsSL -o pages/open-event.html \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/event-https-share-link-e8cc/docs/web-assets/open-event.html"
git add pages/open-event.html
git commit -m "feat(web): صفحة فتح مناسبة من واتساب إلى التطبيق"
git push origin main
```

بعدها حدّث التطبيق (بناء جديد) حتى كرت المشاركة يستخدم رابط https.
