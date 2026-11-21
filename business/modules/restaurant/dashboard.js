import { auth, db } from '../../core/firebase-config.js';
import { onAuthChange, getCurrentOrganization } from '../../core/auth.js';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');
let currentOrg = null;
let currentCategories = [];
let currentProducts = [];

// تحديث رابط المعاينة
if (cardId) {
    document.getElementById('previewLink').href = `public.html?id=${cardId}`;
}

onAuthChange(async (user) => {
    if (!user) { window.location.href = "../../auth/login.html"; return; }
    currentOrg = await getCurrentOrganization(user.uid);
    if (!currentOrg || !cardId) { alert("بيانات غير صالحة"); return; }

    loadRestaurantInfo();
    loadCategories();
    loadProducts();
});

// ================= التبويبات =================
document.querySelectorAll('.sidebar li').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.sidebar li').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');
    });
});

// ================= معلومات المطعم =================
async function loadRestaurantInfo() {
    const docRef = doc(db, "restaurantProfiles", cardId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('infoName').value = data.name || '';
        document.getElementById('infoLogo').value = data.logo || '';
        document.getElementById('infoCover').value = data.cover || '';
        document.getElementById('infoDesc').value = data.description || '';
        document.getElementById('infoPhone').value = data.phone || '';
        document.getElementById('infoWhatsapp').value = data.whatsapp || '';
        document.getElementById('infoAddress').value = data.address || '';
        document.getElementById('infoMaps').value = data.maps || '';
        document.getElementById('infoHours').value = data.hours || '';
        document.getElementById('infoRating').value = data.rating || '';
        document.getElementById('infoReviewsCount').value = data.reviewsCount || '';
    }
}

document.getElementById('restaurantInfoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        organizationId: currentOrg.orgId,
        cardId: cardId,
        name: document.getElementById('infoName').value,
        logo: document.getElementById('infoLogo').value,
        cover: document.getElementById('infoCover').value,
        description: document.getElementById('infoDesc').value,
        phone: document.getElementById('infoPhone').value,
        whatsapp: document.getElementById('infoWhatsapp').value,
        address: document.getElementById('infoAddress').value,
        maps: document.getElementById('infoMaps').value,
        hours: document.getElementById('infoHours').value,
        updatedAt: serverTimestamp(),
        rating: parseFloat(document.getElementById('infoRating').value) || null,
        reviewsCount: parseInt(document.getElementById('infoReviewsCount').value) || null
    };
    await setDoc(doc(db, "restaurantProfiles", cardId), data, { merge: true });
    alert("✅ تم حفظ المعلومات");
});

// ================= الأقسام =================
function loadCategories() {
    const q = query(collection(db, "restaurantCategories"), where("cardId", "==", cardId));
    onSnapshot(q, (snapshot) => {
        currentCategories = [];
        const list = document.getElementById('categoriesList');
        list.innerHTML = '';
        
        snapshot.forEach(doc => {
            const cat = { id: doc.id, ...doc.data() };
            currentCategories.push(cat);
            list.innerHTML += `
                <div class="list-item">
                    <span>${cat.name}</span>
                    <div class="actions">
                        <button onclick="deleteCategory('${cat.id}')" class="btn-icon text-danger"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    });
}

window.openCategoryModal = () => {
    document.getElementById('modalBody').innerHTML = `
        <h2>إضافة قسم جديد</h2>
        <form id="catForm">
            <div class="form-group"><label>اسم القسم</label><input type="text" id="catName" required></div>
            <button type="submit" class="btn-primary">إضافة</button>
        </form>
    `;
    document.getElementById('catForm').onsubmit = async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "restaurantCategories"), {
            organizationId: currentOrg.orgId,
            cardId: cardId,
            name: document.getElementById('catName').value,
            createdAt: serverTimestamp()
        });
        closeModal();
    };
    document.getElementById('globalModal').style.display = 'flex';
};

window.deleteCategory = async (id) => {
    if(confirm("هل أنت متأكد من حذف هذا القسم؟")) {
        await deleteDoc(doc(db, "restaurantCategories", id));
    }
};

// ================= المنتجات =================
function loadProducts() {
    const q = query(collection(db, "restaurantProducts"), where("cardId", "==", cardId));
    onSnapshot(q, (snapshot) => {
        currentProducts = [];
        const list = document.getElementById('productsList');
        list.innerHTML = '';
        
        snapshot.forEach(doc => {
            const prod = { id: doc.id, ...doc.data() };
            currentProducts.push(prod);
            
            // البحث عن اسم القسم
            const catName = currentCategories.find(c => c.id === prod.categoryId)?.name || 'غير محدد';
            
            list.innerHTML += `
                <div class="list-item">
                    <div>
                        <strong>${prod.name}</strong> - ${prod.price} د.أ
                        <div style="font-size: 0.8rem; color: var(--text-muted);">القسم: ${catName}</div>
                    </div>
                    <div class="actions">
                        <button onclick="deleteProduct('${prod.id}')" class="btn-icon text-danger"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    });
}

window.openProductModal = () => {
    if(currentCategories.length === 0) return alert("الرجاء إضافة قسم واحد على الأقل أولاً.");
    
    const catOptions = currentCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    document.getElementById('modalBody').innerHTML = `
        <h2>إضافة منتج جديد</h2>
        <form id="prodForm">
            <div class="form-group"><label>اسم المنتج</label><input type="text" id="prodName" required></div>
            <div class="form-group"><label>السعر</label><input type="number" id="prodPrice" step="0.01" required></div>
            <div class="form-group"><label>القسم</label><select id="prodCat" required>${catOptions}</select></div>
            <div class="form-group"><label>رابط الصورة</label><input type="url" id="prodImage"></div>
            <div class="form-group"><label>الوصف</label><textarea id="prodDesc" rows="2"></textarea></div>
            <button type="submit" class="btn-primary">إضافة</button>
        </form>
    `;
    document.getElementById('prodForm').onsubmit = async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "restaurantProducts"), {
            organizationId: currentOrg.orgId,
            cardId: cardId,
            name: document.getElementById('prodName').value,
            price: parseFloat(document.getElementById('prodPrice').value),
            categoryId: document.getElementById('prodCat').value,
            image: document.getElementById('prodImage').value,
            description: document.getElementById('prodDesc').value,
            status: 'available',
            createdAt: serverTimestamp()
        });
        closeModal();
    };
    document.getElementById('globalModal').style.display = 'flex';
};

window.deleteProduct = async (id) => {
    if(confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
        await deleteDoc(doc(db, "restaurantProducts", id));
    }
};

window.closeModal = () => {
    document.getElementById('globalModal').style.display = 'none';
};
