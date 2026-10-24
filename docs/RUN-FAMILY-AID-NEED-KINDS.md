# أنواع طلب المساعدة + خانة الرقم

عند تقديم الطلب تختار المستفيدة:

1. فاتورة كهرباء → خانة **رقم الفاتورة**
2. عقد إيجار → خانة **رقم العقد**
3. فاتورة ماء → خانة **رقم الفاتورة**
4. بطاقة العثيم → خانة **رقم البطاقة**

بعد اعتماد الإدارة تُنشر نفس الخانة للعامة للمساهمة (بلا اسم).

## SQL (مرة)

بعد SQL طلبات المساعدة وقنوات الدفع، شغّل:

`docs/COPY-ME-family-aid-need-kinds-v1.sql`

## التطبيق

فرع: `cursor/aid-pulse-giving-e8cc`

```bash
cd /Users/ahshryhy/Projects/alzidan-family-mobile
git pull origin cursor/aid-pulse-giving-e8cc
npx expo run:ios
```
