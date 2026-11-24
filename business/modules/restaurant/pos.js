import { auth, db } from '../../core/firebase-config.js';
import { getCurrentOrganization } from '../../core/auth.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    doc,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');

let currentOrg = null;
let selectedSessionId = null;
let selectedCustomerName = null;
let unsubscribeQueue = null;

// تحديث رابط العودة
const backToDashEl = document.getElementById('backToDash');
if (backToDashEl && cardId) {
    backToDashEl.href = `dashboard.html?id=${cardId}`;
}

function normalizePhone(phone) {
    return phone ? String(phone).replace(/\D/g, '') : '';
}

function toMillisSafe(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    return 0;
}

// بوابة المصادقة الوحيدة لاستعادة الجلسة وتعيين currentOrg بأمان
onAuthStateChanged(auth, async (user) => {
    if (unsubscribeQueue) {
        unsubscribeQueue();
        unsubscribeQueue = null;
    }

    currentOrg = null;

    if (!user) {
        window.location.href = "../../auth/login.html";
        return;
    }

    try {
        // انتظار جاهزية حالة المصادقة بالكامل قبل قراءة بيانات المؤسسة
        if (typeof auth.authStateReady === 'function') {
            await auth.authStateReady();
        }

        const orgData = await getCurrentOrganization(user.uid);
        if (!orgData || !orgData.orgId || !cardId) {
            alert("بيانات غير صالحة");
            return;
        }

        // تعيين currentOrg حصراً بعد التحقق من user واكتمال جلب بيانات المؤسسة
        currentOrg = orgData;
        listenToQueue();
    } catch (error) {
        console.error("Auth / Organization initialization error:", error);
        alert("حدث خطأ أثناء التحقق من صلاحيات الجلسة");
    }
});

// الاستماع لقائمة الانتظار
function listenToQueue() {
    if (!currentOrg?.orgId || !cardId) {
        console.error("Cannot start queue listener: missing organizationId or cardId");
        return;
    }

    const q = query(
        collection(db, "pos_sessions"),
        where("organizationId", "==", currentOrg.orgId),
        where("cardId", "==", cardId),
        where("status", "==", "pending")
    );

    unsubscribeQueue = onSnapshot(
        q,
        (snapshot) => {
            const list = document.getElementById('queueList');
            if (!list) return;

            const sessions = [];
            const now = Date.now();

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const expiresAtMs = toMillisSafe(data.expiresAt);
                // تجاهل الجلسات التي انتهت صلاحيتها
                if (expiresAtMs > 0 && expiresAtMs < now) return;
                sessions.push({ id: docSnap.id, ...data });
            });

            if (sessions.length === 0) {
                list.innerHTML = '<p class="text-muted text-center">لا يوجد زبائن في الانتظار حالياً...</p>';
                return;
            }

            // ترتيب حسب وقت الإنشاء (الأحدث أولاً)
            sessions.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));

            list.innerHTML = sessions.map((session) => {
                const createdMs = toMillisSafe(session.createdAt);
                const time = createdMs
                    ? new Date(createdMs).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'الآن';
                const cleanPhone = normalizePhone(session.customerPhone);
                const phoneDisplay = cleanPhone ? ` - ${cleanPhone.slice(-4)}***` : '';
                const safeName = String(session.customerName || 'عميل').replace(/'/g, "\\'");
                const customerUid = session.customerId || '';

                return `
                    <div class="list-item" onclick="openInvoiceModal('${session.id}', '${safeName}', '${customerUid}')" style="cursor: pointer; border-right: 4px solid var(--primary);">
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
        },
        (error) => {
            console.error("Error listening to pos_sessions queue:", error);
            const list = document.getElementById('queueList');
            if (list) {
                list.innerHTML = '<p class="text-danger text-center">تعذر تحميل قائمة الانتظار. تحقق من الصلاحيات أو الفهارس في Console.</p>';
            }
        }
    );
}

window.openInvoiceModal = async (sessionId, customerName, customerUid) => {
    selectedSessionId = sessionId;
    selectedCustomerName = customerName;

    document.getElementById('selectedCustomerName').innerText = `العميل: ${customerName}`;
    document.getElementById('invoiceForm').reset();
    document.getElementById('pointsToRedeem').value = "0";
    document.getElementById('expectedPoints').innerText = '0';
    document.getElementById('availablePointsDisplay').innerText = '...';

    // جلب رصيد النقاط الخاص بالعميل
    let balance = 0;
    if (customerUid) {
        const q = query(
            collection(db, "loyalty_customers"),
            where("organizationId", "==", currentOrg.orgId),
            where("customerId", "==", customerUid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            balance = snap.docs[0].data().totalPoints || 0;
        }
    }

    document.getElementById('availablePointsDisplay').innerText = balance;
    document.getElementById('invoiceModal').style.display = 'flex';
};

window.closeInvoiceModal = () => {
    document.getElementById('invoiceModal').style.display = 'none';
};

// حساب النقاط المكتسبة (صافي) أثناء الكتابة
function calculateExpectedPoints() {
    const amount = parseFloat(document.getElementById('invoiceAmount').value) || 0;
    const redeem = parseInt(document.getElementById('pointsToRedeem').value) || 0;

    const earned = Math.floor(amount * 10);
    const netEarned = Math.max(0, earned - redeem); // لا يمكن أن تكون النقاط المكتسبة بالسالب

    document.getElementById('expectedPoints').innerText = netEarned;
}

document.getElementById('invoiceAmount').addEventListener('input', calculateExpectedPoints);
document.getElementById('pointsToRedeem').addEventListener('input', calculateExpectedPoints);

// تأكيد الفاتورة وإضافة/خصم النقاط
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentOrg?.orgId || !auth.currentUser?.uid || !selectedSessionId) {
        alert("❌ الجلسة غير جاهزة أو غير مصادق عليها.");
        return;
    }

    const btn = document.getElementById('confirmBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';

    const amount = parseFloat(document.getElementById('invoiceAmount').value);
    const ref = document.getElementById('invoiceRef').value;

    try {
        const sessionRef = doc(db, "pos_sessions", selectedSessionId);

        await runTransaction(db, async (transaction) => {
            const sessionDoc = await transaction.get(sessionRef);
            if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
                throw new Error("الجلسة منتهية أو تمت معالجتها بالفعل.");
            }

            const sessionData = sessionDoc.data();
            const customerUid = sessionData.customerId;

            if (!customerUid) {
                throw new Error("هذا الزبون غير مسجل دخول. لا يمكن إضافة النقاط لحساب غير معروف.");
            }

            // ✅ 1. استخدام معرف ثابت لحساب الولاء (organizationId + customerUid)
            const loyaltyDocId = `${currentOrg.orgId}_${customerUid}`;
            const loyaltyCustomerRef = doc(db, "loyalty_customers", loyaltyDocId);
            const loyaltyDoc = await transaction.get(loyaltyCustomerRef);

            const pointsToRedeem = parseInt(document.getElementById('pointsToRedeem').value) || 0;
            const pointsEarned = Math.floor(amount * 10);

            if (pointsToRedeem < 0) {
                throw new Error("قيمة النقاط المخصومة لا يمكن أن تكون سالبة.");
            }

            let currentPoints = 0;

            if (loyaltyDoc.exists()) {
                currentPoints = loyaltyDoc.data().totalPoints || 0;
                if (pointsToRedeem > currentPoints) {
                    throw new Error(`رصيد العميل غير كافٍ. الرصيد المتاح: ${currentPoints} نقطة.`);
                }
                // تحديث الحساب الموجود
                transaction.update(loyaltyCustomerRef, {
                    totalPoints: currentPoints - pointsToRedeem + pointsEarned,
                    name: sessionData.customerName,
                    updatedAt: serverTimestamp()
                });
            } else {
                if (pointsToRedeem > 0) {
                    throw new Error("لا يمكن خصم نقاط لعميل جديد ليس لديه رصيد.");
                }
                // إنشاء حساب ولاء لأول مرة بمعرف ثابت
                transaction.set(loyaltyCustomerRef, {
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

            // ✅ 2. تسجيل المعاملة بمعرف ثابت (sessionId) لمنع التكرار إذا ضغط الموظف مرتين
            const txnRef = doc(db, "loyalty_transactions", `txn_${selectedSessionId}`);
            transaction.set(txnRef, {
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

            // ✅ 3. تحديث الجلسة لتصبح مكتملة
            transaction.update(sessionRef, {
                status: 'completed',
                completedAt: serverTimestamp(),
                completedBy: auth.currentUser.uid
            });
        });

        alert("✅ تم تنفيذ العملية بنجاح!");
        closeInvoiceModal();

    } catch (error) {
        console.error("Error processing invoice:", error);
        alert("❌ خطأ: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تأكيد العملية';
    }
});
