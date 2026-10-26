// ===== استيراد Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc,
    setDoc, 
    onSnapshot, 
    updateDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===== إعدادات Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyBZcGZQpBZi6RwMeBnL4UcdrBQyZHXsLWY",
  authDomain: "techluxury-4b854.firebaseapp.com",
  projectId: "techluxury-4b854",
  storageBucket: "techluxury-4b854.firebasestorage.app",
  messagingSenderId: "1043863547919",
  appId: "1:1043863547919:web:46bd7c74f0fbeb2702b37a",
  measurementId: "G-EZJWPY4Q2Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ مخزّن مؤقت لأسماء العملاء (cache)
const customersCache = new Map();

// ============================================================
// 🔐 التحقق من صلاحيات الأدمن
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log("⚠️ لا يوجد مستخدم مسجّل دخول");
        window.location.href = "login.html";
        return;
    }

    try {
        const adminDocRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (!adminSnap.exists()) {
            console.error("❌ هذا المستخدم ليس أدمن");
            alert("❌ غير مصرح لك بالدخول إلى لوحة الإدارة");
            await signOut(auth);
            window.location.href = "login.html";
            return;
        }

        initializeAdminPanel();

    } catch (error) {
        console.error("خطأ في التحقق من الصلاحيات:", error);
        alert("حدث خطأ أثناء التحقق من الصلاحيات");
        window.location.href = "login.html";
    }
});

// ============================================================
// 🎯 تشغيل لوحة الإدارة
// ============================================================
function initializeAdminPanel() {

    let allCards = [];
    let currentSearchTerm = "";
    let currentFilter = "all";

    function generateCardId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async function getCustomerName(uid) {
        if (!uid) return null;
        if (customersCache.has(uid)) return customersCache.get(uid);

        try {
            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const customerInfo = {
                    name: userData.name || null,
                    email: userData.email || null
                };
                customersCache.set(uid, customerInfo);
                return customerInfo;
            }
            customersCache.set(uid, null);
            return null;
        } catch (error) {
            return null;
        }
    }

    // 1️⃣ إنشاء كرت جديد
    const btnCreateCard = document.getElementById("btnCreateCard");
    if (btnCreateCard) {
        btnCreateCard.addEventListener("click", async () => {
            const cardId = generateCardId(8);
            const cardRef = doc(db, "cards", cardId);

            btnCreateCard.disabled = true;
            btnCreateCard.innerText = "جاري الإنشاء...";

            try {
                await setDoc(cardRef, {
                    cardId: cardId,
                    ownerId: null,
                    status: "available",
                    theme: "classic",
                    title: "",
                    message: "",
                    publicEnabled: true,
                    protected: false,
                    salt: null,
                    encryptionVersion: null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                alert(`✅ تم إنشاء الكرت بنجاح!\n\nرمز الكرت: ${cardId}`);
            } catch (error) {
                alert("حدث خطأ: " + error.message);
            } finally {
                btnCreateCard.disabled = false;
                btnCreateCard.innerHTML = '<i class="fa-solid fa-plus"></i> إنشاء كرت NFC جديد';
            }
        });
    }

    // 2️⃣ الاستماع للكروت
    const cardsCollection = collection(db, "cards");
    onSnapshot(cardsCollection, async (snapshot) => {
        allCards = [];
        snapshot.forEach((docSnap) => {
            allCards.push({ id: docSnap.id, ...docSnap.data() });
        });

        allCards.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        const uniqueOwnerIds = [...new Set(allCards.map(c => c.ownerId).filter(Boolean))];
        await Promise.all(uniqueOwnerIds.map(uid => getCustomerName(uid)));

        await renderCardsTable();
        updateStats();
    });

    // 3️⃣ عرض جدول الكروت
    async function renderCardsTable() {
        const tableBody = document.getElementById("cardsTableBody");
        if (!tableBody) return;

        let filteredCards = allCards.filter(card => {
            if (currentFilter === "available" && card.status !== "available") return false;
            if (currentFilter === "active" && card.status !== "active") return false;
            if (currentFilter === "disabled" && card.status !== "disabled") return false;
            if (currentFilter === "protected" && !(card.salt && card.protected)) return false;
            if (currentFilter === "public" && (card.salt && card.protected)) return false;

            if (currentSearchTerm) {
                const term = currentSearchTerm.toLowerCase();
                const customerInfo = card.ownerId ? customersCache.get(card.ownerId) : null;
                const customerName = (customerInfo?.name || "").toLowerCase();
                const customerEmail = (customerInfo?.email || card.ownerEmail || "").toLowerCase();

                const matches =
                    card.id.toLowerCase().includes(term) ||
                    customerName.includes(term) ||
                    customerEmail.includes(term);

                if (!matches) return false;
            }
            return true;
        });

        const searchInfo = document.getElementById("searchInfo");
        if (searchInfo) {
            searchInfo.textContent = (currentSearchTerm || currentFilter !== "all") 
                ? `📊 ${filteredCards.length} نتيجة من ${allCards.length} كرت` 
                : `📊 إجمالي ${allCards.length} كرت`;
        }

        if (filteredCards.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-inbox"></i> لا توجد نتائج.</td></tr>`;
            return;
        }

        tableBody.innerHTML = "";

        for (const card of filteredCards) {
            let customerDisplay = `<span class="no-name">— غير مربوط —</span>`;
            if (card.ownerId) {
                const customerInfo = await getCustomerName(card.ownerId);
                customerDisplay = `
                    <div class="customer-name">${escapeHtml(customerInfo?.name || "بدون اسم")}</div>
                    ${customerInfo?.email ? `<div class="customer-email">${escapeHtml(customerInfo.email)}</div>` : ""}
                `;
            }

            // ✅ رابط NFC موحد (لا نغيره بناءً على النوع لحماية الشرائح القديمة)
            const nfcUrl = `${window.location.origin}${window.location.pathname.replace(/\/html\/.*$/, "")}/html/customer-view.html?id=${card.cardId || card.id}`;

            const typeLabels = {
                "gift": "🎁 هدية",
                "memory_book": "📖 كتاب ذكريات",
                "memory": "📖 كتاب ذكريات",
                "business_card": "💼 بطاقة عمل",
                "business": "💼 بطاقة عمل",
                "pet_card": "🐾 بطاقة حيوانات",
                "pet": "🐾 بطاقة حيوانات",
                "restaurant-menu": "🍽️ منيو مطعم"
            };
            const typeLabel = card.type ? (typeLabels[card.type] || card.type) : "— غير محدد —";
            const lockStatus = (card.salt && card.protected)
                ? `<span style="color:#22c55e; font-size:0.8rem;">🔒 محمي</span>`
                : `<span style="color:#f59e0b; font-size:0.8rem;">🌐 عام</span>`;

            const isHighlighted = currentSearchTerm && (card.id.toLowerCase().includes(currentSearchTerm.toLowerCase()));
            
            const row = document.createElement("tr");
            row.className = isHighlighted ? "highlighted" : "";
            row.innerHTML = `
                <td><strong>${escapeHtml(card.id)}</strong></td>
                <td>${customerDisplay}</td>
                <td>
                    <div style="font-size:0.85rem; margin-bottom:5px;">${typeLabel}</div>
                    ${lockStatus}
                </td>
                <td>
                    <select class="status-select" data-id="${card.id}">
                        <option value="available" ${card.status === 'available' ? 'selected' : ''}>متاح</option>
                        <option value="active" ${card.status === 'active' ? 'selected' : ''}>مفعل</option>
                        <option value="disabled" ${card.status === 'disabled' ? 'selected' : ''}>معطل</option>
                    </select>
                </td>
                <td style="font-size:0.8rem;">${card.createdAt ? new Date(card.createdAt.toDate()).toLocaleDateString('ar-EG') : 'الآن'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-sm btn-edit" 
                            data-id="${card.id}" 
                            data-type="${card.type || ''}" 
                            data-rname="${escapeHtml(card.restaurantName || '')}" 
                            data-rlogo="${escapeHtml(card.restaurantLogo || '')}" 
                            data-rdesc="${escapeHtml(card.restaurantDesc || '')}" 
                            data-rphone="${escapeHtml(card.restaurantPhone || '')}">
                            <i class="fa-solid fa-pen"></i> تعديل
                        </button>
                        <button class="btn-sm btn-copy" data-url="${nfcUrl}">
                            <i class="fa-regular fa-copy"></i> نسخ الرابط
                        </button>
                        <button class="btn-sm btn-reset-type" data-id="${card.id}">
                            <i class="fa-solid fa-eraser"></i> تصفير
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        }

        bindTableEvents();
    }

    // 4️⃣ ربط الأحداث
    function bindTableEvents() {
        document.querySelectorAll(".btn-copy").forEach(btn => {
            btn.addEventListener("click", () => {
                navigator.clipboard.writeText(btn.dataset.url).then(() => {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> تم النسخ!';
                    setTimeout(() => btn.innerHTML = originalHTML, 1500);
                });
            });
        });

        document.querySelectorAll(".btn-reset-type").forEach(btn => {
            btn.addEventListener("click", async () => {
                await resetCardType(btn.dataset.id);
            });
        });

        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", async (e) => {
                await updateCardStatus(e.target.getAttribute("data-id"), e.target.value);
            });
        });

        // ✅ ربط زر التعديل الجديد
        document.querySelectorAll(".btn-edit").forEach(btn => {
            btn.addEventListener("click", () => openEditModal(btn));
        });
    }

    // 5️⃣ البحث والفلترة
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearchTerm = e.target.value.trim();
                renderCardsTable();
            }, 250);
        });
    }

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            renderCardsTable();
        });
    });

    // 6️⃣ تحديث الحالة
    async function updateCardStatus(cardId, status) {
        try {
            await updateDoc(doc(db, "cards", cardId), { status, updatedAt: serverTimestamp() });
        } catch (error) {
            alert("فشل تحديث الحالة: " + error.message);
        }
    }

    // 7️⃣ تصفير الكرت (تمت إضافة حقول المطعم لمسحها أيضاً)
    async function resetCardType(cardId) {
        if (!confirm(`⚠️ تحذير!\n\nسيتم حذف كل بيانات الكرت "${cardId}"!\n\nهل أنت متأكد؟`)) return;
        if (!confirm("⚠️ تأكيد نهائي!\n\nهذا الإجراء لا يمكن التراجع عنه.")) return;

        try {
            await updateDoc(doc(db, "cards", cardId), {
                type: null,
                protected: false,
                title: "", message: "", images: [], video: "", events: [],
                name: "", jobTitle: "", company: "", bio: "", services: "",
                email: "", address: "", phone: [], website: [], instagram: [], facebook: "", linkedin: "", logoUrl: "", logo: "",
                petName: "", petType: "", petBreed: "", petAge: "", petWeight: "", petColor: "", petNotes: "", petVaccinations: "", petOwnerName: "", petOwnerPhone: "", petAddress: "", petPhoto: "", bgMusicUrl: "",
                // حقول المطعم
                restaurantName: "", restaurantLogo: "", restaurantDesc: "", restaurantPhone: "",
                salt: null, encryptionVersion: null,
                updatedAt: serverTimestamp()
            });
            alert(`✅ تم تصفير الكرت "${cardId}" بنجاح!`);
        } catch (error) {
            alert("فشل تصفير الكرت: " + error.message);
        }
    }

    // 8️⃣ الإحصائيات
    function updateStats() {
        let total = allCards.length;
        let available = 0, active = 0, disabled = 0;
        allCards.forEach(card => {
            if (card.status === "available") available++;
            else if (card.status === "active") active++;
            else if (card.status === "disabled") disabled++;
        });

        if (document.getElementById("totalCards")) document.getElementById("totalCards").innerText = total;
        if (document.getElementById("availableCards")) document.getElementById("availableCards").innerText = available;
        if (document.getElementById("activeCards")) document.getElementById("activeCards").innerText = active;
        if (document.getElementById("disabledCards")) document.getElementById("disabledCards").innerText = disabled;
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return "";
        const div = document.createElement("div");
        div.textContent = String(text);
        return div.innerHTML;
    }

    // ============================================================
    // 9️⃣ نظام التعديل الآمن (Modal) - إضافات جديدة
    // ============================================================
    window.openEditModal = function(btn) {
        document.getElementById('editCardId').value = btn.dataset.id;
        document.getElementById('editCardType').value = btn.dataset.type;
        
        // تعبئة حقول المطعم
        document.getElementById('editRestaurantName').value = btn.dataset.rname;
        document.getElementById('editRestaurantLogo').value = btn.dataset.rlogo;
        document.getElementById('editRestaurantDesc').value = btn.dataset.rdesc;
        document.getElementById('editRestaurantPhone').value = btn.dataset.rphone;
        
        toggleRestaurantFields(btn.dataset.type);
        document.getElementById('editCardModal').style.display = 'flex';
    };

    window.closeEditModal = function() {
        document.getElementById('editCardModal').style.display = 'none';
    };

    window.toggleRestaurantFields = function(type) {
        document.getElementById('restaurantFields').style.display = (type === 'restaurant-menu') ? 'block' : 'none';
    };

    document.getElementById('editCardType')?.addEventListener('change', (e) => {
        toggleRestaurantFields(e.target.value);
    });

    window.saveCardEdit = async function() {
        const id = document.getElementById('editCardId').value;
        const type = document.getElementById('editCardType').value;
        
        let updateData = {
            updatedAt: serverTimestamp()
        };

        // ✅ حماية: لا تمسح النوع إذا كان فارغاً، فقط قم بتحديثه إذا تم اختياره
        if (type !== "") {
            updateData.type = type;
        }

        // ✅ استخدام حقول مخصصة للمطعم لتجنب التعارض
        if (type === 'restaurant-menu') {
            updateData.restaurantName = document.getElementById('editRestaurantName').value.trim();
            updateData.restaurantLogo = document.getElementById('editRestaurantLogo').value.trim();
            updateData.restaurantDesc = document.getElementById('editRestaurantDesc').value.trim();
            updateData.restaurantPhone = document.getElementById('editRestaurantPhone').value.trim();
        }

        try {
            await updateDoc(doc(db, "cards", id), updateData);
            alert("✅ تم تحديث الكرت بنجاح");
            closeEditModal();
        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء الحفظ: " + e.message);
        }
    };
}

// 🚪 زر تسجيل الخروج
document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
});
