import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { /* ضع إعداداتك هنا */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const cardId = urlParams.get('card');

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "../html/login.html";
    
    // التحقق من أن المستخدم هو صاحب الكرت
    const cardSnap = await getDoc(doc(db, "cards", cardId));
    if (!cardSnap.exists() || cardSnap.data().ownerId !== user.uid) {
        alert("غير مصرح لك بإدارة هذا المطعم");
        return window.location.href = "../index.html";
    }

    loadStaff();
});

async function loadStaff() {
    const list = document.getElementById('staffList');
    list.innerHTML = "";
    const snap = await getDocs(collection(db, `cards/${cardId}/staff`));
    
    if(snap.empty) { list.innerHTML = "<li>لا يوجد موظفين بعد</li>"; return; }

    snap.forEach(doc => {
        const data = doc.data();
        list.innerHTML += `
            <li>
                <div class="staff-info">
                    <span class="staff-name">${data.name || 'بدون اسم'}</span>
                    <span class="staff-uid">${doc.id}</span>
                </div>
                <button class="danger" onclick="removeStaff('${doc.id}')">حذف</button>
            </li>
        `;
    });
}

window.addStaff = async function() {
    const uid = document.getElementById('staffUid').value.trim();
    const name = document.getElementById('staffName').value.trim();
    if(!uid) return alert("أدخل UID الموظف");

    try {
        await setDoc(doc(db, `cards/${cardId}/staff`, uid), {
            name: name || "موظف",
            role: "cashier",
            addedAt: new Date()
        });
        alert("تمت الإضافة بنجاح");
        document.getElementById('staffUid').value = "";
        document.getElementById('staffName').value = "";
        loadStaff();
    } catch(e) { alert("خطأ: " + e.message); }
}

window.removeStaff = async function(uid) {
    if(!confirm("هل أنت متأكد من حذف الموظف؟")) return;
    await deleteDoc(doc(db, `cards/${cardId}/staff`, uid));
    loadStaff();
}
