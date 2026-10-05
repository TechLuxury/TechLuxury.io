// ============================================================
// 📖 Memory Book — new modular renderer
// Isolated: all classes prefixed with .tl-memory-
// ============================================================

import {
    escapeHtml, formatDate, hideLoading,
    loadEncryptedImage, loadEncryptedVideo,
    openLightbox, startMusic, state
} from "../../js/card-shared.js";

import { decryptText } from "../../js/encryption.js";

let pages = [];
let current = 0;

export async function render(card, cardId, key) {
    hideLoading();
    document.documentElement.style.setProperty("--accent", "#e2b714");
    if (key) state.currentEncryptionKey = key;

    const rawEvents = card.events || [];
    pages = [];

    for (const evt of rawEvents) {
        // Decrypt message
        let message = "";
        if (typeof evt.message === "string") message = evt.message;
        else if (evt.message?.ciphertext && state.currentEncryptionKey) {
            try {
                message = await decryptText(
                    evt.message.ciphertext, evt.message.iv, state.currentEncryptionKey
                );
            } catch { message = "⚠️ تعذّر فك التشفير"; }
        }

        // Decrypt images
        const imgs = [];
        for (const img of (evt.images || [])) {
            const url = await loadEncryptedImage(img, state.currentEncryptionKey);
            if (url) imgs.push(url);
        }

        // Decrypt video
        let videoUrl = null;
        if (typeof evt.video === "string") videoUrl = evt.video;
        else if (evt.video?.encrypted) {
            videoUrl = await loadEncryptedVideo(evt.video, state.currentEncryptionKey);
        }

        pages.push({
            id: evt.id, emoji: evt.emoji || "📌",
            title: evt.title || "", date: evt.date || "",
            message, images: imgs, videoUrl
        });
    }

    if (!pages.length) {
        document.getElementById("viewContainer").innerHTML = `
            <div class="error-screen">
                <i class="fa-solid fa-book" style="color: #e2b714;"></i>
                <h2>الكتاب فارغ</h2>
            </div>`;
        return;
    }

    if (card.bgMusicUrl) startMusic(card.bgMusicUrl);

    document.getElementById("viewContainer").innerHTML = `
        <div class="tl-memory-book">
            <header class="tl-memory-cover">
                <h1 class="tl-memory-title">📖 ${escapeHtml(card.title) || "كتاب الذكريات"}</h1>
                <p class="tl-memory-subtitle">${pages.length} صفحة</p>
            </header>

            <div class="tl-memory-pages" id="tlMemoryPages">
                ${pages.map((p, i) => pageHtml(p, i)).join("")}
            </div>

            <div class="tl-memory-controls">
                <button class="tl-memory-nav" id="tlMemoryPrev" disabled>
                    <i class="fa-solid fa-chevron-right"></i> السابق
                </button>
                <div class="tl-memory-indicator">
                    صفحة <strong id="tlMemoryNum">1</strong> من ${pages.length}
                </div>
                <button class="tl-memory-nav" id="tlMemoryNext" ${pages.length <= 1 ? "disabled" : ""}>
                    التالي <i class="fa-solid fa-chevron-left"></i>
                </button>
            </div>

            <div class="tl-memory-dots" id="tlMemoryDots">
                ${pages.map((_, i) => `
                    <button class="tl-memory-dot ${i === 0 ? "active" : ""}" data-page="${i}"></button>
                `).join("")}
            </div>
        </div>
    `;

    bindNav();
    show(0);
    document.title = card.title || "كتاب الذكريات";
}

function pageHtml(p, i) {
    return `
        <div class="tl-memory-page ${i === 0 ? "active" : ""}" data-page="${i}">
            <div class="tl-memory-page-header">
                <div class="tl-memory-emoji">${p.emoji}</div>
                <h2 class="tl-memory-page-title">${escapeHtml(p.title) || "ذكرى"}</h2>
                ${p.date ? `<p class="tl-memory-page-date"><i class="fa-solid fa-calendar"></i> ${formatDate(p.date)}</p>` : ""}
            </div>
            ${p.message ? `<p class="tl-memory-page-message">${escapeHtml(p.message)}</p>` : ""}
            ${p.images.length ? `<div class="tl-memory-gallery">${p.images.map(url => `
                <img src="${url}" loading="lazy" alt="">
            `).join("")}</div>` : ""}
            ${p.videoUrl ? `<div class="tl-memory-video"><video controls playsinline preload="metadata">
                <source src="${p.videoUrl}" type="video/mp4">
            </video></div>` : ""}
        </div>
    `;
}

function bindNav() {
    document.getElementById("tlMemoryPrev")?.addEventListener("click", () => show(current - 1));
    document.getElementById("tlMemoryNext")?.addEventListener("click", () => show(current + 1));
    document.querySelectorAll(".tl-memory-dot").forEach(dot => {
        dot.addEventListener("click", () => show(+dot.dataset.page));
    });
}

function show(idx) {
    if (idx < 0 || idx >= pages.length) return;
    current = idx;

    document.querySelectorAll(".tl-memory-page").forEach(p => p.classList.remove("active"));
    document.querySelector(`.tl-memory-page[data-page="${idx}"]`)?.classList.add("active");

    const numEl = document.getElementById("tlMemoryNum");
    if (numEl) numEl.textContent = idx + 1;

    document.querySelectorAll(".tl-memory-dot").forEach((d, i) =>
        d.classList.toggle("active", i === idx));

    const prev = document.getElementById("tlMemoryPrev");
    const next = document.getElementById("tlMemoryNext");
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === pages.length - 1;

    // Gallery lightbox binding for current page
    const imgs = pages[idx].images;
    document.querySelectorAll(`.tl-memory-page[data-page="${idx}"] .tl-memory-gallery img`).forEach((img, i) => {
        img.addEventListener("click", () => openLightbox(imgs, i));
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}
