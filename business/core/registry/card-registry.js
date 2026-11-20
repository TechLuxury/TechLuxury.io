// نظام مركزي لتسجيل أنواع الكروت المتاحة
export const CardRegistry = {
    restaurant: {
        typeId: 'restaurant',
        name: 'مطعم',
        description: 'إدارة قائمة الطعام والمطعم',
        icon: 'fa-utensils',
        thumbnail: '',
        dashboardPath: '/business/modules/restaurant/dashboard.html', // سيتم بناؤه في المرحلة 2
        publicPagePath: '/business/modules/restaurant/public.html',   // سيتم بناؤه في المرحلة 2
        permissions: ['org_owner', 'org_manager'],
        enabled: true
    },
    gym: {
        typeId: 'gym',
        name: 'جيم / نادي رياضي',
        description: 'إدارة الاشتراكات والخدمات',
        icon: 'fa-dumbbell',
        thumbnail: '',
        dashboardPath: '/business/modules/gym/dashboard.html',        // سيتم بناؤه في المرحلة 3
        publicPagePath: '/business/modules/gym/public.html',          // سيتم بناؤه في المرحلة 3
        permissions: ['org_owner', 'org_manager'],
        enabled: true
    }
};

// دالة لجلب الأنواع المفعلة فقط (لاستخدامها في واجهة إنشاء الكروت)
export function getEnabledCardTypes() {
    return Object.values(CardRegistry).filter(type => type.enabled);
}

// دالة لجلب بيانات نوع معين
export function getCardType(typeId) {
    return CardRegistry[typeId] || null;
}
