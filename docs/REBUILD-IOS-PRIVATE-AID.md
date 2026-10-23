# إعادة بناء التطبيق (أبناء الأرملة + طلب مساعدة)

المسار الصحيح على الماك:

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git fetch origin cursor/private-aid-requests-e8cc
git checkout cursor/private-aid-requests-e8cc
git pull origin cursor/private-aid-requests-e8cc
```

انسخ `.env.local` إن لم يكن موجوداً (نفس مفاتيح Supabase للمشروع).

ثم ابنِ التطبيق الأصلي — ليس Expo Go:

```bash
npx expo run:ios
```

### إذا ظهر: No space left on device

القرص ممتلئ (DerivedData / كاش Xcode). نفّذ ثم أعد البناء:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/Developer/Xcode/Archives/*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
df -h /
cd /Users/ahshryhy/Projects/alzidan-family-mobile
npx expo run:ios
```

إن بقي ضيقاً: احذف محاكيات قديمة من Xcode → Settings → Platforms، أو فرّغ سلة المهملات.

بعد التشغيل:

1. **ملفي** → يظهر أولاً زر **طلب مساعدة خاص (أرملة / مطلقة)**
2. **فتح بطاقتي** → شارة **أرملة** إن كان الزوج متوفى، وزر المساعدة، و**أبناؤك** مع **بناتك**

إذا ظهرت البنت فقط: من إدارة الويب اربط الأبناء تحت الزوجة (mother_links) أو تأكد أن `parent_name` للأبناء = مسار الزوج.
