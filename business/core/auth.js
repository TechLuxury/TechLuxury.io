import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// تسجيل مؤسسة جديدة
export async function registerOrganization(email, password, orgData) {
    try {
        // 1. إنشاء حساب المستخدم
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. إنشاء سجل المؤسسة (Organization)
        const orgRef = doc(db, "organizations", user.uid); // نستخدم UID كمعرف للمؤسسة لسهولة الربط
        await setDoc(orgRef, {
            orgId: user.uid,
            name: orgData.name,
            activityType: orgData.activityType,
            phone: orgData.phone,
            managerName: orgData.managerName,
            ownerId: user.uid,
            createdAt: serverTimestamp()
        });

        // 3. ربط المستخدم بالمؤسسة كمالك (Organization Owner)
        const memberRef = doc(db, "organizationMembers", user.uid);
        await setDoc(memberRef, {
            uid: user.uid,
            orgId: user.uid,
            role: "owner",
            email: email,
            createdAt: serverTimestamp()
        });

        return user;
    } catch (error) {
        throw error;
    }
}

// تسجيل الدخول
export async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

// تسجيل الخروج
export async function logout() {
    return signOut(auth);
}

// مراقبة حالة الدخول
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// جلب بيانات المؤسسة للمستخدم الحالي
export async function getCurrentOrganization(uid) {
    const memberSnap = await getDoc(doc(db, "organizationMembers", uid));
    if (!memberSnap.exists()) return null;
    
    const memberData = memberSnap.data();
    const orgSnap = await getDoc(doc(db, "organizations", memberData.orgId));
    
    if (!orgSnap.exists()) return null;
    
    return { ...orgSnap.data(), userRole: memberData.role };
}
