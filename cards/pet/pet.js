// ============================================================
// 🐾 Pet Card — new modular renderer
// Isolated: all classes prefixed with .tl-pet-
// ============================================================

import {
    escapeHtml, formatDate, hideLoading, state
} from "../../js/card-shared.js";

// ──────────────────────────────────────────────────────────
// Helpers (local, isolated — no global pollution)
// ──────────────────────────────────────────────────────────
function cleanPhone(p) {
    return String(p || "").replace(/[^\d+]/g, "");
}

const TYPE_EMOJI = {
    "قط":      "🐱",
    "كلب":     "🐶",
    "طير":     "🐦",
    "أرنب":    "🐰",
    "سمكة":    "🐠",
    "سلحفاة":  "🐢",
    "هامستر":  "🐹",
    "آخر":     "🐾"
};

// ──────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────
export async function render(card, cardId, key) {
    state.currentCard = card;
    if (key) state.currentEncryptionKey = key;

    hideLoading();
    document.documentElement.style.setProperty("--accent", "#22c55e");

    const petPhoto   = card.petPhoto || "";
    const petEmoji   = TYPE_EMOJI[card.petType] || "🐾";

    // ============================================================
    // 📋 Info items (breed / age / weight / color)
    // ============================================================
    const infoItems = [];
    if (card.petBreed)  infoItems.push({ label: "🧬 السلالة", value: card.petBreed });
    if (card.petAge)    infoItems.push({ label: "🎂 العمر",   value: card.petAge });
    if (card.petWeight) infoItems.push({ label: "⚖️ الوزن",   value: card.petWeight });
    if (card.petColor)  infoItems.push({ label: "🎨 اللون",   value: card.petColor });

    const infoGridHtml = infoItems.length ? `
        <div class="tl-pet-info-grid">
            ${infoItems.map(item => `
                <div class="tl-pet-info-item">
                    <div class="tl-pet-info-label">${item.label}</div>
                    <div class="tl-pet-info-value">${escapeHtml(item.value)}</div>
                </div>
            `).join("")}
        </div>
    ` : "";

    // ============================================================
    // 💉 Vaccination
    // ============================================================
    const vaccinationHtml = card.petVaccinations ? `
        <div class="tl-pet-info-item tl-pet-vaccination">
            <div class="tl-pet-info-label">💉 آخر تطعيم</div>
            <div class="tl-pet-info-value">${formatDate(card.petVaccinations)}</div>
        </div>
    ` : "";

    // ============================================================
    // 📝 Notes
    // ============================================================
    const notesHtml = card.petNotes ? `
        <div class="tl-pet-notes-box">
            <div class="tl-pet-notes-title">
                <i class="fa-solid fa-triangle-exclamation"></i>
                ملاحظات مهمة
            </div>
            <div class="tl-pet-notes-content">${escapeHtml(card.petNotes)}</div>
        </div>
    ` : "";

    // ============================================================
    // 📞 Contact box
    // ============================================================
    const phoneClean = cleanPhone(card.petOwnerPhone || "");
    const contactHtml = card.petOwnerPhone ? `
        <div class="tl-pet-contact-box">
            <div class="tl-pet-contact-title">
                <i class="fa-solid fa-phone"></i>
                إذا وجدت هذا الحيوان، اتصل بمالكه
            </div>

            ${card.petOwnerName ? `
                <div class="tl-pet-owner-name">${escapeHtml(card.petOwnerName)}</div>
            ` : ""}

            <a href="tel:${phoneClean}" class="tl-pet-contact-btn">
                <i class="fa-solid fa-phone"></i>
                <span>${escapeHtml(card.petOwnerPhone)}</span>
            </a>

            ${card.petAddress ? `
                <a href="https://maps.google.com/?q=${encodeURIComponent(card.petAddress)}"
                   target="_blank"
                   class="tl-pet-contact-btn tl-pet-contact-secondary">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${escapeHtml(card.petAddress)}</span>
                </a>
            ` : ""}
        </div>
    ` : "";

    // ============================================================
    // 🖥️ Render
    // ============================================================
    document.getElementById("viewContainer").innerHTML = `
        <div class="tl-pet-card">
            <div class="tl-pet-photo-wrapper">
                ${petPhoto
                    ? `<img src="${petPhoto}" class="tl-pet-photo" alt="${escapeHtml(card.petName) || "Pet"}">`
                    : `<div class="tl-pet-photo-placeholder">${petEmoji}</div>`
                }
            </div>

            <h1 class="tl-pet-name">${escapeHtml(card.petName) || "حيوان أليف"}</h1>

            <p class="tl-pet-type">
                <span class="tl-pet-type-emoji">${petEmoji}</span>
                <span>${escapeHtml(card.petType) || "حيوان"}</span>
            </p>

            ${infoGridHtml}
            ${vaccinationHtml}
            ${notesHtml}
            ${contactHtml}
        </div>
    `;

    document.title = card.petName || "بطاقة حيوان";
}
