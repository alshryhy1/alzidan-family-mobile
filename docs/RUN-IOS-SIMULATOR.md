# تشغيل التطبيق على محاكي iOS (بدون Expo Go)

استخدم مجلد المشروع الذي فيه `.env` فقط:

`/Users/ahshryhy/Projects/alzidan-family-mobile`

(لا تستخدم `~/alzidan-family-mobile` إن كان بلا `.env`.)

## 1) أوقف Metro القديم من المجلد الخطأ

```bash
kill 22212 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
lsof -ti:8083 | xargs kill -9 2>/dev/null || true
```

## 2) فرع + اعتماديات نظيفة

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git fetch origin cursor/aid-pulse-giving-e8cc
git checkout cursor/aid-pulse-giving-e8cc
git pull origin cursor/aid-pulse-giving-e8cc
git checkout -- package-lock.json

ls -la .env .env.local
npm install
```

## 3) إصلاح خطأ `EXBundleConfiguration.h`

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
rm -rf ios/Pods ios/build ios/Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/*
npx pod-install
npx expo run:ios
```

هذا يبني التطبيق الأصلي ويفتح المحاكي (ليس Expo Go).

## إن فشل البناء مرة أخرى

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile/ios
pod deintegrate
pod install --repo-update
cd ..
npx expo run:ios
```
