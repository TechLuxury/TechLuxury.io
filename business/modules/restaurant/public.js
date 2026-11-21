import { db } from '../../core/firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');
let orgId = null;

async function initPublicPage() {
    if (!cardId) return showError();

    try {
        // 1. التحقق من حالة الكرت
        const cardRef = doc(db, "businessCards", cardId);
        const cardSnap = await getDoc(cardRef);
        
        if (!cardSnap.exists() || cardSnap.data().status !== 'active') {
            return showError();
        }
        
        orgId = cardSnap.data().organizationId;

        // 2. جلب معلومات المطعم
        const profileSnap = await getDoc(doc(db, "restaurantProfiles", cardId));
        if (profileSnap.exists()) {
            const data = profileSnap.data();
            document.getElementById('publicName').innerText = data.name || 'مطعمنا';
            document.getElementById('publicDesc').innerText = data.description || '';
            document.getElementById('publicHours').innerHTML = data.hours ? `<i class="fa-regular fa-clock"></i> ${data.hours}` : '';
            
            if (data.logo) {
                const logoEl = document.getElementById('publicLogo');
                logoEl.src = data.logo;
                logoEl.style.display = 'block';
            }
            if (data.cover) {
                document.getElementById('heroCover').style.backgroundImage = `url(${data.cover})`;
            }

            // إعداد التقييم
            if (data.rating) {
                document.getElementById('publicRating').style.display = 'inline-block';
                document.getElementById('ratingValue').innerText = data.rating;
                document.getElementById('reviewsCount').innerText = data.reviewsCount || '0';
            }

            // إعداد الأزرار
            if (data.phone) document.getElementById('publicCall').href = `tel:${data.phone}`;
            else document.getElementById('publicCall').style.display = 'none';

            if (data.whatsapp) document.getElementById('publicWhatsapp').href = `https://wa.me/${data.whatsapp.replace(/\D/g,'')}`;
            else document.getElementById('publicWhatsapp').style.display = 'none';

            if (data.maps) document.getElementById('publicMaps').href = data.maps;
            else document.getElementById('publicMaps').style.display = 'none';
        }

        // 3. جلب الأقسام والمنتجات
        const [catsSnap, prodsSnap] = await Promise.all([
            getDocs(query(collection(db, "restaurantCategories"), where("cardId", "==", cardId))),
            getDocs(query(collection(db, "restaurantProducts"), where("cardId", "==", cardId)))
        ]);

        const categories = [];
        catsSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));
        
        const products = [];
        prodsSnap.forEach(d => products.push({ id: d.id, ...d.data() }));

        renderMenu(categories, products);

        document.getElementById('loading').style.display = 'none';
        document.getElementById('menuContainer').style.display = 'block';

    } catch (error) {
        console.error("Error loading menu:", error);
        showError();
    }
}

function renderMenu(categories, products) {
    const nav = document.getElementById('publicCatsNav');
    const list = document.getElementById('publicProductsList');

    if (categories.length === 0) {
        list.innerHTML = '<p class="text-center">لا توجد منتجات مضافة حالياً.</p>';
        return;
    }

    categories.forEach((cat, index) => {
        const btn = document.createElement('button');
        btn.className = `cat-btn ${index === 0 ? 'active' : ''}`;
        btn.innerText = cat.name;
        btn.onclick = () => filterProducts(cat.id, btn, categories, products);
        nav.appendChild(btn);
    });

    if (categories.length > 0) {
        renderProductsByCategory(categories[0].id, categories, products);
    }
}

function filterProducts(catId, btnElement, categories, products) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    renderProductsByCategory(catId, categories, products);
}

function renderProductsByCategory(catId, categories, products) {
    const list = document.getElementById('publicProductsList');
    const filtered = products.filter(p => p.categoryId === catId && p.status === 'available');
    
    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-center text-muted" style="padding:20px;">لا توجد منتجات متاحة في هذا القسم.</p>';
        return;
    }

    list.innerHTML = filtered.map(prod => `
        <div class="product-card">
            ${prod.image ? `<img src="${prod.image}" class="product-img" alt="${prod.name}">` : '<div class="product-img placeholder"><i class="fa-solid fa-utensils"></i></div>'}
            <div class="product-info">
                <div class="product-title-row">
                    <h3>${prod.name}</h3>
                    <span class="product-price">${prod.price} د.أ</span>
                </div>
                <p class="text-muted">${prod.description || ''}</p>
            </div>
        </div>
    `).join('');
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
}

// ================= نظام الولاء =================

window.openLoyaltyModal = () => {
    document.getElementById('loyaltyModal').style.display = 'flex';
};

document.getElementById('loyaltyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loyaltySubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التسجيل...';

    const name = document.getElementById('loyaltyName').value.trim();
    const phone = document.getElementById('loyaltyPhone').value.trim();

    try {
        // 1. إنشاء جلسة في طابور الانتظار (pos_sessions)
        const sessionRef = await addDoc(collection(db, "pos_sessions"), {
            organizationId: orgId,
            cardId: cardId,
            customerName: name,
            customerPhone: phone || null,
            status: 'pending',
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 15 * 60000) // تنتهي الجلسة بعد 15 دقيقة
        });

        // 2. التوجيه إلى صفحة الولاء الخاصة بالعميل مع تمرير معرف الجلسة
        window.location.href = `loyalty.html?session=${sessionRef.id}&card=${cardId}`;

    } catch (error) {
        console.error("Error joining loyalty:", error);
        alert("حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى.");
        btn.disabled = false;
        btn.innerText = 'متابعة';
    }
});

initPublicPage();
