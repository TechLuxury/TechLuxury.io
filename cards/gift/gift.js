// ============================================================
// 🎁 Gift Card — new modular renderer
// Isolated: only gift-specific logic + prefixed CSS classes (.tl-gift-*)
// ============================================================

import {
    state, dom, CARD_TYPES,
    escapeHtml, hideLoading,
    loadEncryptedImage, loadEncryptedVideo,
    openLightbox,
    startMusic, startEffect
} from "../../js/card-shared.js";

import { decryptText } from "../../js/encryption.js";

// ──────────────────────────────────────────────────────────
// Local state
// ──────────────────────────────────────────────────────────
let giftImages = [];
let currentSlide = 0;

// ──────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────
export async function render(card, cardId, key) {
    state.currentCard = card;
    if (key) state.currentEncryptionKey = key;

    hideLoading();
    const typeInfo = CARD_TYPES.gift;
    document.documentElement.style.setProperty("--accent", typeInfo.color);

    // Decrypt message
    let messageText = "";
    if (typeof card.message === "string") {
        messageText = card.message;
    } else if (card.message?.ciphertext && state.currentEncryptionKey) {
        try {
            messageText = await decryptText(
                card.message.ciphertext,
                card.message.iv,
                state.currentEncryptionKey
            );
        } catch { messageText = "⚠️ تعذّر فك تشفير الرسالة"; }
    }

    // Decrypt images
    const decryptedImages = [];
    for (const img of (card.images || [])) {
        const url = await loadEncryptedImage(img, state.currentEncryptionKey);
        if (url) decryptedImages.push(url);
    }
    giftImages = decryptedImages;

    // Decrypt video
    let videoUrl = null;
    if (typeof card.video === "string") {
        videoUrl = card.video;
    } else if (card.video?.encrypted) {
        videoUrl = await loadEncryptedVideo(card.video, state.currentEncryptionKey);
    }

    // Optional music
    if (card.bgMusicUrl) startMusic(card.bgMusicUrl);
    startEffect("hearts", typeInfo.color);

    // Render
    dom.viewContainer.innerHTML = buildGiftHtml(card, messageText, decryptedImages, videoUrl);

    // Bind
    bindEnvelope();
    if (decryptedImages.length > 1) bindGallery(decryptedImages);

    document.title = card.title || "🎁 هدية خاصة";
}

// ──────────────────────────────────────────────────────────
// HTML template (prefixed classes .tl-gift-*)
// ──────────────────────────────────────────────────────────
function buildGiftHtml(card, message, images, videoUrl) {
    return `
        <div class="tl-gift-card">
            <header class="tl-gift-header">
                <div class="tl-gift-icon"><i class="fa-solid fa-gift"></i></div>
                <h1 class="tl-gift-title">${escapeHtml(card.title) || "🎁 هدية خاصة 🎁"}</h1>
                <span class="tl-gift-label"><i class="fa-solid fa-gift"></i> كرت هدية</span>
            </header>

            ${message ? buildEnvelope(message) : ""}
            ${images.length ? buildAlbum(images) : ""}
            ${videoUrl ? buildVideo(videoUrl) : ""}
        </div>
    `;
}

function buildEnvelope(message) {
    return `
        <section class="tl-gift-message-section">
            <div class="tl-gift-envelope-wrapper" id="tlGiftEnvelopeWrapper">
                <button type="button" class="tl-gift-envelope" id="tlGiftEnvelope" aria-label="فتح الرسالة">
                    <div class="tl-gift-letter">
                        <div class="tl-gift-letter-content">
                            <div class="tl-gift-letter-icon">💌</div>
                            <div class="tl-gift-letter-title">رسالة خاصة لك</div>
                            <div class="tl-gift-letter-divider"></div>
                            <p class="tl-gift-letter-message">${escapeHtml(message)}</p>
                        </div>
                    </div>
                    <div class="tl-gift-envelope-body">
                        <div class="tl-gift-envelope-heart">♥</div>
                    </div>
                    <div class="tl-gift-envelope-flap"></div>
                    <div class="tl-gift-envelope-open-text">
                        <i class="fa-solid fa-hand-pointer"></i>
                        <span>اضغط لفتح الرسالة</span>
                    </div>
                </button>
            </div>
        </section>
    `;
}

function buildAlbum(images) {
    const useThumbs = images.length > 4;
    return `
        <h3 class="tl-gift-section-title">
            <i class="fa-solid fa-images"></i> ألبوم الصور (${images.length})
        </h3>
        <div class="tl-gift-album" id="tlGiftAlbum">
            <div class="tl-gift-viewport">
                ${images.map((url, i) => `
                    <div class="tl-gift-slide ${i === 0 ? "active" : ""}" data-slide="${i}">
                        <img src="${url}" alt="صورة ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}" draggable="false">
                    </div>
                `).join("")}
                ${images.length > 1 ? `
                    <button class="tl-gift-nav prev" data-nav="prev" aria-label="السابق">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button class="tl-gift-nav next" data-nav="next" aria-label="التالي">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                ` : ""}
            </div>
            ${images.length > 1 ? (
                useThumbs
                ? `<div class="tl-gift-thumbs">
                    ${images.map((url, i) => `
                        <button class="tl-gift-thumb ${i === 0 ? "active" : ""}" data-thumb="${i}">
                            <img src="${url}" alt="" loading="lazy">
                        </button>
                    `).join("")}
                   </div>`
                : `<div class="tl-gift-dots">
                    ${images.map((_, i) => `<button class="tl-gift-dot ${i === 0 ? "active" : ""}" data-dot="${i}"></button>`).join("")}
                   </div>`
            ) : ""}
        </div>
    `;
}

function buildVideo(url) {
    return `
        <h3 class="tl-gift-section-title"><i class="fa-solid fa-video"></i> الفيديو</h3>
        <div class="tl-gift-video-wrapper">
            <video controls playsinline preload="metadata">
                <source src="${url}" type="video/mp4">
            </video>
        </div>
    `;
}

// ──────────────────────────────────────────────────────────
// Envelope animation
// ──────────────────────────────────────────────────────────
function bindEnvelope() {
    const wrapper = document.getElementById("tlGiftEnvelopeWrapper");
    const btn = document.getElementById("tlGiftEnvelope");
    if (!btn || !wrapper) return;

    let opened = false;
    const open = () => {
        if (opened) return;
        opened = true;
        wrapper.classList.add("opened");
        btn.disabled = true;
    };
    btn.addEventListener("click", open);
    btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
}

// ──────────────────────────────────────────────────────────
// Gallery
// ──────────────────────────────────────────────────────────
function bindGallery(images) {
    currentSlide = 0;
    const slides  = document.querySelectorAll(".tl-gift-slide");
    const thumbs  = document.querySelectorAll(".tl-gift-thumb");
    const dots    = document.querySelectorAll(".tl-gift-dot");
    const prevBtn = document.querySelector('.tl-gift-nav[data-nav="prev"]');
    const nextBtn = document.querySelector('.tl-gift-nav[data-nav="next"]');

    function goTo(idx) {
        if (idx < 0) idx = 0;
        if (idx >= images.length) idx = images.length - 1;
        slides.forEach((s, i) => s.classList.toggle("active", i === idx));
        thumbs.forEach((t, i) => t.classList.toggle("active", i === idx));
        dots.forEach((d, i) => d.classList.toggle("active", i === idx));
        currentSlide = idx;
    }

    prevBtn?.addEventListener("click", () => goTo(currentSlide - 1));
    nextBtn?.addEventListener("click", () => goTo(currentSlide + 1));
    thumbs.forEach(t => t.addEventListener("click", () => goTo(+t.dataset.thumb)));
    dots.forEach(d => d.addEventListener("click", () => goTo(+d.dataset.dot)));

    slides.forEach((s, i) => {
        s.querySelector("img")?.addEventListener("click", () => openLightbox(images, i));
    });

    // Touch
    let sx = 0;
    const vp = document.querySelector(".tl-gift-viewport");
    vp?.addEventListener("touchstart", e => { sx = e.changedTouches[0].screenX; }, { passive: true });
    vp?.addEventListener("touchend", e => {
        const d = sx - e.changedTouches[0].screenX;
        if (Math.abs(d) >= 50) goTo(d > 0 ? currentSlide + 1 : currentSlide - 1);
    });
}
