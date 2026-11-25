// ============================================================
// 💼 Business Card — Luxury Modular Renderer
// ============================================================

import {
    escapeHtml, hideLoading, toArray, getDb, dom
} from "../../js/card-shared.js";

import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function cleanPhone(p) { return String(p).replace(/[^\d+]/g, ""); }

function cleanWebsite(u) {
    let s = String(u).trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    return s;
}

function displayWebsite(u) {
    return String(u).replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function formatSocialUrl(platform, value) {
    let str = String(value).trim();
    if (!str) return "";
    if (/^https?:\/\//i.test(str)) return str;
    str = str.replace(/^@/, "").replace(/^\/+/, "");
    if (platform === "facebook")  return `https://facebook.com/${str}`;
    if (platform === "instagram") return `https://instagram.com/${str}`;
    if (platform === "linkedin") {
        if (str.includes("/")) return `https://linkedin.com/${str}`;
        return `https://linkedin.com/in/${str}`;
    }
    return str;
}

function getAddressLabel(address) {
    if (!address) return "";
    const str = String(address).trim();
    if (str.startsWith("http")) return "عرض الموقع على الخريطة";
    return escapeHtml(str);
}

function formatMultiline(text) {
    if (!text) return "";
    return escapeHtml(text).replace(/\n/g, "<br>");
}

// ──────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────
export async function render(card, cardId, key) {
    hideLoading();
    
    // إعداد المتغيرات
    const phones       = toArray(card.phone);
    const websites     = toArray(card.website);
    const instagrams   = toArray(card.instagram);
    const whatsapps    = toArray(card.whatsapp);
    const facebooks    = toArray(card.facebook);
    const linkedins    = toArray(card.linkedin);
    const emails       = toArray(card.email);
    const googleReview = (card.googleReview || "").trim();
    const logoUrl      = card.logoUrl || "";

    // تجهيز الخدمات (تقسيم النص بناءً على الأسطر لإنشاء بطاقات مستقلة)
    const servicesArray = card.services 
        ? card.services.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0) 
        : [];

    // ── Contact Items ──
    const contacts = [];

    phones.forEach(num => contacts.push(`
        <a href="tel:${cleanPhone(num)}" class="tl-business-contact">
            <i class="fa-solid fa-phone"></i>
            <span dir="ltr" class="tl-ltr-text">${escapeHtml(num)}</span>
        </a>
    `));

    whatsapps.forEach(num => {
        const wa = cleanPhone(num).replace(/^\+/, "");
        contacts.push(`
            <a href="https://wa.me/${wa}" target="_blank" class="tl-business-contact">
                <i class="fa-brands fa-whatsapp"></i>
                <span dir="ltr" class="tl-ltr-text">${escapeHtml(num)}</span>
            </a>
        `);
    });

    emails.forEach(mail => contacts.push(`
        <a href="mailto:${escapeHtml(mail)}" class="tl-business-contact">
            <i class="fa-solid fa-envelope"></i>
            <span dir="ltr" class="tl-ltr-text">${escapeHtml(mail)}</span>
        </a>
    `));

    websites.forEach(site => contacts.push(`
        <a href="${cleanWebsite(site)}" target="_blank" class="tl-business-contact">
            <i class="fa-solid fa-globe"></i>
            <span dir="ltr" class="tl-ltr-text">${escapeHtml(displayWebsite(site))}</span>
        </a>
    `));

    if (googleReview) contacts.push(`
        <a href="${cleanWebsite(googleReview)}" target="_blank" class="tl-business-contact tl-google-review">
            <i class="fa-solid fa-star"></i>
            <span>قيّمنا على Google</span>
        </a>
    `);

    if (card.address) contacts.push(`
        <a href="https://maps.google.com/?q=${encodeURIComponent(card.address)}" target="_blank" class="tl-business-contact">
            <i class="fa-solid fa-location-dot"></i>
            <span>${getAddressLabel(card.address)}</span>
        </a>
    `);

    // ── Social Icons ──
    const socials = [];
    if (instagrams.length) socials.push(`<a href="${formatSocialUrl("instagram", instagrams[0])}" target="_blank" class="tl-business-social" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`);
    if (facebooks.length) socials.push(`<a href="${formatSocialUrl("facebook", facebooks[0])}" target="_blank" class="tl-business-social" title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>`);
    if (linkedins.length) socials.push(`<a href="${formatSocialUrl("linkedin", linkedins[0])}" target="_blank" class="tl-business-social" title="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>`);

    // ── Render HTML ──
    dom.viewContainer.innerHTML = `
        <div class="tl-luxury-wrapper">
            <div class="tl-luxury-card">
                
                <!-- Header -->
                <div class="tl-luxury-header">
                    <div class="tl-luxury-logo-container">
                        ${logoUrl
                            ? `<img src="${logoUrl}" class="tl-luxury-logo" alt="Logo">`
                            : `<div class="tl-luxury-logo-placeholder"><i class="fa-solid fa-user-tie"></i></div>`}
                    </div>
                    <h1 class="tl-luxury-name">${escapeHtml(card.name) || "بطاقة عمل"}</h1>
                    ${card.jobTitle ? `<p class="tl-luxury-job">${escapeHtml(card.jobTitle)}</p>` : ""}
                    ${card.company ? `<p class="tl-luxury-company">${escapeHtml(card.company)}</p>` : ""}
                </div>

                <!-- Bio Section -->
                ${card.bio ? `
                <div class="tl-luxury-section">
                    <h2 class="tl-luxury-section-title">النبذة</h2>
                    <div class="tl-luxury-bio-text">${formatMultiline(card.bio)}</div>
                </div>` : ""}

                <!-- Services Section -->
                ${servicesArray.length > 0 ? `
                <div class="tl-luxury-section">
                    <h2 class="tl-luxury-section-title">الخدمات</h2>
                    <div class="tl-luxury-services-grid">
                        ${servicesArray.map(service => `
                            <div class="tl-luxury-service-card">
                                <i class="fa-solid fa-gem tl-service-icon"></i>
                                <span>${escapeHtml(service)}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>` : ""}

                <!-- Contact Section -->
                ${contacts.length > 0 ? `
                <div class="tl-luxury-section">
                    <h2 class="tl-luxury-section-title">معلومات التواصل</h2>
                    <div class="tl-luxury-contact-grid">
                        ${contacts.join("")}
                    </div>
                </div>` : ""}

                <!-- Socials -->
                ${socials.length > 0 ? `
                <div class="tl-luxury-socials">
                    ${socials.join("")}
                </div>` : ""}

            </div>
        </div>
    `;

    document.title = card.name || card.company || "بطاقة عمل";

    // Increment view counter
    try {
        const db = getDb();
        if (db) await updateDoc(doc(db, "cards", cardId), { views: increment(1) }).catch(() => {});
    } catch (_) {}
}
