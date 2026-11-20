import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ استبدل هذه الإعدادات بإعدادات مشروع Firebase Business الجديد الخاص بك
const businessFirebaseConfig = {
  apiKey: "AIzaSyCM-VRw9YWNx60ycP-ojGN3270ZBXZPWzs",
  authDomain: "techluxury-business.firebaseapp.com",
  projectId: "techluxury-business",
  storageBucket: "techluxury-business.firebasestorage.app",
  messagingSenderId: "993317626412",
  appId: "1:993317626412:web:c87763f70770832509a789",
  measurementId: "G-09S2DX15T3"
};

const app = initializeApp(businessFirebaseConfig, "business-app");
export const auth = getAuth(app);
export const db = getFirestore(app);
