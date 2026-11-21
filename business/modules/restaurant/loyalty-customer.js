import { db } from '../../core/firebase-config.js';
import { doc, getDoc, onSnapshot, query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
const cardId = urlParams.get('card');

if (!sessionId || !cardId) {
    alert("رابط غير صالح");
    window.location.href = `public.html?id=${cardId}`;
}

let customerId = null;

async function init() {
    // 1. الاستماع لحالة الجلسة
    const sessionRef = doc(db, "pos_sessions", sessionId);
    
    onSnapshot(sessionRef, async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        
        document.getElementById('customerNameDisplay').innerText = data.customerName;

        // إذا قام الكاشير بإكمال العملية وربط حساب العميل
        if (data.status === 'completed' && data.loyaltyCustomerId) {
            // تغيير الواجهة
            document.getElementById('waitingState').style.display = 'none';
            document.getElementById('successState').style.display = 'block';
            
            // إذا لم نكن قد سجلنا المستمع للرصيد بعد، نقوم بذلك
            if (customerId !== data.loyaltyCustomerId) {
                customerId = data.loyaltyCustomerId;
                listenToPoints(customerId);
            }
        }
    });
}

function listenToPoints(custId) {
    const customerRef = doc(db, "loyalty_customers", custId);
    onSnapshot(customerRef, (snap) => {
        if (snap.exists()) {
            document.getElementById('currentPoints').innerText = snap.data().totalPoints || 0;
        }
    });
}

init();
