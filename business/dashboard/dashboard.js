import { auth, db } from '../core/firebase-config.js';
import { onAuthChange, getCurrentOrganization, logout } from '../core/auth.js';
import { collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentOrg = null;

// التحقق من حالة الدخول
onAuthChange(async (user) => {
    if (!user) {
        window.location.href = "../auth/login.html";
        return;
    }

    currentOrg = await getCurrentOrganization(user.uid);
    if (!currentOrg) {
        alert("خطأ: لم يتم العثور على بيانات المؤسسة.");
        await logout();
        return;
    }

    // تحديث الواجهة
    document.getElementById('orgNameDisplay').innerText = currentOrg.name;
    document.getElementById('managerNameDisplay').innerText = currentOrg.managerName;

    loadDashboardStats();
});

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logout();
    window.location.href = "../auth/login.html";
});

// جلب الإحصائيات والكروت
function loadDashboardStats() {
    const cardsRef = collection(db, "businessCards");
    const q = query(cardsRef, where("organizationId", "==", currentOrg.orgId));

    onSnapshot(q, (snapshot) => {
        let total = snapshot.size;
        let active = 0;
        let disabled = 0;
        let recentCards = [];

        snapshot.forEach(doc => {
            const card = doc.data();
            if (card.status === 'active') active++;
            if (card.status === 'disabled') disabled++;
            recentCards.push({ id: doc.id, ...card });
        });

        // ترتيب الكروت حسب تاريخ الإنشاء (الأحدث أولاً)
        recentCards.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

        // تحديث الأرقام
        document.getElementById('totalCards').innerText = total;
        document.getElementById('activeCards').innerText = active;
        document.getElementById('disabledCards').innerText = disabled;

        // عرض آخر 3 كروت
        const recentContainer = document.getElementById('recentCards');
        if (recentCards.length === 0) {
            recentContainer.innerHTML = '<p class="text-muted">لم يتم إنشاء أي كروت بعد.</p>';
            return;
        }

        recentContainer.innerHTML = recentCards.slice(0, 3).map(card => `
            <div class="card-item">
                <div>
                    <strong>${card.title || 'كرت بدون عنوان'}</strong>
                    <span class="badge ${card.status}">${card.status === 'active' ? 'نشط' : 'معطل'}</span>
                </div>
                <div class="card-type">${card.typeId}</div>
            </div>
        `).join('');
    });
}
