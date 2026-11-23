import { auth, db } from '../../core/firebase-config.js';
import { onAuthChange, getCurrentOrganization } from '../../core/auth.js';
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const storage = getStorage();
const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');
let currentOrg = null;
let currentCategories = [];
let currentProducts = [];

// تحديث رابط المعاينة
if (cardId) {
    const previewLink = document.getElementById('previewLink');
    if (previewLink) {
        previewLink.href = `public.html?id=${cardId}`;
    }
}

onAuthChange(async (user) => {
    if (!user) {
        window.location.href = "../../auth/login.html";
        return;
    }
    currentOrg = await getCurrentOrganization(user.uid);
    if (!currentOrg || !cardId) {
        alert("بيانات غير صالحة");
        return;
    }

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
        const targetTab = document.getElementById(`tab-${item.dataset.tab}`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
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

        // تحميل إعدادات التصميم الحالية إن وجدت
        const overlayInput = document.getElementById('bgOverlay');
        const overlayValue = document.getElementById('bgOverlayValue');
        const colorInput = document.getElementById('bgColor');

        if (overlayInput && typeof data.overlayOpacity === 'number') {
            overlayInput.value = data.overlayOpacity;
            if (overlayValue) overlayValue.innerText = data.overlayOpacity;
        }
        if (colorInput && data.customBgColor) {
            colorInput.value = data.customBgColor;
        }
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
    if (confirm("هل أنت متأكد من حذف هذا القسم؟")) {
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
    if (currentCategories.length === 0) return alert("الرجاء إضافة قسم واحد على الأقل أولاً.");

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
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
        await deleteDoc(doc(db, "restaurantProducts", id));
    }
};

window.closeModal = () => {
    document.getElementById('globalModal').style.display = 'none';
};

// ================= تخصيص التصميم =================
window.saveDesignSettings = async (event) => {
    const file = document.getElementById('bgImageFile').files[0];
    const overlay = parseFloat(document.getElementById('bgOverlay').value);
    const color = document.getElementById('bgColor').value;
    const btn = event?.currentTarget || document.querySelector('#tab-design .btn-primary');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
    }

    try {
        const updateData = {
            organizationId: currentOrg.orgId,
            cardId: cardId,
            overlayOpacity: isNaN(overlay) ? 0.6 : overlay,
            customBgColor: color,
            updatedAt: serverTimestamp()
        };

        if (file) {
            const storageRef = ref(storage, `restaurant_backgrounds/${cardId}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            updateData.customBgImage = url;
        }

        await setDoc(doc(db, "restaurantProfiles", cardId), updateData, { merge: true });
        alert("✅ تم حفظ إعدادات التصميم بنجاح");
    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء الحفظ: " + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ التصميم';
        }
    }
};
