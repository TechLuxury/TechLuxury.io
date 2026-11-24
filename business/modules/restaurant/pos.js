import { auth, db } from '../../core/firebase-config.js';
import { getCurrentOrganization } from '../../core/auth.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection, query, where, getDocs, onSnapshot, doc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');
let currentOrg = null;
let allCustomers = []; // لحفظ قائمة الزبائن للبحث السريع
let selectedCustomer = null;

const backToDashEl = document.getElementById('backToDash');
if (backToDashEl && cardId) backToDashEl.href = `dashboard.html?id=${cardId}`;

// دالة مساعدة لتوحيد أرقام الهواتف (إزالة المسافات والرموز وتوحيد 962 و 07)
function normalizePhone(phone) {
    if (!phone) return '';
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('962')) p = '0' + p.substring(3);
    return p;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "../../auth/login.html"; return; }

    try {
        if (typeof auth.authStateReady === 'function') await auth.authStateReady();
        const orgData = await getCurrentOrganization(user.uid);
        if (!orgData || !orgData.orgId || !cardId) { alert("بيانات غير صالحة"); return; }

        currentOrg = orgData;
        loadAllCustomers(); // جلب الزبائن للبدء بالبحث
    } catch (error) {
        console.error("Auth error:", error);
    }
});

// 1. جلب جميع زبائن المطعم في الخلفية (للبحث الفوري)
function loadAllCustomers() {
    const q = query(
        collection(db, "loyalty_customers"),
        where("organizationId", "==", currentOrg.orgId)
    );
    
    onSnapshot(q, (snapshot) => {
        allCustomers = [];
        snapshot.forEach(doc => {
            allCustomers.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Loaded ${allCustomers.length} customers for search.`);
    }, (error) => {
        console.error("Error loading customers:", error);
    });
}

// 2. واجهة البحث
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (term.length < 2) {
        searchResults.innerHTML = '<p class="text-muted text-center">ابدأ بكتابة حرفين على الأقل للبحث...</p>';
        return;
    }

    const searchPhone = normalizePhone(term); // في حال كان يبحث برقم هاتف

    // فلترة الزبائن
    const filtered = allCustomers.filter(cust => {
        const custName = (cust.name || '').toLowerCase();
        const custPhone = normalizePhone(cust.customerPhone);

        // بحث بالاسم (يدعم البحث الجزئي)
        const matchName = custName.includes(term);
        
        // بحث بالهاتف (يدعم البحث الجزئي)
        const matchPhone = custPhone.includes(searchPhone);

        return matchName || matchPhone;
    });

    renderSearchResults(filtered);
});

function renderSearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<p class="text-muted text-center">لا توجد نتائج مطابقة.</p>';
        return;
    }

    searchResults.innerHTML = results.map(cust => {
        const phoneEnd = cust.customerPhone ? `*** ${String(cust.customerPhone).slice(-3)}` : 'لا يوجد هاتف';
        return `
            <div class="list-item" onclick="selectCustomer('${cust.id}')" style="cursor: pointer; border-right: 4px solid var(--primary); background: var(--bg);">
                <div>
                    <strong style="font-size: 1.1rem; color: var(--text);">${cust.name}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${phoneEnd}</div>
                </div>
                <div style="text-align: left;">
                    <span style="font-weight: bold; color: #f59e0b;">${cust.totalPoints || 0} نقطة</span>
                </div>
            </div>
        `;
    }).join('');
}

// 3. اختيار الزبون
window.selectCustomer = (customerId) => {
    selectedCustomer = allCustomers.find(c => c.id === customerId);
    if (!selectedCustomer) return;

    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('addPointsSection').style.display = 'block';
    document.getElementById('addPointsForm').reset();
    document.getElementById('expectedPoints').innerText = '0';

    document.getElementById('selectedCustName').innerText = selectedCustomer.name;
    document.getElementById('selectedCustPhone').innerText = selectedCustomer.customerPhone ? `*** ${String(selectedCustomer.customerPhone).slice(-3)}` : 'لا يوجد هاتف';
    document.getElementById('selectedCustPoints').innerText = selectedCustomer.totalPoints || 0;
};

window.cancelSelection = () => {
    selectedCustomer = null;
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('addPointsSection').style.display = 'none';
    searchInput.value = '';
    searchResults.innerHTML = '<p class="text-muted text-center">ابدأ بكتابة الاسم أو رقم الهاتف للبحث...</p>';
};

// 4. حساب النقاط المتوقعة
document.getElementById('orderAmount').addEventListener('input', (e) => {
    const amount = parseFloat(e.target.value) || 0;
    document.getElementById('expectedPoints').innerText = Math.floor(amount * 10); // قاعدة: كل 1 دينار = 10 نقاط
});

// 5. إضافة النقاط (المعاملة الذرية مع منع التكرار)
document.getElementById('addPointsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !currentOrg) return;

    const btn = document.getElementById('confirmBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';

    const amount = parseFloat(document.getElementById('orderAmount').value);
    const orderRefInput = document.getElementById('orderRef').value.trim();
    const pointsToAdd = Math.floor(amount * 10);

    // ✅ منع التكرار: إذا لم يدخل الموظف رقم فاتورة، ننشئ واحداً تلقائياً مبني على الوقت
    // إذا أدخل رقم فاتورة، نستخدمه كمعرف للمعاملة (لا يمكن تكراره)
    const orderId = orderRefInput ? `REF-${orderRefInput}` : `TXN-${Date.now()}`;
    
    // استخدام الـ ID الثابت للحساب لضمان التحديث الصحيح
    const loyaltyDocId = `${currentOrg.orgId}_${selectedCustomer.customerId}`;
    const loyaltyRef = doc(db, "loyalty_customers", loyaltyDocId);
    const txnRef = doc(db, "loyalty_transactions", orderId);

    try {
        await runTransaction(db, async (transaction) => {
            // 1. التأكد من أن رقم الفاتورة لم يُستخدم مسبقاً
            const txnDoc = await transaction.get(txnRef);
            if (txnDoc.exists()) {
                throw new Error("رقم الفاتورة هذا تم استخدامه مسبقاً! لا يمكن إضافة النقاط مرتين لنفس الفاتورة.");
            }

            // 2. جلب أحدث رصيد للعميل
            const custDoc = await transaction.get(loyaltyRef);
            if (!custDoc.exists()) throw new Error("حساب الزبون غير موجود.");

            const currentPoints = custDoc.data().totalPoints || 0;
            const newBalance = currentPoints + pointsToAdd;

            // 3. تحديث رصيد العميل
            transaction.update(loyaltyRef, {
                totalPoints: newBalance,
                updatedAt: serverTimestamp()
            });

            // 4. تسجيل المعاملة في السجل
            transaction.set(txnRef, {
                transactionId: orderId,
                organizationId: currentOrg.orgId,
                cardId: cardId,
                customerId: loyaltyDocId, // ربط بالحساب الثابت
                authCustomerId: selectedCustomer.customerId,
                cashierId: auth.currentUser.uid,
                amount: amount,
                pointsEarned: pointsToAdd,
                type: 'earn',
                timestamp: serverTimestamp()
            });
        });

        alert(`✅ تمت إضافة ${pointsToAdd} نقطة بنجاح!\nالرصيد الجديد: ${selectedCustomer.totalPoints + pointsToAdd} نقطة.`);
        cancelSelection(); // العودة لشاشة البحث

    } catch (error) {
        console.error("Transaction error:", error);
        alert("❌ خطأ: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تأكيد وإضافة النقاط';
    }
});
