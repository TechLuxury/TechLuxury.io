// ============================================================
// 🧩 TechLuxury — Shared Card Utilities
// Used by ALL card modules (legacy, business, gift, memory, pet)
// ============================================================

import {
    base64UrlToBytes,
    deriveFinalKey,
    decryptText,
    decryptFile
} from "./encryption.js";

// ===== Shared Firestore ref (set by router) =====
let _db = null;
export function setDb(db) { _db = db; }
export function getDb() { return _db; }

// ===== Card type registry =====
export const CARD_TYPES = {
    gift:          { label: "كرت هدية",     icon: "fa-gift",       color: "#ec4899", effect: "hearts" },
    memory_book:   { label: "كتاب ذكريات",  icon: "fa-book-open",  color: "#e2b714", effect: null },
    memory:        { label: "كتاب ذكريات",  icon: "fa-book-open",  color: "#e2b714", effect: null },
    business_card: { label: "بطاقة عمل",    icon: "fa-id-card",    color: "#3b82f6", effect: null },
    business:      { label: "بطاقة عمل",    icon: "fa-id-card",    color: "#3b82f6", effect: null },
    pet_card:      { label: "بطاقة حيوانات", icon: "fa-paw",        color: "#22c55e", effect: null },
    pet:           { label: "بطاقة حيوانات", icon: "fa-paw",        color: "#22c55e", effect: null }
};

// ===== Shared state =====
export const state = {
    currentEncryptionKey: null,
    currentCard: null,
    currentImages: [],
    currentImageIndex: 0,
    musicStarted: false
};

// ===== DOM refs =====
export const dom = {
    loadingScreen:  document.getElementById("loadingScreen"),
    viewContainer:  document.getElementById("viewContainer"),
    bgMusic:        document.getElementById("bgMusic"),
    musicToggle:    document.getElementById("musicToggle"),
    lightbox:       document.getElementById("lightbox"),
    lightboxImg:    document.getElementById("lightboxImg"),
    lightboxCounter:document.getElementById("lightboxCounter"),
    lightboxClose:  document.getElementById("lightboxClose"),
    lightboxPrev:   document.getElementById("lightboxPrev"),
    lightboxNext:   document.getElementById("lightboxNext")
};

// ============================================================
// 🆔 URL parsing
// ============================================================
export function getCardIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("card") || params.get("c");
}

// ============================================================
// 🧰 Small helpers
// ============================================================
export function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

export function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString("ar-EG", {
            year: "numeric", month: "long", day: "numeric"
        });
    } catch { return dateStr; }
}

export function toArray(value) {
    if (Array.isArray(value)) return value.filter(v => v && String(v).trim() !== "");
    if (value && typeof value === "string" && value.trim() !== "") return [value];
    return [];
}

export function hideLoading() {
    dom.loadingScreen?.classList.add("hidden");
    if (dom.viewContainer) dom.viewContainer.style.display = "block";
}

// ============================================================
// ❌ Error screen
// ============================================================
export function showError(title, message) {
    hideLoading();
    if (!dom.viewContainer) return;
    dom.viewContainer.innerHTML = `
        <div class="error-screen">
            <i class="fa-solid fa-circle-exclamation"></i>
            <h2>${escapeHtml(title)}</h2>
            <p style="color: var(--text-muted); max-width: 400px;">${escapeHtml(message)}</p>
        </div>
    `;
}

// ============================================================
// 🔐 Password prompt (shared for all protected cards)
// ============================================================
export function showPasswordPrompt(card, onSuccess) {
    hideLoading();
    if (!dom.viewContainer) return;

    const question = card.securityQuestion || "أدخل الإجابة السرية";

    dom.viewContainer.innerHTML = `
        <div class="security-screen">
            <div class="security-box">
                <div class="lock-icon"><i class="fa-solid fa-shield-halved"></i></div>
                <h3>🔐 الكرت محمي</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 0.9rem;">
                    أجب على السؤال التالي لفتح الكرت
                </p>

                <div style="background:#0f172a;border:1px solid #2e374a;border-radius:10px;padding:18px;margin-bottom:20px;text-align:right;">
                    <div style="color:#94a3b8;font-size:0.75rem;margin-bottom:8px;">
                        <i class="fa-solid fa-question-circle"></i> السؤال:
                    </div>
                    <div style="color:#e2b714;font-weight:600;font-size:1.05rem;line-height:1.5;">
                        ${escapeHtml(question)}
                    </div>
                </div>

                <input type="text" id="cardAnswerInput" placeholder="اكتب إجابتك هنا..." autocomplete="off">
                <button class="btn-unlock" id="btnUnlockCard">
                    <i class="fa-solid fa-unlock"></i> فتح الكرت
                </button>
                <p class="error-msg" id="cardAnswerError">❌ الإجابة غير صحيحة</p>
            </div>
        </div>
    `;

    const input = document.getElementById("cardAnswerInput");
    const btn = document.getElementById("btnUnlockCard");
    const errorMsg = document.getElementById("cardAnswerError");

    const tryUnlock = async () => {
        const answer = input.value.trim();
        if (!answer) {
            errorMsg.textContent = "الرجاء إدخال الإجابة";
            errorMsg.style.display = "block";
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';

        try {
            const salt = base64UrlToBytes(card.salt);
            const key = await deriveFinalKey(answer, null, salt);

            let testPassed = false;

            if (card.message && typeof card.message === "object" && card.message.ciphertext) {
                try { await decryptText(card.message.ciphertext, card.message.iv, key); testPassed = true; } catch (e) {}
            }
            if (!testPassed && Array.isArray(card.images) && card.images[0]?.url && card.images[0]?.iv) {
                try {
                    const res = await fetch(card.images[0].url);
                    const blob = await res.blob();
                    await decryptFile(blob, base64UrlToBytes(card.images[0].iv), key);
                    testPassed = true;
                } catch (e) {}
            }
            if (!testPassed && Array.isArray(card.events) && card.events[0]?.message?.ciphertext) {
                try {
                    await decryptText(card.events[0].message.ciphertext, card.events[0].message.iv, key);
                    testPassed = true;
                } catch (e) {}
            }
            if (!testPassed && (!card.message || typeof card.message === "string")) {
                testPassed = true;
            }

            if (testPassed) {
                state.currentEncryptionKey = key;
                onSuccess(key);
            } else {
                errorMsg.textContent = "❌ الإجابة غير صحيحة";
                errorMsg.style.display = "block";
                input.value = "";
                input.focus();
            }
        } catch (err) {
            console.error(err);
            errorMsg.textContent = "❌ الإجابة غير صحيحة";
            errorMsg.style.display = "block";
            input.value = "";
            input.focus();
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-unlock"></i> فتح الكرت';
        }
    };

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keypress", (e) => { if (e.key === "Enter") tryUnlock(); });
    input.focus();
}

// ============================================================
// 🔓 Media decryption (shared)
// ============================================================
export async function loadEncryptedImage(imageData, key) {
    if (typeof imageData === "string") return imageData;
    if (!imageData?.encrypted || !imageData.url || !key) return null;
    try {
        const res = await fetch(imageData.url);
        const blob = await res.blob();
        const iv = base64UrlToBytes(imageData.iv);
        const decrypted = await decryptFile(blob, iv, key);
        return URL.createObjectURL(decrypted);
    } catch (e) {
        console.error("Image decrypt failed:", e);
        return null;
    }
}

export async function loadEncryptedVideo(videoData, key) {
    if (typeof videoData === "string") return videoData;
    if (!videoData?.encrypted || !videoData.url || !key) return null;
    try {
        const res = await fetch(videoData.url);
        const blob = await res.blob();
        const iv = base64UrlToBytes(videoData.iv);
        const decrypted = await decryptFile(blob, iv, key);
        return URL.createObjectURL(decrypted);
    } catch (e) {
        console.error("Video decrypt failed:", e);
        return null;
    }
}

// ============================================================
// 🖼️ Lightbox (shared)
// ============================================================
export function openLightbox(images, index = 0) {
    if (!dom.lightbox || !images.length) return;
    state.currentImages = images;
    state.currentImageIndex = index;
    dom.lightboxImg.src = images[index];
    dom.lightboxCounter.textContent = `${index + 1} / ${images.length}`;
    dom.lightbox.classList.add("active");
    dom.lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

export function closeLightbox() {
    if (!dom.lightbox) return;
    dom.lightbox.classList.remove("active");
    dom.lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function nextImage() {
    const { currentImages, currentImageIndex } = state;
    state.currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    dom.lightboxImg.src = currentImages[state.currentImageIndex];
    dom.lightboxCounter.textContent = `${state.currentImageIndex + 1} / ${currentImages.length}`;
}

function prevImage() {
    const { currentImages, currentImageIndex } = state;
    state.currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    dom.lightboxImg.src = currentImages[state.currentImageIndex];
    dom.lightboxCounter.textContent = `${state.currentImageIndex + 1} / ${currentImages.length}`;
}

dom.lightboxClose?.addEventListener("click", closeLightbox);
dom.lightboxNext?.addEventListener("click", nextImage);
dom.lightboxPrev?.addEventListener("click", prevImage);
dom.lightbox?.addEventListener("click", (e) => { if (e.target === dom.lightbox) closeLightbox(); });

document.addEventListener("keydown", (e) => {
    if (!dom.lightbox?.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") nextImage();
    if (e.key === "ArrowRight") prevImage();
});

// ============================================================
// 🎵 Music (shared)
// ============================================================
export function startMusic(url) {
    if (!dom.bgMusic) return;
    dom.bgMusic.src = url;
    dom.bgMusic.volume = 0.5;

    const tryPlay = () => {
        dom.bgMusic.play()
            .then(() => {
                state.musicStarted = true;
                dom.musicToggle.classList.remove("visible");
                dom.musicToggle.classList.add("playing");
            })
            .catch(() => {
                dom.musicToggle.classList.add("visible");
            });
    };

    tryPlay();

    document.body.addEventListener("click", () => {
        if (!state.musicStarted) {
            dom.bgMusic.play()
                .then(() => {
                    state.musicStarted = true;
                    dom.musicToggle.classList.remove("visible");
                })
                .catch(() => {});
        }
    }, { once: true });
}

dom.musicToggle?.addEventListener("click", () => {
    if (!dom.bgMusic) return;
    if (dom.bgMusic.paused) {
        dom.bgMusic.play();
        state.musicStarted = true;
        dom.musicToggle.classList.remove("visible");
        dom.musicToggle.classList.add("playing");
    } else {
        dom.bgMusic.pause();
        dom.musicToggle.classList.add("visible");
        dom.musicToggle.classList.remove("playing");
    }
});

// ============================================================
// ✨ Effects (shared)
// ============================================================
export function startEffect(type, color) {
    const count = type === "hearts" ? 12 : 20;
    for (let i = 0; i < count; i++) {
        setTimeout(() => createParticle(type, color), i * 400);
    }
    setInterval(() => createParticle(type, color), 1500);
}

function createParticle(type, color) {
    const el = document.createElement("div");
    if (type === "hearts") {
        el.className = "heart";
        el.innerHTML = "❤";
        el.style.left = Math.random() * 100 + "%";
        el.style.color = Math.random() > 0.5 ? "#ec4899" : "#f43f5e";
        el.style.animationDuration = (6 + Math.random() * 4) + "s";
        el.style.fontSize = (14 + Math.random() * 14) + "px";
    } else if (type === "confetti") {
        el.className = "confetti";
        el.style.left = Math.random() * 100 + "%";
        el.style.background = pickColor(color);
        el.style.animationDuration = (3 + Math.random() * 3) + "s";
        el.style.width = (6 + Math.random() * 8) + "px";
        el.style.height = (6 + Math.random() * 8) + "px";
        el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
}

function pickColor(base) {
    const colors = [base, "#e2b714", "#f43f5e", "#3b82f6", "#10b981", "#a855f7"];
    return colors[Math.floor(Math.random() * colors.length)];
}
