import { auth, db } from '../../core/firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');
let orgId = null;
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

function normalizePhone(phone) {
    return phone.replace(/\D/g, '');
}

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

        // 2. جلب معلومات المطعم وتطبيق التخصيص
        const profileSnap = await getDoc(doc(db, "restaurantProfiles", cardId));
        if (profileSnap.exists()) {
            const data = profileSnap.data();

            const body = document.getElementById('publicBody');
            const hero = document.getElementById('heroCover');
            const overlay = document.getElementById('heroOverlay');

            if (body && data.customBgColor && !data.customBgImage && !data.cover) {
                body.style.backgroundColor = data.customBgColor;
            }

            if (hero) {
                if (data.customBgImage) {
                    hero.style.backgroundImage = `url(${data.customBgImage})`;
                    if (overlay) {
                        const opacity = data.overlayOpacity ?? 0.6;
                        overlay.style.background = `rgba(0, 0, 0, ${opacity})`;
                    }
                } else if (data.cover) {
                    hero.style.backgroundImage = `url(${data.cover})`;
                } else if (data.customBgColor) {
                    hero.style.backgroundColor = data.customBgColor;
                }
            }

            // بيانات المطعم الأساسية
            const nameEl = document.getElementById('publicName');
            const descEl = document.getElementById('publicDesc');
            const hoursEl = document.getElementById('publicHours');

            if (nameEl) nameEl.innerText = data.name || 'مطعمنا';
            if (descEl) descEl.innerText = data.description || '';
            if (hoursEl) {
                hoursEl.innerHTML = data.hours
                    ? `<i class="fa-regular fa-clock"></i> ${data.hours}`
                    : '';
            }

            const logoEl = document.getElementById('publicLogo');
            if (logoEl) {
                if (data.logo) {
                    logoEl.src = data.logo;
                    logoEl.style.display = 'block';
                } else {
                    logoEl.style.display = 'none';
                }
            }

            // إعداد التقييم
            const ratingEl = document.getElementById('publicRating');
            if (ratingEl && data.rating) {
                ratingEl.style.display = 'inline-block';
                const ratingValEl = document.getElementById('ratingValue');
                const reviewsCountEl = document.getElementById('reviewsCount');
                if (ratingValEl) ratingValEl.innerText = data.rating;
                if (reviewsCountEl) reviewsCountEl.innerText = data.reviewsCount || '0';
            }

            // إعداد أزرار التواصل والموقع
            const callEl = document.getElementById('publicCall');
            if (callEl) {
                if (data.phone) callEl.href = `tel:${data.phone}`;
                else callEl.style.display = 'none';
            }

            const whatsappEl = document.getElementById('publicWhatsapp');
            if (whatsappEl) {
                if (data.whatsapp) {
                    whatsappEl.href = `https://wa.me/${normalizePhone(data.whatsapp)}`;
                } else {
                    whatsappEl.style.display = 'none';
                }
            }

            const mapsEl = document.getElementById('publicMaps');
            if (mapsEl) {
                if (data.maps) mapsEl.href = data.maps;
                else mapsEl.style.display = 'none';
            }
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

        const loadingEl = document.getElementById('loading');
        const menuContainerEl = document.getElementById('menuContainer');
        if (loadingEl) loadingEl.style.display = 'none';
        if (menuContainerEl) menuContainerEl.style.display = 'block';

    } catch (error) {
        console.error("Error loading menu:", error);
        showError();
    }
}

function renderMenu(categories, products) {
    const nav = document.getElementById('publicCatsNav');
    const list = document.getElementById('publicProductsList');
    if (!nav || !list) return;

    nav.innerHTML = '';

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

    renderProductsByCategory(categories[0].id, categories, products);
}

function filterProducts(catId, btnElement, categories, products) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    renderProductsByCategory(catId, categories, products);
}

function renderProductsByCategory(catId, categories, products) {
    const list = document.getElementById('publicProductsList');
    if (!list) return;

    const filtered = products.filter(p => p.categoryId === catId && p.status === 'available');

    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-center text-muted" style="padding:20px;">لا توجد منتجات متاحة في هذا القسم.</p>';
        return;
    }

    list.innerHTML = filtered.map(prod => `
        <div class="product-card">
            ${prod.image
                ? `<img src="${prod.image}" class="product-img" alt="${prod.name}">`
                : '<div class="product-img placeholder"><i class="fa-solid fa-utensils"></i></div>'
            }
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
    const loadingEl = document.getElementById('loading');
    const errorStateEl = document.getElementById('errorState');
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorStateEl) errorStateEl.style.display = 'block';
}

// ================= نظام الولاء (جلسات الكاشير) =================

window.openLoyaltyModal = () => {
    const modal = document.getElementById('loyaltyModal');
    if (modal) modal.style.display = 'flex';
};

const loyaltyForm = document.getElementById('loyaltyForm');
if (loyaltyForm) {
    loyaltyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('loyaltySubmitBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التسجيل...';
        }

        const name = document.getElementById('loyaltyName')?.value.trim() || '';
        const phone = document.getElementById('loyaltyPhone')?.value.trim() || '';

        try {
            const sessionRef = await addDoc(collection(db, "pos_sessions"), {
                organizationId: orgId,
                cardId: cardId,
                customerId: currentUser ? currentUser.uid : null,
                customerName: name,
                customerPhone: phone || null,
                status: 'pending',
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 15 * 60000)
            });

            window.location.href = `loyalty.html?session=${sessionRef.id}&card=${cardId}`;
        } catch (error) {
            console.error("Error joining loyalty:", error);
            alert("حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى.");
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'متابعة';
            }
        }
    });
}

// ================= نظام حسابات الزبائن =================

window.checkLoyaltyAuth = () => {
    const activeUser = auth.currentUser || currentUser;
    if (activeUser) {
        window.location.href = `loyalty.html?id=${cardId}`;
    } else {
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.style.display = 'flex';
    }
};

window.showSignupForm = () => {
    const step1 = document.getElementById('authStep1');
    const step2 = document.getElementById('authStep2');
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';
};

window.showLoginForm = () => {
    const step2 = document.getElementById('authStep2');
    const step1 = document.getElementById('authStep1');
    if (step2) step2.style.display = 'none';
    if (step1) step1.style.display = 'block';
};

window.loginCustomer = async () => {
    const rawPhone = document.getElementById('authPhone')?.value.trim() || '';
    const password = document.getElementById('authPassword')?.value || '';
    const phone = normalizePhone(rawPhone);

    if (!phone || !password) return alert("أدخل البيانات كاملة");

    try {
        await signInWithEmailAndPassword(auth, `${phone}@customer.techluxury`, password);
        window.location.href = `loyalty.html?id=${cardId}`;
    } catch (error) {
        console.error("Login error:", error);
        alert("خطأ في تسجيل الدخول: تأكد من رقم الهاتف وكلمة المرور");
    }
};

window.registerCustomer = async () => {
    const name = document.getElementById('signupName')?.value.trim() || '';
    const rawPhone = document.getElementById('signupPhone')?.value.trim() || '';
    const password = document.getElementById('signupPassword')?.value || '';
    const confirm = document.getElementById('signupConfirmPassword')?.value || '';
    const terms = document.getElementById('signupTerms')?.checked || false;
    const phone = normalizePhone(rawPhone);

    if (!name || !phone || !password) return alert("أدخل البيانات كاملة");
    if (password !== confirm) return alert("كلمات المرور غير متطابقة");
    if (!terms) return alert("يجب الموافقة على الشروط");

    try {
        const userCred = await createUserWithEmailAndPassword(auth, `${phone}@customer.techluxury`, password);

        await setDoc(doc(db, "customers", userCred.user.uid), {
            name: name,
            phone: phone,
            createdAt: serverTimestamp()
        });

        window.location.href = `loyalty.html?id=${cardId}`;
    } catch (error) {
        console.error("Registration error:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("رقم الهاتف مسجل مسبقاً، يرجى تسجيل الدخول.");
        } else {
            alert("حدث خطأ: " + error.message);
        }
    }
};

initPublicPage();
