import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ضع إعداداتك هنا
const firebaseConfig = {
  apiKey: "AIzaSyBZcGZQpBZi6RwMeBnL4UcdrBQyZHXsLWY",
  authDomain: "techluxury-4b854.firebaseapp.com",
  projectId: "techluxury-4b854",
  // ... باقي الإعدادات
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// استخراج رقم الكرت من الرابط (مثلاً: restaurant-menu.html?card=ABC123)
const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('card');
const container = document.getElementById('menuContainer');

if (!cardId) {
    container.innerHTML = `<h2 style="text-align:center; color:#ef4444;">خطأ: لم يتم العثور على كود الكرت</h2>`;
} else {
    loadRestaurantData(cardId);
}

async function loadRestaurantData(id) {
    try {
        // 1. جلب بيانات المطعم
        const cardRef = doc(db, "cards", id);
        const cardSnap = await getDoc(cardRef);

        if (!cardSnap.exists() || cardSnap.data().type !== 'restaurant-menu') {
            container.innerHTML = `<h2 style="text-align:center;">المنيو غير متوفر أو الكرت غير صالح</h2>`;
            return;
        }

        const data = cardSnap.data();
        
        // تحديث واجهة الهيدر
        document.title = data.title || "المنيو الإلكتروني";
        document.getElementById('restaurantName').innerText = data.title || "اسم المطعم";
        
        if (data.message) { // استخدمنا حقل message للوصف
            document.getElementById('restaurantDesc').innerText = data.message;
            document.getElementById('restaurantDesc').style.display = 'block';
        }

        if (data.logoUrl) {
            document.getElementById('logoPlaceholder').style.display = 'none';
            const img = document.getElementById('restaurantLogo');
            img.src = data.logoUrl;
            img.style.display = 'inline-block';
        }

        if (data.phone) {
            const callBtn = document.getElementById('btnCall');
            callBtn.style.display = 'flex';
            callBtn.onclick = () => window.location.href = `tel:${data.phone}`;
        }

        // 2. جلب الأقسام والأصناف
        await fetchMenu(id);

    } catch (error) {
        console.error(error);
        container.innerHTML = `<h2 style="text-align:center; color:#ef4444;">حدث خطأ أثناء تحميل المنيو</h2>`;
    }
}

async function fetchMenu(id) {
    // جلب الأقسام مرتبة
    const catQuery = query(collection(db, `cards/${id}/categories`), orderBy("order", "asc"));
    const catSnap = await getDocs(catQuery);

    // جلب الأصناف مرتبة
    const itemsQuery = query(collection(db, `cards/${id}/items`), orderBy("order", "asc"));
    const itemsSnap = await getDocs(itemsQuery);

    if (catSnap.empty) {
        container.innerHTML = `<p style="text-align:center;">لم يتم إضافة أي أقسام للمنيو بعد.</p>`;
        return;
    }

    const categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderMenu(categories, items);
}

function renderMenu(categories, items) {
    container.innerHTML = ""; // مسح علامة التحميل
    const nav = document.getElementById('categoriesNav');
    nav.innerHTML = "";

    categories.forEach((cat, index) => {
        // إضافة زر في شريط التنقل
        const btn = document.createElement('button');
        btn.className = `cat-btn ${index === 0 ? 'active' : ''}`;
        btn.innerText = cat.name;
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`cat-${cat.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        nav.appendChild(btn);

        // إضافة قسم في الصفحة
        const section = document.createElement('section');
        section.className = 'category-section';
        section.id = `cat-${cat.id}`;
        section.innerHTML = `<h2 class="category-title">${cat.name}</h2>`;

        const grid = document.createElement('div');
        grid.className = 'items-grid';

        const catItems = items.filter(i => i.categoryId === cat.id);

        if (catItems.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted);">لا توجد أصناف في هذا القسم.</p>`;
        } else {
            catItems.forEach(item => {
                const isAvailable = item.available !== false;
                grid.innerHTML += `
                    <div class="menu-item ${!isAvailable ? 'item-unavailable' : ''}">
                        ${item.imageUrl 
                            ? `<img src="${item.imageUrl}" class="item-img" alt="${item.name}">` 
                            : `<div class="item-img" style="display:flex; justify-content:center; align-items:center; color:#94a3b8;"><i class="fa-solid fa-utensils"></i></div>`
                        }
                        <div class="item-details">
                            <h3 class="item-name">${item.name}</h3>
                            <p class="item-desc">${item.description || ""}</p>
                            <span class="item-price">${item.price} د.أ</span>
                        </div>
                    </div>
                `;
            });
        }

        section.appendChild(grid);
        container.appendChild(section);
    });
}

// فتح صفحة الولاء
window.openLoyalty = function() {
    window.location.href = `restaurant-loyalty.html?card=${cardId}`;
};
