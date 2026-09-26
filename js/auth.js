import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===== إعدادات Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyBZcGZQpBZi6RwMeBnL4UcdrBQyZHXsLWY",
  authDomain: "techluxury-4b854.firebaseapp.com",
  projectId: "techluxury-4b854",
  storageBucket: "techluxury-4b854.firebasestorage.app",
  messagingSenderId: "1043863547919",
  appId: "1:1043863547919:web:46bd7c74f0fbeb2702b37a",
  measurementId: "G-EZJWPY4Q2Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isSignUp = false;

// ===== عناصر الصفحة =====
const btnToggle = document.getElementById("btnToggle");
const nameGroup = document.getElementById("nameGroup");
const formTitle = document.getElementById("formTitle");
const btnSubmit = document.getElementById("btnSubmit");
const toggleText = document.getElementById("toggleText");

// ===== التبديل بين تسجيل الدخول وإنشاء حساب =====
btnToggle.addEventListener("click", () => {
    isSignUp = !isSignUp;
    if (isSignUp) {
        formTitle.innerText = "إنشاء حساب جديد";
        btnSubmit.innerText = "إنشاء حساب";
        toggleText.innerText = "لديك حساب بالفعل؟";
        btnToggle.innerText = "تسجيل الدخول";
        nameGroup.style.display = "block";
    } else {
        formTitle.innerText = "تسجيل الدخول إلى حسابك";
        btnSubmit.innerText = "دخول";
        toggleText.innerText = "ليس لديك حساب؟";
        btnToggle.innerText = "إنشاء حساب جديد";
        nameGroup.style.display = "none";
    }
});

// ===== معالجة نموذج التسجيل / الدخول =====
// ============================================================
// 🔐 Rate Limiting — منع تكرار المحاولات الفاشلة
// ============================================================
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 دقيقة

function getLoginAttemptsData() {
    try {
        const data = localStorage.getItem("loginAttempts");
        return data ? JSON.parse(data) : { count: 0, lockedUntil: 0 };
    } catch {
        return { count: 0, lockedUntil: 0 };
    }
}

function saveLoginAttemptsData(data) {
    try {
        localStorage.setItem("loginAttempts", JSON.stringify(data));
    } catch (e) {
        console.error("فشل حفظ محاولات الدخول:", e);
    }
}

function isAccountLocked() {
    const data = getLoginAttemptsData();
    const now = Date.now();

    if (data.lockedUntil && now < data.lockedUntil) {
        const remainingMs = data.lockedUntil - now;
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { locked: true, remainingMinutes: remainingMin };
    }

    // إذا انتهى وقت القفل → أعد تعيين العداد
    if (data.lockedUntil && now >= data.lockedUntil) {
        saveLoginAttemptsData({ count: 0, lockedUntil: 0 });
    }

    return { locked: false };
}

function registerFailedAttempt() {
    const data = getLoginAttemptsData();
    data.count += 1;

    if (data.count >= MAX_LOGIN_ATTEMPTS) {
        data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        saveLoginAttemptsData(data);
        return {
            locked: true,
            remainingMinutes: 15
        };
    }

    saveLoginAttemptsData(data);
    return {
        locked: false,
        remainingAttempts: MAX_LOGIN_ATTEMPTS - data.count
    };
}

function resetLoginAttempts() {
    saveLoginAttemptsData({ count: 0, lockedUntil: 0 });
}

// ===== معالجة نموذج التسجيل / الدخول =====
document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const fullName = document.getElementById("fullName").value.trim();

    // 🔐 التحقق من القفل (فقط لتسجيل الدخول، ليس لإنشاء حساب)
    if (!isSignUp) {
        const lockStatus = isAccountLocked();
        if (lockStatus.locked) {
            alert(`🔒 تم قفل تسجيل الدخول مؤقتاً\n\nبسبب تكرار المحاولات الفاشلة.\n\nيرجى المحاولة بعد ${lockStatus.remainingMinutes} دقيقة.`);
            return;
        }
    }

    try {
        if (isSignUp) {
            // 🔹 إنشاء حساب جديد
            if (!fullName) {
                alert("الرجاء إدخال الاسم الكامل");
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 💾 حفظ بيانات المستخدم في Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: fullName,
                email: email,
                role: "customer",
                createdAt: serverTimestamp()
            });

            // ✅ إعادة تعيين المحاولات بعد نجاح التسجيل
            resetLoginAttempts();

            alert("✅ تم إنشاء الحساب بنجاح!");
            window.location.href = "customer-dashboard.html";
        } else {
            // 🔹 تسجيل الدخول
            await signInWithEmailAndPassword(auth, email, password);

            // ✅ نجاح → أعد تعيين المحاولات
            resetLoginAttempts();

            window.location.href = "customer-dashboard.html";
        }
    } catch (error) {
        console.error("خطأ في المصادقة:", error);

        // 🔐 سجّل المحاولة الفاشلة (فقط لتسجيل الدخول)
        let failureMessage = "";
        if (!isSignUp) {
            const attemptResult = registerFailedAttempt();
            if (attemptResult.locked) {
                failureMessage = `\n\n🔒 تم قفل تسجيل الدخول لمدة 15 دقيقة.`;
            } else if (attemptResult.remainingAttempts <= 2) {
                failureMessage = `\n\n⚠️ تبقى ${attemptResult.remainingAttempts} محاولة قبل القفل.`;
            }
        }

        // رسائل خطأ واضحة بالعربية
        let message = error.message;
        if (error.code === "auth/invalid-email") message = "البريد الإلكتروني غير صالح";
        else if (error.code === "auth/user-not-found") message = "لا يوجد حساب بهذا البريد";
        else if (error.code === "auth/wrong-password") message = "كلمة المرور غير صحيحة";
        else if (error.code === "auth/email-already-in-use") message = "هذا البريد مستخدم بالفعل";
        else if (error.code === "auth/weak-password") message = "كلمة المرور ضعيفة (6 أحرف على الأقل)";
        else if (error.code === "auth/invalid-credential") message = "البريد أو كلمة المرور غير صحيحة";
        else if (error.code === "auth/too-many-requests") message = "طلبات كثيرة جداً — انتظر قليلاً";

        alert("❌ " + message + failureMessage);
    }
});

// ===== التحقق من تسجيل الدخول =====
// إذا كان المستخدم مسجلاً → انتقل للوحة التحكم
// إذا لم يكن مسجلاً → ابقَ في صفحة تسجيل الدخول
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "customer-dashboard.html";
    }
});

// ===== Password Visibility Toggle (UI only — no logic change) =====
const togglePasswordBtn = document.getElementById("btnTogglePassword");
const passwordInput = document.getElementById("password");

if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        togglePasswordBtn.innerHTML = isPassword
            ? '<i class="fa-solid fa-eye-slash"></i>'
            : '<i class="fa-solid fa-eye"></i>';
        togglePasswordBtn.setAttribute(
            "aria-label",
            isPassword ? "إخفاء كلمة السر" : "إظهار كلمة السر"
        );
    });
}
