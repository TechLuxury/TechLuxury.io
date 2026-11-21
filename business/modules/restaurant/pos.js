import { auth, db } from '../../core/firebase-config.js';
import { onAuthChange, getCurrentOrganization } from '../../core/auth.js';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('id');
let currentOrg = null;
let selectedSessionId = null;
let selectedCustomerName = null;

// تحديث رابط العودة
document.getElementById('backToDash').href = `dashboard.html?id=${cardId}`;

onAuthChange(async (user) => {
    if (!user) { window.location.href = "../../auth/login.html"; return; }
    currentOrg = await getCurrentOrganization(user.uid);
    if (!currentOrg || !cardId) { alert("بيانات غير صالحة"); return; }

    listenToQueue();
});

// الاستماع لقائمة الانتظار
function listenToQueue() {
    // نجلب فقط الجلسات التي حالتها pending
    const q = query(
        collection(db, "pos_sessions"), 
        where("cardId", "==", cardId),
        where("status", "==", "pending")
    );

    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('queueList');
        
        if (snapshot.empty) {
            list.innerHTML = '<p class="text-muted text-center">لا يوجد زبائن في الانتظار حالياً...</p>';
            return;
        }

        // ترتيب حسب وقت الإنشاء (الأحدث أو الأقدم)
        const sessions = [];
        snapshot.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));
        sessions.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

        list.innerHTML = sessions.map(session => {
            const time = session.createdAt ? new Date(session.createdAt.toMillis()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن';
            const phoneDisplay = session.customerPhone ? ` - ${session.customerPhone.slice(-4)}***` : '';
            
            return `
                <div class="list-item" onclick="openInvoiceModal('${session.id}', '${session.customerName}')" style="cursor: pointer; border-right: 4px solid var(--primary);">
                    <div>
                        <strong style="font-size: 1.1rem;">${session.customerName}</strong>
                        <span class="text-muted" style="font-size: 0.8rem;">${phoneDisplay}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fa-regular fa-clock"></i> ${time}
                    </div>
                </div>
            `;
        }).join('');
    });
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
    const btn = document.getElementById('confirmBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';

    const amount = parseFloat(document.getElementById('invoiceAmount').value);
    const ref = document.getElementById('invoiceRef').value;
    const pointsToAdd = Math.floor(amount * 10); // يجب جلبها من إعدادات المطعم لاحقاً

    try {
        // 1. التحقق من الجلسة وجلب بياناتها
        const sessionRef = doc(db, "pos_sessions", selectedSessionId);
        
        await runTransaction(db, async (transaction) => {
            const sessionDoc = await transaction.get(sessionRef);
            if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
                throw new Error("الجلسة منتهية أو تمت معالجتها بالفعل.");
            }

            const sessionData = sessionDoc.data();
            
            // 2. البحث عن العميل أو إنشاؤه (سنبحث بالهاتف أو الاسم، هنا سننشئ عميل جديد دائماً للتبسيط)
            // في النظام المتقدم، يمكن البحث بالهاتف أولاً
            const customerRef = doc(collection(db, "loyalty_customers"));
            
            transaction.set(customerRef, {
                organizationId: currentOrg.orgId,
                cardId: cardId,
                name: sessionData.customerName,
                phone: sessionData.customerPhone || null,
                totalPoints: pointsToAdd,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 3. تسجيل المعاملة
            const txnRef = doc(collection(db, "loyalty_transactions"));
            transaction.set(txnRef, {
                organizationId: currentOrg.orgId,
                cardId: cardId,
                customerId: customerRef.id,
                cashierId: auth.currentUser.uid,
                invoiceAmount: amount,
                invoiceRef: ref || null,
                pointsEarned: pointsToAdd,
                type: 'earn',
                timestamp: serverTimestamp()
            });

            // 4. تحديث الجلسة لتصبح مكتملة وربطها بالعميل
            transaction.update(sessionRef, {
                status: 'completed',
                loyaltyCustomerId: customerRef.id,
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
