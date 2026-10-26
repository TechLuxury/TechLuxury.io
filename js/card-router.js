// ============================================================
// 🎯 TechLuxury — Card Router (full fix)
// - New cards  (cardType) → cards/<type>/<type>.js
// - Restaurant cards → restaurant-menu.html
// - Old cards  (no cardType) → import original customer-view.js
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

const probeApp = initializeApp(firebaseConfig, "router-probe");
const probeDb  = getFirestore(probeApp);

const NEW_TYPES = new Set(["business", "gift", "memory", "pet"]);

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

async function route() {
    const cardId = getCardIdFromURL();
    if (!cardId) {
        showFatal("لم يتم تحديد الكرت", "الرجاء مسح رمز QR للوصول إلى الذكرى.");
        return;
    }

    let card = null;
    try {
        const snap = await getDoc(doc(probeDb, "cards", cardId));
        if (!snap.exists()) {
            showFatal("الكرت غير موجود", "تأكد من صحة الرابط أو تواصل مع الدعم.");
            return;
        }
        card = snap.data();
    } catch (err) {
        console.warn("Router probe read failed, falling back to legacy:", err);
        await import("./customer-view.js");
        return;
    }

    if (!card.ownerId) {
        showFatal("الكرت غير مُفعّل", "هذا الكرت لم يُربط بحساب بعد.");
        return;
    }

    // ✅ التحقق من نوع المنيو وتوجيهه للصفحة المستقلة
    const cardType = (card.type || card.cardType || "").toString();
    
    if (cardType === "restaurant-menu") {
        window.location.replace(`restaurant-menu.html?card=${cardId}`);
        return;
    }

    const isNew = NEW_TYPES.has(cardType);

    if (!isNew) {
        console.log(`🎴 Card ${cardId} → LEGACY (customer-view.js)`);
        await import("./customer-view.js");
        return;
    }

    console.log(`🎴 Card ${cardId} → NEW (${cardType})`);
    const shared = await import("./card-shared.js");
    shared.setDb(probeDb);
    await loadTypeCss(cardType);

    let mod;
    try {
        mod = await import(`../cards/${cardType}/${cardType}.js`);
    } catch (err) {
        console.error("Failed to import module, falling back to legacy:", err);
        await import("./customer-view.js");
        return;
    }

    if (card.salt && card.protected) {
        shared.showPasswordPrompt(card, (key) => mod.render(card, cardId, key));
    } else {
        await mod.render(card, cardId, null);
    }
}

route();
