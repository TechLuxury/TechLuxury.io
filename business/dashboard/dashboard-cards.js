import { auth, db } from '../core/firebase-config.js';
import { onAuthChange, getCurrentOrganization } from '../core/auth.js';
import { getEnabledCardTypes } from '../core/registry/card-registry.js';
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentOrg = null;

onAuthChange(async (user) => {
    if (!user) { window.location.href = "../auth/login.html"; return; }
    currentOrg = await getCurrentOrganization(user.uid);
    if (!currentOrg) { return; }

    loadCards();
    renderCardTypesModal();
});

// عرض الكروت
function loadCards() {
    const cardsRef = collection(db, "businessCards");
    const q = query(cardsRef, where("organizationId", "==", currentOrg.orgId));

    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('cardsTableBody');
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد كروت. ابدأ بإنشاء كرت جديد.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const card = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td><strong>${card.title || 'بدون عنوان'}</strong></td>
                    <td>${card.typeId}</td>
                    <td>${doc.id}</td>
                    <td><span class="badge ${card.status}">${card.status === 'active' ? 'نشط' : 'معطل'}</span></td>
                    <td>${card.createdAt ? new Date(card.createdAt.toMillis()).toLocaleDateString('ar-EG') : 'الآن'}</td>
                    <td>
                        <button class="btn-icon" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon" title="رابط NFC"><i class="fa-solid fa-qrcode"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

// عرض نافذة إنشاء كرت
const modal = document.getElementById('createCardModal');
document.getElementById('btnCreateCard').onclick = () => modal.style.display = 'flex';
document.getElementById('closeModal').onclick = () => modal.style.display = 'none';

// توليد أنواع الكروت من الـ Registry
function renderCardTypesModal() {
    const grid = document.getElementById('cardTypesGrid');
    const types = getEnabledCardTypes();
    
    grid.innerHTML = types.map(type => `
        <div class="card-type-option" onclick="createCard('${type.typeId}')">
            <i class="fa-solid ${type.icon}"></i>
            <h3>${type.name}</h3>
            <p>${type.description}</p>
        </div>
    `).join('');
}

// إنشاء الكرت (المنطق الأساسي المشترك)
window.createCard = async function(typeId) {
    const cardId = Math.random().toString(36).substring(2, 10).toUpperCase(); // ID عشوائي
    modal.style.display = 'none';

    try {
        const cardRef = doc(db, "businessCards", cardId);
        await setDoc(cardRef, {
            cardId: cardId,
            organizationId: currentOrg.orgId,
            typeId: typeId,
            title: `كرت ${typeId} جديد`,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: auth.currentUser.uid
        });

        alert(`✅ تم إنشاء الكرت بنجاح! معرف الكرت: ${cardId}`);
        
        // التوجيه لصفحة الإدارة الخاصة بالنوع (سيتم تفعيلها في المراحل القادمة)
        const typeConfig = getEnabledCardTypes().find(t => t.typeId === typeId);
        if (typeConfig && typeConfig.dashboardPath) {
            // تأجيل التوجيه حتى يتم بناء الموديول، أو توجيهه لصفحة الـ cards مؤقتاً
            // window.location.href = `${typeConfig.dashboardPath}?id=${cardId}`;
            alert("سيتم توجيهك لصفحة الإدارة في المرحلة القادمة بعد بناء الموديول.");
        }

    } catch (error) {
        console.error(error);
        alert("❌ حدث خطأ أثناء إنشاء الكرت: " + error.message);
    }
};
