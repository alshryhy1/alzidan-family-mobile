# Patch C — News Expiry Unification Report

**التاريخ:** 2026-08-07  
**الحالة:** مكتمل (تطبيق + ودجت)  
**المرجع:** [`alzidan-family/docs/ENGINEERING-ROADMAP.md`](../../alzidan-family/docs/ENGINEERING-ROADMAP.md) بند **4** · مسار **C أخبار/كاش** · ADR-008 · `NEWS-001` / `NEWS-002`  
**Depends on:** لا يعتمد على Patch بيانات؛ فلترة عرض + Timeline

---

## 1) المشكلة

| سطح | السلوك الخاطئ |
|-----|----------------|
| **Widget** | استعلام `event_date.gte.today OR event_date.is.null` يُظهر أخبارًا بلا تاريخ إلى الأبد، ويُخفي وفيات ما زالت ضمن 3 أيام إن كان التاريخ ماضيًا |
| **Widget Timeline** | 120 دقيقة بنفس اللقطة ثم `.atEnd` — أخبار منتهية تبقى حتى انتهاء النافذة (~ساعتين) بلا إعادة فلترة يومية |
| **التطبيق** | فلتر موجود في `App.tsx` لكن غير مستخرج كمصدر واحد؛ `showDays` من `details` لم يكن يُمرَّر من `publicData` |

---

## 2) القواعد الموحدة (مصدر الظهور)

| نوع | الظهور |
|-----|--------|
| **وفاة** | 3 أيام تقويمية من يوم الحدث؛ إن `event_date` null → من `created_at` |
| **غير وفاة** | ضمن `showDays` (1…7، افتراضي 7) من `created_at` (من envelope في `details`) |
| **أفراح مؤرخة** | تختفي بعد انتهاء يوم المناسبة (`diff < 0`) |
| **`event_date` null** | لا ظهور أبدي — `created_at` + `showDays` فقط |

---

## 3) الإصلاح

| ملف | التغيير |
|-----|---------|
| `src/utils/eventVisibility.ts` | مصدر ظهور TypeScript للتطبيق |
| `App.tsx` | يستخدم `isFamilyEventPubliclyVisible` بدل منطق مضمّن |
| `src/services/publicData.ts` | يمرّر `showDays` من envelope |
| `ios/.../AlzidanFamilyWidget.swift` | `EventVisibility` بنفس القواعد؛ جلب عيّنة + فلتر محلي؛ Timeline `.after(منتصف الليل التالي)` |
| `scripts/verify-news-expiry.mjs` | Smoke على نفس قواعد الويب |
| `package.json` | `verify:news-expiry` ضمن `verify:handover` |

**لا تغيير بيانات.** لا migration.

---

## 4) Compatibility Matrix

| المنصة | Affected | Verified | Not affected |
|--------|----------|----------|--------------|
| Web | ✅ يشارك نفس القواعد عبر `event-visibility.js` | ✅ `verify:news-expiry` (family) | — |
| Admin / Delegate | — | — | ✅ إدارة فقط |
| iOS app | ✅ | ✅ smoke + `tsc` | — |
| Widget | ✅ | ✅ منطق + Timeline (بناء Xcode عند الإصدار) | — |
| Android | ✅ نفس كود RN عند البناء | — | لاحقًا |

---

## 5) Cache Policy (ودجت)

| قبل | بعد |
|-----|-----|
| لقطات دقائق متكررة بنفس الأحداث، `.atEnd` | لقطة واحدة + `.after(next midnight + 5s)` |
| فلتر SQL ناقص | فلتر محلي موحّد بعد الجلب |

يتوافق مع خارطة الطريق §10: مسح/إعادة بناء عند انتهاء خبر.

---

## 6) معايير القبول

| المعيار | الحالة |
|---------|--------|
| لا خبر منتهٍ في التطبيق (فلتر موحّد) | ✅ |
| لا خبر منتهٍ في الودجت (فلتر موحّد) | ✅ منطق |
| `event_date` null لا يبقى أبدًا | ✅ |
| وفاة 3 أيام | ✅ smoke |
| أفراح بعد يوم المناسبة تختفي | ✅ smoke |
| Smoke | ✅ `npm run verify:news-expiry` |

---

## 7) Rollback

Revert commits مسار C في الموبايل (+ الويب إن لزم). لا rollback قاعدة بيانات.
