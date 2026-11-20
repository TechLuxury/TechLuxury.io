# دليل إضافة نوع كرت جديد (مثال: Clinic)

لإضافة نوع كرت جديد (مثل عيادة) إلى النظام، اتبع الخطوات التالية:

## 1. إنشاء مجلد الموديول
أنشئ المجلد `/business/modules/clinic/` وضع فيه:
- `dashboard.html` (واجهة الإدارة)
- `dashboard.js` (منطق الإدارة)
- `public.html` (الواجهة العامة للزوار)
- `public.js` (منطق جلب البيانات للزوار)
- `styles.css` (تنسيقات خاصة بالعيادة فقط)

## 2. تسجيل النوع في Registry
افتح الملف `/business/core/registry/card-registry.js` وأضف الكائن التالي:
```javascript
clinic: {
    typeId: 'clinic',
    name: 'عيادة',
    description: 'إدارة مواعيد وخدمات العيادة',
    icon: 'fa-stethoscope',
    dashboardPath: '/business/modules/clinic/dashboard.html',
    publicPagePath: '/business/modules/clinic/public.html',
    enabled: true
}
