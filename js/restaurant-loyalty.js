import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { /* ضع إعداداتك هنا */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('card');

document.getElementById('btnShow').addEventListener('click', async () => {
    const phone = document.getElementById('phoneInput').value.trim();
    if(!phone) return alert("أدخل رقم الهاتف");

    const btn = document.getElementById('btnShow');
    btn.innerText = "جاري البحث..."; btn.disabled = true;

    try {
        const membersRef = collection(db, `cards/${cardId}/members`);
        const q = query(membersRef, where("phone", "==", phone));
        const snap = await getDocs(q);

        if (snap.empty) {
            alert("لا يوجد حساب بهذا الرقم. يرجى مراجعة الكاشير لتسجيلك.");
            document.getElementById('pointsDisplay').style.display = 'none';
        } else {
            const data = snap.docs[0].data();
            document.getElementById('pointsVal').innerText = data.points || 0;
            document.getElementById('pointsDisplay').style.display = 'block';
        }
    } catch (e) {
        alert("حدث خطأ");
    } finally {
        btn.innerText = "عرض النقاط"; btn.disabled = false;
    }
});
