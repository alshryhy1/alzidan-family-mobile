# نشر خانات المساهمة على alzidan.org

الويب في مستودع `alzidan-family` (الدومين من `main` / GitHub Pages).

## على الماك

```bash
cd ~/alzidan-family   # أو مسارك
git checkout main
git pull origin main

# طبّق باتش الموبايل (أو انسخ الملفات يدويًا)
curl -fsSL -o /tmp/web-family-aid-pay-channels-v2.patch \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/aid-pulse-giving-e8cc/docs/web-family-aid-pay-channels-v2.patch"
git apply /tmp/web-family-aid-pay-channels-v2.patch

git add -A
git commit -m "feat(web): خانات مساهمة عثيم/كهرباء/إيجار/ماء لطلبات المساعدة"
git push origin main
```

ثم Hard Refresh على:
https://alzidan.org/pages/admin.html#module=giving

## SQL في Supabase (قبل الاعتماد بأرقام)

1. `supabase/sql/COPY-ME-family-aid-pay-channels-v1.sql`
2. `supabase/sql/COPY-ME-family-aid-need-kinds-v1.sql`

عند «اعتماد ونشر» يظهر اختيار القناة + الرقم.
