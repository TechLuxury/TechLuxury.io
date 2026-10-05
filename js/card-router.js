// ============================================================
// 🎯 TechLuxury — Card Router (full fix)
// - New cards  (cardType) → cards/<type>/<type>.js
// - Old cards  (no cardType) → import original customer-view.js
// Zero modifications to customer-view.js are required.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZcGZQpBZi6RwMeBnL4UcdrBQyZHXsLWY",
  authDomain: "techluxury-4b854.firebaseapp.com",
  projectId: "techluxury-4b854",
  storageBucket: "techluxury-4b854.firebasestorage.app",
  messagingSenderId: "1043863547919",
  appId: "1:1043863547919:web:46bd7c74f0fbeb2702b37a",
  measurementId: "G-EZJWPY4Q2Z"
};

// ✅ Named app so customer-view.js (which inits the DEFAULT app) can coexist
const probeApp = initializeApp(firebaseConfig, "router-probe");
const probeDb  = getFirestore(probeApp);

const NEW_TYPES = new Set(["business", "gift", "memory", "pet"]);

// ────────────────────────────────────────────────────────────
// URL helpers
// ────────────────────────────────────────────────────────────
function getCardIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("card") || params.get("c");
}

function showFatal(title, message) {
    document.getElementById("loadingScreen")?.classList.add("hidden");
    const vc = document.getElementById("viewContainer");
    if (!vc) return;
    vc.style.display = "block";
    vc.innerHTML = `
        <div class="error-screen">
            <i class="fa-solid fa-circle-exclamation"></i>
            <h2>${title}</h2>
            <p style="color: var(--text-muted); max-width: 400px;">${message}</p>
        </div>
    `;
}

// ────────────────────────────────────────────────────────────
// Dynamic CSS loader for the new per-type stylesheets
// ────────────────────────────────────────────────────────────
const TYPE_CSS = {
    business: "../cards/business/business.css",
    gift:     "../cards/gift/gift.css",
    memory:   "../cards/memory/memory.css",
    pet:      "../cards/pet/pet.css"
};

async function loadTypeCss(type) {
    const href = TYPE_CSS[type];
    if (!href) return;
    if (document.querySelector(`link[data-card-css="${type}"]`)) return;
    await new Promise((resolve) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.dataset.cardCss = type;
        link.onload = link.onerror = resolve;
        document.head.appendChild(link);
    });
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────
async function route() {
    const cardId = getCardIdFromURL();
    if (!cardId) {
        showFatal("لم يتم تحديد الكرت", "الرجاء مسح رمز QR للوصول إلى الذكرى.");
        return;
    }

    // 1) Peek the card using the isolated probe app
    let card = null;
    try {
        const snap = await getDoc(doc(probeDb, "cards", cardId));
        if (!snap.exists()) {
            showFatal("الكرت غير موجود", "تأكد من صحة الرابط أو تواصل مع الدعم.");
            return;
        }
        card = snap.data();
    } catch (err) {
        // If the probe read fails (rules/auth), fall through to legacy silently
        console.warn("Router probe read failed, falling back to legacy:", err);
        await import("./customer-view.js");
        return;
    }

    if (!card.ownerId) {
        showFatal("الكرت غير مُفعّل", "هذا الكرت لم يُربط بحساب بعد.");
        return;
    }

    // 2) Decide route
    const cardType = (card.cardType || "").toString();
    const isNew = NEW_TYPES.has(cardType);

    if (!isNew) {
        // ─── LEGACY PATH ───
        // Hand off to the untouched original viewer.
        // customer-view.js will init the DEFAULT Firebase app and render.
        console.log(`🎴 Card ${cardId} → LEGACY (customer-view.js)`);
        await import("./customer-view.js");
        return;
    }

    // ─── NEW MODULAR PATH ───
    console.log(`🎴 Card ${cardId} → NEW (${cardType})`);

    // Load shared utilities + bind probe DB
    const shared = await import("./card-shared.js");
    shared.setDb(probeDb);

    // Load per-type CSS
    await loadTypeCss(cardType);

    // Load the module
    let mod;
    try {
        mod = await import(`../cards/${cardType}/${cardType}.js`);
    } catch (err) {
        console.error("Failed to import module, falling back to legacy:", err);
        await import("./customer-view.js");
        return;
    }

    // Protected card → password prompt, then render
    if (card.salt && card.protected) {
        shared.showPasswordPrompt(card, (key) => mod.render(card, cardId, key));
    } else {
        await mod.render(card, cardId, null);
    }
}

route();
