import { auth, db } from '../../core/firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');
let orgId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = `public.html?id=${cardId}`;
        return;
    }

    try {
        const cardSnap = await getDoc(doc(db, "businessCards", cardId));
        if (!cardSnap.exists()) return;
        orgId = cardSnap.data().organizationId;

        // جلب بيانات الزبون
        const custSnap = await getDoc(doc(db, "customers", user.uid));
        if (custSnap.exists()) {
            document.getElementById('custName').innerText = custSnap.data().name || "عميل";
        }

        // جلب اسم المطعم
        const restSnap = await getDoc(doc(db, "restaurantProfiles", cardId));
        if (restSnap.exists()) {
            document.getElementById('restName').innerText = restSnap.data().name || "المطعم";
        }

        // ✅ الاعتماد على المعرف الثابت للولاء
        const loyaltyDocId = `${orgId}_${user.uid}`;
        const loyaltyRef = doc(db, "loyalty_customers", loyaltyDocId);
        
        // الاستماع اللحظي لرصيد النقاط
        onSnapshot(loyaltyRef, (docSnap) => {
            if (docSnap.exists()) {
                document.getElementById('currentPoints').innerText = docSnap.data().totalPoints || 0;
            } else {
                document.getElementById('currentPoints').innerText = "0";
            }
        });

        loadTransactions(loyaltyDocId);

    } catch (error) {
        console.error("Error loading customer loyalty profile:", error);
    }
});

async function loadTransactions(loyaltyCustomerId) {
    const list = document.getElementById('transactionsList');
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
        snap.forEach(doc => txns.push(doc.data()));
        txns.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        let html = '';
        txns.forEach(txn => {
            const date = txn.timestamp ? new Date(txn.timestamp.toMillis()).toLocaleDateString('ar-EG') : '';
            html += `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <div><span style="color: #64748b; font-size: 0.9rem;">${date}</span></div>
                    <div style="font-weight: bold; color: #22c55e;">+${txn.pointsEarned} نقطة</div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (error) {
        console.error("Error loading transactions:", error);
        list.innerHTML = '<p style="color: #ef4444; text-align: center;">تعذر تحميل سجل المعاملات.</p>';
    }
}

window.logoutCustomer = async () => {
    await signOut(auth);
    window.location.href = `public.html?id=${cardId}`;
};
