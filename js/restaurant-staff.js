import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZcGZQpBZi6RwMeBnL4UcdrBQyZHXsLWY",
  authDomain: "techluxury-4b854.firebaseapp.com",
  projectId: "techluxury-4b854",
  // ... باقي الإعدادات الخاصة بك ...
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// استخراج رقم الكرت من الرابط
const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('card'); 

let currentCustomerId = null;
const POINTS_PER_JOD = 10; // كل 1 دينار = 10 نقاط

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("يجب تسجيل الدخول أولاً");
        window.location.href = "../html/login.html"; // تأكد من اسم صفحة الدخول لديك
        return;
    }
    // التحقق من أن المستخدم موظف في هذا المطعم
    const staffRef = doc(db, `cards/${cardId}/staff`, user.uid);
    const staffSnap = await getDoc(staffRef);
    
    if (!staffSnap.exists()) {
        alert("غير مصرح لك بالدخول لهذا المطعم");
        window.location.href = "../index.html";
    }
});

document.getElementById('btnSearch').addEventListener('click', async () => {
    const phone = document.getElementById('customerPhone').value.trim();
    if (!phone) return alert("أدخل رقم الهاتف");

    const btn = document.getElementById('btnSearch');
    btn.disabled = true; btn.innerText = "جاري البحث...";

    try {
        // البحث عن العضو برقم الهاتف
        const membersRef = collection(db, `cards/${cardId}/members`);
        const q = query(membersRef, where("phone", "==", phone));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            document.getElementById('errorMsg').style.display = 'block';
            document.getElementById('errorMsg').innerText = "الزبون غير مسجل في هذا المطعم. يرجى تسجيله أولاً.";
            document.getElementById('customerInfo').style.display = 'none';
            document.getElementById('invoiceSection').style.display = 'none';
        } else {
            const docSnap = querySnapshot.docs[0];
            currentCustomerId = docSnap.id;
            const data = docSnap.data();

            document.getElementById('custName').innerText = data.name || "بدون اسم";
            document.getElementById('custPoints').innerText = data.points || 0;
            
            document.getElementById('customerInfo').style.display = 'block';
            document.getElementById('invoiceSection').style.display = 'block';
            document.getElementById('errorMsg').style.display = 'none';
        }
    } catch (error) {
        console.error(error);
        alert("حدث خطأ في البحث");
    } finally {
        btn.disabled = false; btn.innerText = "بحث عن الزبون";
    }
});

document.getElementById('btnAddPoints').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('invoiceAmount').value);
    if (!amount || amount <= 0) return alert("أدخل مبلغ صحيح");

    const pointsToAdd = Math.floor(amount * POINTS_PER_JOD);
    
    // التحقق من الصلاحية قبل المعاملة
    const staffRef = doc(db, `cards/${cardId}/staff`, auth.currentUser.uid);
    const memberRef = doc(db, `cards/${cardId}/members`, currentCustomerId);
    const txRef = doc(collection(db, `cards/${cardId}/transactions`));

    try {
        await runTransaction(db, async (transaction) => {
            const memberDoc = await transaction.get(memberRef);
            if (!memberDoc.exists()) throw "الزبون غير موجود";

            const newPoints = (memberDoc.data().points || 0) + pointsToAdd;

            // تحديث رصيد الزبون
            transaction.update(memberRef, { points: newPoints });
            
            // تسجيل العملية
            transaction.set(txRef, {
                customerId: currentCustomerId,
                amount: amount,
                points: pointsToAdd,
                staffId: auth.currentUser.uid,
                createdAt: serverTimestamp()
            });
        });

        alert(`✅ تمت إضافة ${pointsToAdd} نقطة بنجاح!\nالرصيد الجديد: ${document.getElementById('custPoints').innerText * 1 + pointsToAdd}`);
        
        // تصفير الحقول
        document.getElementById('customerPhone').value = "";
        document.getElementById('invoiceAmount').value = "";
        document.getElementById('customerInfo').style.display = 'none';
        document.getElementById('invoiceSection').style.display = 'none';

    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء إضافة النقاط: " + error);
    }
});
