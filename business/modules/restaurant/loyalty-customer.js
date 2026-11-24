import { auth, db } from '../../core/firebase-config.js';
import {
    doc,
    getDoc,
    updateDoc,
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

function normalizePhone(phone) {
    return phone ? String(phone).replace(/\D/g, '') : '';
}

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

        // 2. جلب بيانات الزبون (الاسم ورقم الهاتف) من customers
        let customerPhone = '';
        const custSnap = await getDoc(doc(db, "customers", user.uid));
        if (custSnap.exists()) {
            const custData = custSnap.data();
            const custNameEl = document.getElementById('custName');
            if (custNameEl) custNameEl.innerText = custData.name || 'زبوننا العزيز';
            customerPhone = normalizePhone(custData.phone);
        }

        // خيار احتياطي لاستخراج الهاتف من البريد الوهمي إذا لم يكن مخزناً في customers
        if (!customerPhone && user.email && user.email.endsWith('@customer.techluxury')) {
            customerPhone = normalizePhone(user.email.split('@')[0]);
        }

        // 3. جلب اسم المطعم
        const restSnap = await getDoc(doc(db, "restaurantProfiles", cardId));
        if (restSnap.exists()) {
            const restNameEl = document.getElementById('restName');
            if (restNameEl) restNameEl.innerText = restSnap.data().name || '';
        }

        // 4. البحث عن حساب الولاء الخاص بهذا المطعم (أولاً بـ customerId ثم بـ customerPhone)
        let loyaltyDoc = null;

        const byIdQuery = query(
            collection(db, "loyalty_customers"),
            where("customerId", "==", user.uid),
            where("organizationId", "==", orgId)
        );
        const byIdSnap = await getDocs(byIdQuery);

        if (!byIdSnap.empty) {
            loyaltyDoc = byIdSnap.docs[0];
        } else if (customerPhone) {
            const byPhoneQuery = query(
                collection(db, "loyalty_customers"),
                where("customerPhone", "==", customerPhone),
                where("organizationId", "==", orgId)
            );
            const byPhoneSnap = await getDocs(byPhoneQuery);

            if (!byPhoneSnap.empty) {
                loyaltyDoc = byPhoneSnap.docs[0];

                // ربط customerId تلقائياً بالسجل الموجود لتسهيل الوصول مستقبلاً
                if (!loyaltyDoc.data().customerId) {
                    try {
                        await updateDoc(doc(db, "loyalty_customers", loyaltyDoc.id), {
                            customerId: user.uid,
                            updatedAt: serverTimestamp()
                        });
                    } catch (linkErr) {
                        console.warn("Could not auto-link customerId:", linkErr);
                    }
                }
            }
        }

        const pointsEl = document.getElementById('currentPoints');

        if (loyaltyDoc) {
            // الاستماع المباشر لتحديث النقاط
            unsubscribeLoyalty = onSnapshot(
                doc(db, "loyalty_customers", loyaltyDoc.id),
                (docSnap) => {
                    if (docSnap.exists() && pointsEl) {
                        pointsEl.innerText = docSnap.data().totalPoints || 0;
                    }
                },
                (err) => {
                    console.error("Error listening to loyalty points:", err);
                }
            );

            await loadTransactions(loyaltyDoc.id, user.uid);
        } else {
            // لا يوجد حساب ولاء بعد في هذا المطعم
            if (pointsEl) pointsEl.innerText = "0";
        }

    } catch (error) {
        console.error("Error loading customer loyalty profile:", error);
    }
});

async function loadTransactions(loyaltyCustomerId, authUid) {
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
            list.innerHTML = '<p style="color: #64748b; text-align: center; padding: 12px 0;">لا توجد معاملات نقاط حتى الآن.</p>';
            return;
        }

        const txns = [];
        snap.forEach((docSnap) => {
            txns.push(docSnap.data());
        });

        // ترتيب المعاملات من الأحدث إلى الأقدم
        txns.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        list.innerHTML = txns.map((txn) => {
            const date = txn.timestamp
                ? new Date(txn.timestamp.toMillis()).toLocaleDateString('ar-EG')
                : '';
            return `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <div><span style="color: #64748b; font-size: 0.9rem;">${date}</span></div>
                    <div style="font-weight: bold; color: #22c55e;">+${txn.pointsEarned} نقطة</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Error loading transactions:", error);
    }
}

window.logoutCustomer = async () => {
    await signOut(auth);
    window.location.href = `public.html?id=${cardId || ''}`;
};
