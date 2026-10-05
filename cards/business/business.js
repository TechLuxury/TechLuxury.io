// ============================================================
// 💼 Business Card — new modular renderer
// Isolated: all classes prefixed with .tl-business-
// ============================================================

import {
    escapeHtml, hideLoading, toArray, getDb
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
    if (str.startsWith("http")) return "📍 عرض الموقع على الخريطة";
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
    document.documentElement.style.setProperty("--accent", "#3b82f6");

    const phones       = toArray(card.phone);
    const websites     = toArray(card.website);
    const instagrams   = toArray(card.instagram);
    const whatsapps    = toArray(card.whatsapp);
    const facebooks    = toArray(card.facebook);
    const linkedins    = toArray(card.linkedin);
    const emails       = toArray(card.email);
    const googleReview = (card.googleReview || "").trim();
    const logoUrl      = card.logoUrl || "";

    const contacts = [];

    phones.forEach(num => contacts.push(`
        <a href="tel:${cleanPhone(num)}" class="tl-business-contact">
            <i class="fa-solid fa-phone"></i><span>${escapeHtml(num)}</span>
        </a>
    `));

    emails.forEach(mail => contacts.push(`
        <a href="mailto:${escapeHtml(mail)}" class="tl-business-contact">
            <i class="fa-solid fa-envelope"></i><span>${escapeHtml(mail)}</span>
        </a>
    `));

    whatsapps.forEach(num => {
        const wa = cleanPhone(num).replace(/^\+/, "");
        contacts.push(`
            <a href="https://wa.me/${wa}" target="_blank" class="tl-business-contact tl-business-full">
                <i class="fa-brands fa-whatsapp"></i><span>واتساب: ${escapeHtml(num)}</span>
            </a>
        `);
    });

    websites.forEach(site => contacts.push(`
        <a href="${cleanWebsite(site)}" target="_blank" class="tl-business-contact tl-business-full">
            <i class="fa-solid fa-globe"></i><span>${escapeHtml(displayWebsite(site))}</span>
        </a>
    `));

    if (googleReview) contacts.push(`
        <a href="${cleanWebsite(googleReview)}" target="_blank"
           class="tl-business-contact tl-business-full tl-business-google">
            <i class="fa-solid fa-star"></i><span>قيّمنا على Google</span>
        </a>
    `);

    if (card.address) contacts.push(`
        <a href="https://maps.google.com/?q=${encodeURIComponent(card.address)}"
           target="_blank" class="tl-business-contact tl-business-full">
            <i class="fa-solid fa-location-dot"></i><span>${getAddressLabel(card.address)}</span>
        </a>
    `);

    const socials = [];
    instagrams.forEach(acc => socials.push(`
        <a href="${formatSocialUrl("instagram", acc)}" target="_blank"
           class="tl-business-social tl-business-instagram" title="Instagram">
            <i class="fa-brands fa-instagram"></i>
        </a>
    `));
    facebooks.forEach(fb => socials.push(`
        <a href="${formatSocialUrl("facebook", fb)}" target="_blank"
           class="tl-business-social tl-business-facebook" title="Facebook">
            <i class="fa-brands fa-facebook-f"></i>
        </a>
    `));
    linkedins.forEach(li => socials.push(`
        <a href="${formatSocialUrl("linkedin", li)}" target="_blank"
           class="tl-business-social tl-business-linkedin" title="LinkedIn">
            <i class="fa-brands fa-linkedin-in"></i>
        </a>
    `));

    dom.viewContainer.innerHTML = `
        <div class="tl-business-card">
            <div class="tl-business-logo-wrapper">
                ${logoUrl
                    ? `<img src="${logoUrl}" class="tl-business-logo" alt="${escapeHtml(card.name) || "Logo"}">`
                    : `<div class="tl-business-logo-placeholder"><i class="fa-solid fa-user"></i></div>`}
            </div>

            <h1 class="tl-business-name">${escapeHtml(card.name) || "بطاقة عمل"}</h1>
            ${card.jobTitle ? `<p class="tl-business-job">${escapeHtml(card.jobTitle)}</p>` : ""}
            ${card.company  ? `<p class="tl-business-company">${escapeHtml(card.company)}</p>` : ""}

            ${card.bio ? `
                <div class="tl-business-section">
                    <div class="tl-business-section-title"><i class="fa-solid fa-user"></i> نبذة</div>
                    <div class="tl-business-section-content">${formatMultiline(card.bio)}</div>
                </div>` : ""}

            ${card.services ? `
                <div class="tl-business-section">
                    <div class="tl-business-section-title"><i class="fa-solid fa-briefcase"></i> الخدمات</div>
                    <div class="tl-business-section-content">${formatMultiline(card.services)}</div>
                </div>` : ""}

            ${contacts.length ? `<div class="tl-business-contacts">${contacts.join("")}</div>` : ""}
            ${socials.length  ? `<div class="tl-business-socials">${socials.join("")}</div>` : ""}
        </div>
    `;

    document.title = card.name || card.company || "بطاقة عمل";

    // Optional: increment view counter (safe — ignore errors)
    try {
        const db = getDb();
        if (db) {
            await updateDoc(doc(db, "cards", cardId), { views: increment(1) }).catch(() => {});
        }
    } catch (_) {}
}

// Re-import dom ref here
import { dom } from "../../js/card-shared.js";
