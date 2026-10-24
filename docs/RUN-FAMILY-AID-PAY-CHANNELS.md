# قنوات المساهمة لفرص المساعدة (عثيم / سوا)

## المسار

1. المستفيدة ترسل طلباً سرياً (أرملة/مطلقة) من **ملفي** أو **تبرع → فرص مساعدة → تقديم طلب**.
2. الإدارة تعتمد وتنشر مع اختيار قناة المساهمة:
   - **بطاقة العثيم** + رقم البطاقة
   - **سداد فاتورة سوا — كهرباء** + رقم/مرجع الفاتورة
   - **سداد فاتورة سوا — إيجار** + رقم/مرجع الفاتورة
   - أو صندوق العائلة عند الحاجة
3. في التطبيق يظهر الطلب **بلا اسم ولا جوال**:
   - **نبض** (الرئيسية): نوع الطلب + الاحتياج + تلميح القناة → تفاصيل من تبرع
   - **تبرع → فرص مساعدة**: النوع + الاحتياج + رقم البطاقة/الفاتورة للمساهمة

## 1) SQL مرة واحدة (بعد طلبات المساعدة)

Supabase → SQL Editor → Run:

`docs/COPY-ME-family-aid-pay-channels-v1.sql`

يتطلب أن يكون `docs/COPY-ME-family-aid-requests-v1.sql` منفّذاً مسبقاً.

## 2) تحديث لوحة الإدارة على alzidan.org

```bash
cd ~/alzidan-family
git checkout main && git pull origin main
curl -fsSL -o /tmp/web-family-aid-pay-channels-v1.patch \
  "https://raw.githubusercontent.com/alshryhy1/alzidan-family-mobile/cursor/aid-pulse-giving-e8cc/docs/web-family-aid-pay-channels-v1.patch"
git apply /tmp/web-family-aid-pay-channels-v1.patch
git add -A
git commit -m "feat(web): قنوات مساهمة عثيم/سوا لطلبات المساعدة"
git push origin main
```

ثم Hard Refresh → صدقة ودعم → طلبات المساعدة → اعتماد ونشر واختيار القناة.

## 3) التطبيق

فرع: `cursor/aid-pulse-giving-e8cc`

```bash
cd ~/alzidan-family-mobile
git fetch origin
git checkout cursor/aid-pulse-giving-e8cc
git pull origin cursor/aid-pulse-giving-e8cc
npm install
npx expo start -c
```
