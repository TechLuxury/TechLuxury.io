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

            if (snapshot.empty) {
                list.innerHTML = '<p class="text-muted text-center">لا يوجد زبائن في الانتظار حالياً...</p>';
                return;
            }

            // ترتيب حسب وقت الإنشاء (الأحدث أولاً)
            const sessions = [];
            snapshot.forEach((docSnap) => {
                sessions.push({ id: docSnap.id, ...docSnap.data() });
            });
            sessions.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

            list.innerHTML = sessions.map((session) => {
                const time = session.createdAt
                    ? new Date(session.createdAt.toMillis()).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'الآن';
                const cleanPhone = normalizePhone(session.customerPhone);
                const phoneDisplay = cleanPhone ? ` - ${cleanPhone.slice(-4)}***` : '';
                const safeName = String(session.customerName || 'عميل').replace(/'/g, "\\'");

                return `
                    <div class="list-item" onclick="openInvoiceModal('${session.id}', '${safeName}')" style="cursor: pointer; border-right: 4px solid var(--primary);">
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

window.openInvoiceModal = (sessionId, customerName) => {
    selectedSessionId = sessionId;
    selectedCustomerName = customerName;
    document.getElementById('selectedCustomerName').innerText = `العميل: ${customerName}`;
    document.getElementById('invoiceForm').reset();
    document.getElementById('expectedPoints').innerText = '0';
    document.getElementById('invoiceModal').style.display = 'flex';
};

window.closeInvoiceModal = () => {
    document.getElementById('invoiceModal').style.display = 'none';
};

// حساب النقاط المتوقعة أثناء الكتابة
document.getElementById('invoiceAmount').addEventListener('input', (e) => {
    const amount = parseFloat(e.target.value) || 0;
    const points = Math.floor(amount * 10); // قاعدة: كل 1 دينار = 10 نقاط
    document.getElementById('expectedPoints').innerText = points;
});

// تأكيد الفاتورة وإضافة النقاط
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
    const pointsToAdd = Math.floor(amount * 10); // يجب جلبها من إعدادات المطعم لاحقاً

    try {
        const sessionRef = doc(db, "pos_sessions", selectedSessionId);

                await runTransaction(db, async (transaction) => {
            const sessionDoc = await transaction.get(sessionRef);
            if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
                throw new Error("الجلسة منتهية أو تمت معالجتها بالفعل.");
            }

            const sessionData = sessionDoc.data();
            const cleanPhone = normalizePhone(sessionData.customerPhone) || null;

            // 1. البحث عن حساب الولاء لهذا المطعم تحديداً
            let loyaltyCustomerRef;
            let foundLoyaltyDoc = null;

            // أولاً: البحث باستخدام UID الزبون (إذا كان مسجلاً وموجوداً في الجلسة)
            if (sessionData.customerId) {
                const lqUid = query(
                    collection(db, "loyalty_customers"),
                    where("organizationId", "==", currentOrg.orgId),
                    where("customerId", "==", sessionData.customerId)
                );
                const lSnapUid = await getDocs(lqUid);
                if (!lSnapUid.empty) {
                    foundLoyaltyDoc = lSnapUid.docs[0];
                }
            }

            // ثانياً: إذا لم نجده بالـ UID، نبحث برقم الهاتف (كاحتياط)
            if (!foundLoyaltyDoc && cleanPhone) {
                const lqPhone = query(
                    collection(db, "loyalty_customers"),
                    where("organizationId", "==", currentOrg.orgId),
                    where("customerPhone", "==", cleanPhone)
                );
                const lSnapPhone = await getDocs(lqPhone);
                if (!lSnapPhone.empty) {
                    foundLoyaltyDoc = lSnapPhone.docs[0];
                }
            }

            // إذا وجدنا الحساب (سواء بالـ UID أو بالهاتف)
            if (foundLoyaltyDoc) {
                loyaltyCustomerRef = doc(db, "loyalty_customers", foundLoyaltyDoc.id);
                const currentPoints = foundLoyaltyDoc.data().totalPoints || 0;
                
                // تحديث النقاط وربط الـ UID إذا لم يكن مربوطاً
                transaction.update(loyaltyCustomerRef, {
                    totalPoints: currentPoints + pointsToAdd,
                    customerId: foundLoyaltyDoc.data().customerId || sessionData.customerId || null,
                    updatedAt: serverTimestamp()
                });
            } else {
                // عميل جديد في هذا المطعم، ننشئ حساب ولاء جديد
                loyaltyCustomerRef = doc(collection(db, "loyalty_customers"));
                transaction.set(loyaltyCustomerRef, {
                    organizationId: currentOrg.orgId,
                    cardId: cardId,
                    customerId: sessionData.customerId || null, // ربطه بالـ UID إذا وجد
                    name: sessionData.customerName,
                    customerPhone: cleanPhone,
                    totalPoints: pointsToAdd,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            // 2. تسجيل المعاملة في السجل
            const txnRef = doc(collection(db, "loyalty_transactions"));
            transaction.set(txnRef, {
                organizationId: currentOrg.orgId,
                cardId: cardId,
                customerId: loyaltyCustomerRef.id, // معرف حساب الولاء
                authCustomerId: sessionData.customerId || null, // معرف المصادقة
                cashierId: auth.currentUser.uid,
                invoiceAmount: amount,
                invoiceRef: ref || null,
                pointsEarned: pointsToAdd,
                type: 'earn',
                timestamp: serverTimestamp()
            });

            // 3. تحديث الجلسة لتصبح مكتملة (لتختفي من الطابور)
            transaction.update(sessionRef, {
                status: 'completed',
                loyaltyCustomerId: loyaltyCustomerRef.id,
                completedAt: serverTimestamp(),
                completedBy: auth.currentUser.uid
            });
        });

        alert("✅ تمت إضافة النقاط بنجاح!");
        closeInvoiceModal();

    } catch (error) {
        console.error("Error processing invoice:", error);
        alert("❌ خطأ: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تأكيد وإضافة النقاط';
    }
});
