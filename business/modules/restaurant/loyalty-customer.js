import { auth, db } from '../../core/firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id') || urlParams.get('card');
let orgId = null;
let unsubscribeLoyalty = null;

onAuthStateChanged(auth, async (user) => {
    if (unsubscribeLoyalty) {
        unsubscribeLoyalty();
        unsubscribeLoyalty = null;
    }

    if (!user) {
        window.location.href = `public.html?id=${cardId || ''}`;
        return;
    }

    if (!cardId) {
        console.error("Missing cardId in URL");
        return;
    }

    try {
        // 1. جلب orgId من الكرت
        const cardSnap = await getDoc(doc(db, "businessCards", cardId));
        if (!cardSnap.exists()) return;
        orgId = cardSnap.data().organizationId;

        // 2. جلب اسم وهاتف الزبون
        let custName = "عميل";
        let custPhone = null;

        const custSnap = await getDoc(doc(db, "customers", user.uid));
        if (custSnap.exists()) {
            const data = custSnap.data();
            custName = data.name || "عميل";
            custPhone = data.phone || null;
            const custNameEl = document.getElementById('custName');
            if (custNameEl) custNameEl.innerText = custName;
        }

        // 3. جلب اسم المطعم
        const restSnap = await getDoc(doc(db, "restaurantProfiles", cardId));
        if (restSnap.exists()) {
            const restNameEl = document.getElementById('restName');
            if (restNameEl) restNameEl.innerText = restSnap.data().name || "المطعم";
        }

        // 4. إضافة/تحديث الزبون في طابور الكاشير بمعرف ثابت لمنع التكرار
        const sessionRef = doc(db, "pos_sessions", `${cardId}_${user.uid}`);
        await setDoc(sessionRef, {
            organizationId: orgId,
            cardId: cardId,
            customerId: user.uid,
            customerName: custName,
            customerPhone: custPhone || null,
            status: 'pending',
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 15 * 60000)
        }, { merge: true });

        // 5. البحث عن حساب الولاء لعرض النقاط باستخدام المعرف الثابت
        const loyaltyDocId = `${orgId}_${user.uid}`;
        const loyaltyRef = doc(db, "loyalty_customers", loyaltyDocId);
        const loyaltyDoc = await getDoc(loyaltyRef);

        const currentPointsEl = document.getElementById('currentPoints');
        const transactionsListEl = document.getElementById('transactionsList');

        if (loyaltyDoc.exists()) {
            unsubscribeLoyalty = onSnapshot(loyaltyRef, (docSnap) => {
                if (docSnap.exists() && currentPointsEl) {
                    currentPointsEl.innerText = docSnap.data().totalPoints || 0;
                }
            });
            await loadTransactions(loyaltyDocId);
        } else {
            if (currentPointsEl) currentPointsEl.innerText = "0";
            if (transactionsListEl) {
                transactionsListEl.innerHTML = '<p style="color: #94a3b8; text-align: center;">لا توجد نقاط بعد. اطلب من الكاشير إضافتها!</p>';
            }
        }

    } catch (error) {
        console.error("Error loading customer loyalty profile:", error);
    }
});

async function loadTransactions(loyaltyCustomerId) {
    const list = document.getElementById('transactionsList');
    if (!list) return;

    try {
        const q = query(
            collection(db, "loyalty_transactions"),
            where("customerId", "==", loyaltyCustomerId),
            where("organizationId", "==", orgId)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = '<p style="color: #94a3b8; text-align: center;">لا توجد عمليات سابقة</p>';
            return;
        }

        const txns = [];
        snap.forEach((docSnap) => {
            txns.push(docSnap.data());
        });

        txns.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        let html = '';
        txns.forEach((txn) => {
            const date = txn.timestamp ? new Date(txn.timestamp.toMillis()).toLocaleDateString('ar-EG') : '';

            // عرض النقاط المكتسبة
            if (txn.pointsEarned > 0) {
                html += `
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <div><span style="color: #64748b; font-size: 0.9rem;">${date} (شراء)</span></div>
                        <div style="font-weight: bold; color: #22c55e;">+${txn.pointsEarned} نقطة</div>
                    </div>
                `;
            }

            // عرض النقاط المخصومة
            if (txn.pointsRedeemed > 0) {
                html += `
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <div><span style="color: #64748b; font-size: 0.9rem;">${date} (استبدال)</span></div>
                        <div style="font-weight: bold; color: #ef4444;">-${txn.pointsRedeemed} نقطة</div>
                    </div>
                `;
            }
        });

        list.innerHTML = html || '<p style="color: #94a3b8; text-align: center;">لا توجد عمليات سابقة</p>';
    } catch (error) {
        console.error("Error loading transactions:", error);
        list.innerHTML = '<p style="color: #ef4444; text-align: center;">تعذر تحميل سجل المعاملات.</p>';
    }
}

window.logoutCustomer = async () => {
    await signOut(auth);
    window.location.href = `public.html?id=${cardId || ''}`;
};
