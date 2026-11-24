import { auth, db } from '../../core/firebase-config.js';
import { getCurrentOrganization } from '../../core/auth.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs, getDoc, onSnapshot, doc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');

let currentOrg = null;
let selectedSessionId = null;
let selectedCustomerName = null;
let unsubscribeQueue = null;

const backToDashEl = document.getElementById('backToDash');
if (backToDashEl && cardId) backToDashEl.href = `dashboard.html?id=${cardId}`;

onAuthStateChanged(auth, async (user) => {
    if (unsubscribeQueue) { unsubscribeQueue(); unsubscribeQueue = null; }
    currentOrg = null;

    if (!user) { window.location.href = "../../auth/login.html"; return; }

    try {
        if (typeof auth.authStateReady === 'function') await auth.authStateReady();
        const orgData = await getCurrentOrganization(user.uid);
        if (!orgData || !orgData.orgId || !cardId) { alert("بيانات غير صالحة"); return; }

        currentOrg = orgData;
        listenToQueue();
    } catch (error) {
        console.error("Auth / Organization initialization error:", error);
    }
});

function listenToQueue() {
    const q = query(
        collection(db, "pos_sessions"),
        where("organizationId", "==", currentOrg.orgId),
        where("cardId", "==", cardId),
        where("status", "==", "pending")
    );

    unsubscribeQueue = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('queueList');
        if (!list) return;

        const sessions = [];
        const now = Date.now();

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // ✅ تجاهل الجلسات المنتهية الصلاحية
            if (data.expiresAt && data.expiresAt.toMillis() < now) return;
            sessions.push({ id: docSnap.id, ...data });
        });

        if (sessions.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">لا يوجد زبائن في الانتظار حالياً...</p>';
            return;
        }

        // ترتيب الجلسات
        sessions.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        // ✅ إعادة بناء القائمة بالكامل (تمنع التكرار التراكمي)
        list.innerHTML = sessions.map((session) => {
            const time = session.createdAt ? new Date(session.createdAt.toMillis()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن';
            const phoneDisplay = session.customerPhone ? ` - ${session.customerPhone.slice(-4)}***` : '';
            const safeName = String(session.customerName || 'عميل').replace(/'/g, "\\'");
            const safeUid = String(session.customerId || '').replace(/'/g, "\\'");

            return `
                <div class="list-item" onclick="openInvoiceModal('${session.id}', '${safeName}', '${safeUid}')" style="cursor: pointer; border-right: 4px solid var(--primary);">
                    <div>
                        <strong style="font-size: 1.1rem;">${session.customerName || 'عميل'}</strong>
                        <span class="text-muted" style="font-size: 0.8rem;">${phoneDisplay}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fa-regular fa-clock"></i> ${time}
                    </div>
                </div>
            `;
        }).join('');
    }, (error) => console.error("Queue error:", error));
}

window.openInvoiceModal = async (sessionId, customerName, customerUid) => {
    selectedSessionId = sessionId;
    selectedCustomerName = customerName;
    
    document.getElementById('selectedCustomerName').innerText = `العميل: ${customerName}`;
    document.getElementById('invoiceForm').reset();
    document.getElementById('pointsToRedeem').value = "0";
    document.getElementById('expectedPoints').innerText = '0';
    document.getElementById('availablePointsDisplay').innerText = '...';

    // ✅ الإصلاح: استخدام getDoc بدلاً من getDocs
    if (customerUid && currentOrg && currentOrg.orgId) {
        const loyaltyDocId = `${currentOrg.orgId}_${customerUid}`;
        try {
            const loyaltySnap = await getDoc(doc(db, "loyalty_customers", loyaltyDocId));
            if (loyaltySnap.exists()) {
                document.getElementById('availablePointsDisplay').innerText = loyaltySnap.data().totalPoints || 0;
            } else {
                document.getElementById('availablePointsDisplay').innerText = '0';
            }
        } catch (error) {
            console.error("Error fetching points:", error);
            document.getElementById('availablePointsDisplay').innerText = 'خطأ';
        }
    } else {
        document.getElementById('availablePointsDisplay').innerText = '0';
    }
    
    document.getElementById('invoiceModal').style.display = 'flex';
};

window.closeInvoiceModal = () => { document.getElementById('invoiceModal').style.display = 'none'; };

function calculateExpectedPoints() {
    const amount = parseFloat(document.getElementById('invoiceAmount').value) || 0;
    const redeem = parseInt(document.getElementById('pointsToRedeem').value) || 0;
    const earned = Math.floor(amount * 10);
    document.getElementById('expectedPoints').innerText = Math.max(0, earned - redeem);
}
document.getElementById('invoiceAmount').addEventListener('input', calculateExpectedPoints);
document.getElementById('pointsToRedeem').addEventListener('input', calculateExpectedPoints);

document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentOrg?.orgId || !auth.currentUser?.uid || !selectedSessionId) {
        return alert("❌ الجلسة غير جاهزة.");
    }

    const btn = document.getElementById('confirmBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';

    const amount = parseFloat(document.getElementById('invoiceAmount').value);
    const ref = document.getElementById('invoiceRef').value;
    const pointsToRedeem = parseInt(document.getElementById('pointsToRedeem').value) || 0;
    const pointsEarned = Math.floor(amount * 10);

    try {
        const sessionRef = doc(db, "pos_sessions", selectedSessionId);

        await runTransaction(db, async (transaction) => {
            const sessionDoc = await transaction.get(sessionRef);
            if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
                throw new Error("الجلسة منتهية أو تمت معالجتها بالفعل.");
            }

            const sessionData = sessionDoc.data();
            const customerUid = sessionData.customerId;

            if (!customerUid) throw new Error("هذا الزبون غير مسجل دخول.");

            // ✅ استخدام المعرف الثابت لحساب الولاء
            const loyaltyDocId = `${currentOrg.orgId}_${customerUid}`;
            const loyaltyRef = doc(db, "loyalty_customers", loyaltyDocId);
            const loyaltySnap = await transaction.get(loyaltyRef);

            let currentPoints = 0;
            if (loyaltySnap.exists()) {
                currentPoints = loyaltySnap.data().totalPoints || 0;
                if (pointsToRedeem > currentPoints) {
                    throw new Error(`رصيد العميل غير كافٍ. الرصيد المتاح: ${currentPoints} نقطة.`);
                }
                transaction.update(loyaltyRef, {
                    totalPoints: currentPoints - pointsToRedeem + pointsEarned,
                    updatedAt: serverTimestamp()
                });
            } else {
                if (pointsToRedeem > 0) throw new Error("لا يمكن خصم نقاط لعميل ليس لديه رصيد.");
                transaction.set(loyaltyRef, {
                    organizationId: currentOrg.orgId,
                    cardId: cardId,
                    customerId: customerUid,
                    name: sessionData.customerName,
                    customerPhone: sessionData.customerPhone || null,
                    totalPoints: pointsEarned,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            // ✅ إنشاء طلب (Order) مستقل لكل عملية
            const orderId = `ORD-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            const txnRef = doc(db, "loyalty_transactions", orderId);
            transaction.set(txnRef, {
                orderId: orderId, // معرف مستقل للطلب
                organizationId: currentOrg.orgId,
                cardId: cardId,
                customerId: loyaltyDocId,
                authCustomerId: customerUid,
                cashierId: auth.currentUser.uid,
                invoiceAmount: amount,
                invoiceRef: ref || null,
                pointsEarned: pointsEarned,
                pointsRedeemed: pointsToRedeem,
                type: pointsToRedeem > 0 ? 'mix' : 'earn',
                timestamp: serverTimestamp()
            });

            // إكمال الجلسة (الزيارة)
            transaction.update(sessionRef, {
                status: 'completed',
                completedAt: serverTimestamp(),
                completedBy: auth.currentUser.uid
            });
        });

        alert("✅ تمت إضافة الطلب والنقاط بنجاح!");
        closeInvoiceModal();
    } catch (error) {
        console.error("Error:", error);
        alert("❌ خطأ: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تأكيد العملية';
    }
});
