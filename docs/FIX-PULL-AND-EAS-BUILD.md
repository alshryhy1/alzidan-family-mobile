# سحب الإصلاح ثم بناء EAS (مهم)

آخر بناء فشل لأن `git pull` توقف بسبب تعديلات محلية على `app.json`، فـ EAS بنى **بدون** إصلاح الـ Podfile.

انسخ هذا بالكامل في التيرمنال:

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git stash push -u -m "local before pull"
git fetch origin cursor/private-aid-requests-e8cc
git checkout cursor/private-aid-requests-e8cc
git reset --hard origin/cursor/private-aid-requests-e8cc
grep -n "IPHONEOS_DEPLOYMENT_TARGET" ios/Podfile
grep buildNumber app.json
npx eas-cli build --platform ios --profile production
```

لازم يظهر في مخرجات `grep` على Podfile سطر فيه `IPHONEOS_DEPLOYMENT_TARGET`، وفي app.json `"buildNumber": "68"` (أو أعلى بعد autoIncrement).

بعد نجاح البناء فقط:

```bash
npx eas-cli submit --platform ios --profile production --latest
```
