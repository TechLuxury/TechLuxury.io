// ============================================================
// 🎯 TechLuxury — Card Router
// Central entry point for customer-view.html
// Dispatches to the correct module based on card.cardType
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    showError,
    showPasswordPrompt,
    setDb,
    getCardIdFromURL
} from "./card-shared.js";

// ===== Firebase (same config — DO NOT CHANGE) =====
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
const db  = getFirestore(app);
setDb(db);

// ============================================================
// 🧭 Normalize card type
// New field:  cardType ("business" | "gift" | "memory")
// Old field:  type     ("business_card" | "memory_book" | "gift" | "pet_card")
// If only old field exists → treated as LEGACY (preserve old design)
// ============================================================
function resolveRoute(card) {
    // 1) New field wins → new modular system
    if (card.cardType) {
        const map = {
            business: "business",
            gift:     "gift",
            memory:   "memory",
            pet:      "pet"
        };
        const route = map[card.cardType];
        if (route) return { route, isLegacy: false };
    }

    // 2) Anything else (including old `type`) → LEGACY (old behavior)
    return { route: "legacy", isLegacy: true };
}

// ============================================================
// 🎨 Dynamically load per-type CSS (isolated)
// ============================================================
async function loadTypeCss(route) {
    const map = {
        business: "../cards/business/business.css",
        gift:     "../cards/gift/gift.css",
        memory:   "../cards/memory/memory.css",
        pet:      "../cards/pet/pet.css"
    };
    const href = map[route];
    if (!href) return; // legacy uses only view.css

    // Skip if already loaded
    if (document.querySelector(`link[data-card-css="${route}"]`)) return;

    return new Promise((resolve) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.dataset.cardCss = route;
        link.onload = resolve;
        link.onerror = resolve; // don't block on CSS failure
        document.head.appendChild(link);
    });
}

// ============================================================
// 🚀 Route
// ============================================================
async function route() {
    const cardId = getCardIdFromURL();

    if (!cardId) {
        showError("لم يتم تحديد الكرت", "الرجاء مسح رمز QR للوصول إلى الذكرى.");
        return;
    }

    try {
        const snap = await getDoc(doc(db, "cards", cardId));

        if (!snap.exists()) {
            showError("الكرت غير موجود", "تأكد من صحة الرابط أو تواصل مع الدعم.");
            return;
        }

        const card = snap.data();

        if (!card.ownerId) {
            showError("الكرت غير مُفعّل", "هذا الكرت لم يُربط بحساب بعد.");
            return;
        }

        const { route: type, isLegacy } = resolveRoute(card);
        console.log(`🎴 Card ${cardId} → route: ${type} (legacy: ${isLegacy})`);

        // Load CSS before rendering
        await loadTypeCss(type);

        // Load the module
        let module;
        try {
            switch (type) {
                case "business":
                    module = await import("../cards/business/business.js");
                    break;
                case "gift":
                    module = await import("../cards/gift/gift.js");
                    break;
                case "memory":
                    module = await import("../cards/memory/memory.js");
                    break;
                case "pet":
                    module = await import("../cards/pet/pet.js");
                    break;
                default:
                    module = await import("../cards/legacy/legacy.js");
            }
        } catch (importErr) {
            console.error("Module import failed, falling back to legacy:", importErr);
            module = await import("../cards/legacy/legacy.js");
        }

        // Handle protected cards
        if (card.salt && card.protected && !isLegacy) {
            // New system: shared password prompt then render
            showPasswordPrompt(card, (key) => module.render(card, cardId, key));
        } else {
            await module.render(card, cardId, null);
        }

    } catch (err) {
        console.error("Router error:", err);
        showError("خطأ", "حدث خطأ أثناء تحميل الكرت.");
    }
}

route();
