// ============================================================
// 📦 Legacy Card Renderer
// Handles ALL existing cards (no `cardType` field).
// Behavior IDENTICAL to the original customer-view.js.
// ============================================================

import {
    state, dom, CARD_TYPES,
    escapeHtml, formatDate, toArray,
    loadEncryptedImage, loadEncryptedVideo,
    openLightbox, closeLightbox,
    startMusic, startEffect,
    hideLoading
} from "../../js/card-shared.js";

import {
    base64UrlToBytes,
    decryptText,
    decryptFile
} from "../../js/encryption.js";

// ──────────────────────────────────────────────────────────
// الحالة المحلية (نفس متغيرات customer-view.js الأصلية)
// ──────────────────────────────────────────────────────────
let currentImages = [];
let currentImageIndex = 0;
let currentBookPage = 0;
let bookPages = [];

// ============================================================
// 🛠️ دوال مساعدة وتنظيف البيانات
// ============================================================
function cleanInstagram(u) {
    return String(u || "").replace(/^@/, "").replace(/^.*instagram\.com\//, "").replace(/\/$/, "").trim();
}

function cleanPhone(p) { 
    return String(p || "").replace(/[^\d+]/g, ""); 
}

function cleanWebsite(u) {
    let s = String(u || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    return s;
}

function displayWebsite(u) { 
    return String(u || "").replace(/^https?:\/\//i, "").replace(/\/$/, ""); 
}

function formatSocialUrl(platform, handle) {
    if (!handle) return "#";
    const cleanHandle = handle.trim();
    switch (platform) {
        case "instagram": return `https://instagram.com/${cleanInstagram(cleanHandle)}`;
        case "facebook": return cleanHandle.startsWith("http") ? cleanHandle : `https://facebook.com/${cleanHandle}`;
        case "twitter": return `https://twitter.com/${cleanHandle.replace(/^@/, "")}`;
        case "linkedin": return cleanHandle.startsWith("http") ? cleanHandle : `https://linkedin.com/in/${cleanHandle}`;
        case "whatsapp": return `https://wa.me/${cleanPhone(cleanHandle)}`;
        default: return cleanHandle.startsWith("http") ? cleanHandle : `https://${cleanHandle}`;
    }
}

function formatServices(services) {
    const arr = toArray(services);
    if (arr.length === 0) return "";
    return `
        <div class="bc-services-section">
            <h4 class="bc-subtitle"><i class="fa-solid fa-briefcase"></i> الخدمات المقدمة</h4>
            <div class="bc-services-grid">
                ${arr.map(s => `<div class="bc-service-chip"><i class="fa-solid fa-check"></i> ${escapeHtml(s)}</div>`).join("")}
            </div>
        </div>
    `;
}

function getAddressLabel(address) {
    if (!address) return "";
    return typeof address === "object" ? (address.label || address.url || "") : String(address);
}

// ============================================================
// 🖼️ الألبوم والمعرض (Album & Gallery Handlers)
// ============================================================
function setupAlbum() {
    const prevBtn = document.getElementById("albumPrev");
    const nextBtn = document.getElementById("albumNext");
    const expandBtn = document.getElementById("albumExpandBtn");
    
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (currentImages.length <= 1) return;
            currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
            updateAlbumUI();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (currentImages.length <= 1) return;
            currentImageIndex = (currentImageIndex + 1) % currentImages.length;
            updateAlbumUI();
        });
    }

    if (expandBtn) {
        expandBtn.addEventListener("click", () => {
            openLightbox(currentImages, currentImageIndex);
        });
    }

    document.querySelectorAll(".album-thumb").forEach((thumb) => {
        thumb.addEventListener("click", () => {
            currentImageIndex = parseInt(thumb.dataset.thumb, 10);
            updateAlbumUI();
        });
    });

    document.querySelectorAll(".album-dot").forEach((dot) => {
        dot.addEventListener("click", () => {
            currentImageIndex = parseInt(dot.dataset.dot, 10);
            updateAlbumUI();
        });
    });
}

function updateAlbumUI() {
    const slides = document.querySelectorAll(".album-slide");
    slides.forEach((slide, idx) => {
        slide.classList.toggle("active", idx === currentImageIndex);
    });

    const counterSpan = document.querySelector("#albumCounter span");
    if (counterSpan) {
        counterSpan.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
    }

    const progressFill = document.getElementById("albumProgressFill");
    if (progressFill) {
        progressFill.style.width = `${((currentImageIndex + 1) / currentImages.length) * 100}%`;
    }

    const progressLabel = document.getElementById("albumProgressLabel");
    if (progressLabel) {
        progressLabel.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
    }

    document.querySelectorAll(".album-thumb").forEach((thumb, idx) => {
        thumb.classList.toggle("active", idx === currentImageIndex);
    });

    document.querySelectorAll(".album-dot").forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentImageIndex);
    });
}

function setupGallery() {
    document.querySelectorAll(".page-gallery img").forEach((img, idx) => {
        img.addEventListener("click", () => {
            openLightbox(currentImages, idx);
        });
    });
}

// ============================================================
// 💌 تشغيل ظرف الرسالة
// ============================================================
function setupGiftEnvelope() {
    const envelope = document.getElementById("giftEnvelope");
    const wrapper  = document.getElementById("giftEnvelopeWrapper");

    if (!envelope || !wrapper) return;

    let opened = false;

    const openEnvelope = () => {
        if (opened) return;
        opened = true;
        envelope.disabled = true;
        wrapper.classList.add("opened");
    };

    envelope.addEventListener("click", openEnvelope);
    envelope.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openEnvelope();
        }
    });
}

// ============================================================
// 🎁 كرت الهدية
// ============================================================
async function renderGiftCard(card, typeInfo) {
    const imagesData = card.images || [];
    const decryptedImages = [];

    for (const img of imagesData) {
        const url = await loadEncryptedImage(img);
        if (url) decryptedImages.push(url);
    }

    let messageText = "";
    if (card.message) {
        if (typeof card.message === "string") {
            messageText = card.message;
        } else if (card.message.ciphertext && state.currentEncryptionKey) {
            try {
                messageText = await decryptText(
                    card.message.ciphertext,
                    card.message.iv,
                    state.currentEncryptionKey
                );
            } catch (e) {
                console.error("فشل فك تشفير الرسالة:", e);
                messageText = "⚠️ تعذّر فك تشفير الرسالة";
            }
        }
    }

    let videoUrl = null;
    if (card.videoUrl && typeof card.videoUrl === "string") {
        videoUrl = card.videoUrl;
    } else if (card.video && typeof card.video === "object" && card.video.encrypted && card.video.url) {
        videoUrl = await loadEncryptedVideo(card.video);
    } else if (card.video && typeof card.video === "string") {
        videoUrl = card.video;
    }

    const totalImages = decryptedImages.length;
    const useThumbnails = totalImages > 4;

    const albumHtml = totalImages > 0 ? `
        <h3 class="section-title">
            <i class="fa-solid fa-images"></i>
            ألبوم الصور (${totalImages})
        </h3>
        <div class="album-container" id="albumContainer">
            <div class="album-viewport" id="albumViewport">
                <div class="album-top-bar">
                    <div class="album-counter" id="albumCounter">
                        <i class="fa-solid fa-image"></i>
                        <span>1 / ${totalImages}</span>
                    </div>
                    ${totalImages > 1 ? `
                        <button type="button" class="album-expand-btn" id="albumExpandBtn" aria-label="عرض كامل">
                            <i class="fa-solid fa-expand"></i>
                        </button>
                    ` : ""}
                </div>
                ${decryptedImages.map((url, i) => `
                    <div class="album-slide ${i === 0 ? "active" : ""}" data-slide="${i}">
                        <img src="${url}" alt="صورة ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}" draggable="false">
                    </div>
                `).join("")}
                ${totalImages > 1 ? `
                    <button class="album-nav-btn prev" id="albumPrev" aria-label="السابق">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button class="album-nav-btn next" id="albumNext" aria-label="التالي">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                ` : ""}
            </div>
            ${totalImages > 1 ? (
                useThumbnails ? `
                    <div class="album-thumbs" id="albumThumbs">
                        ${decryptedImages.map((url, i) => `
                            <button type="button" class="album-thumb ${i === 0 ? "active" : ""}" data-thumb="${i}" aria-label="صورة ${i + 1}">
                                <img src="${url}" alt="" loading="lazy">
                            </button>
                        `).join("")}
                    </div>
                    <div class="album-progress">
                        <div class="album-progress-track">
                            <div class="album-progress-fill" id="albumProgressFill" style="width: ${100 / totalImages}%"></div>
                        </div>
                        <div class="album-progress-label" id="albumProgressLabel">1 / ${totalImages}</div>
                    </div>
                ` : `
                    <div class="album-dots" id="albumDots">
                        ${decryptedImages.map((_, i) => `
                            <button class="album-dot ${i === 0 ? "active" : ""}" data-dot="${i}"></button>
                        `).join("")}
                    </div>
                `
            ) : ""}
        </div>
    ` : "";

    const messageEnvelopeHtml = messageText ? `
        <section class="gift-message-section" aria-label="رسالة الهدية">
            <div class="gift-envelope-wrapper" id="giftEnvelopeWrapper">
                <button type="button" class="gift-envelope" id="giftEnvelope" aria-label="فتح الرسالة">
                    <div class="gift-letter">
                        <div class="gift-letter-content">
                            <div class="gift-letter-inner">
                                <div class="gift-letter-icon">💌</div>
                                <div class="gift-letter-title">رسالة خاصة لك</div>
                                <div class="gift-letter-divider"></div>
                                <p class="gift-letter-message">${escapeHtml(messageText)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="envelope-body">
                        <div class="envelope-heart">♥</div>
                    </div>
                    <div class="envelope-flap"></div>
                    <div class="envelope-open-text">
                        <i class="fa-solid fa-hand-pointer"></i>
                        <span>اضغط لفتح الرسالة</span>
                    </div>
                </button>
            </div>
        </section>
    ` : "";

    dom.viewContainer.innerHTML = `
        <header class="gift-header">
            <div class="gift-icon" style="color: ${typeInfo.color};">
                <i class="fa-solid ${typeInfo.icon}"></i>
            </div>
            <h1>${escapeHtml(card.title) || "🎁 هدية خاصة 🎁"}</h1>
            <div class="gift-label">
                <i class="fa-solid ${typeInfo.icon}"></i>
                ${typeInfo.label}
            </div>
        </header>

        ${messageEnvelopeHtml}
        ${albumHtml}

        ${videoUrl ? `
            <h3 class="section-title">
                <i class="fa-solid fa-video"></i>
                الفيديو
            </h3>
            <div class="video-wrapper">
                <video controls playsinline preload="metadata">
                    <source src="${videoUrl}" type="video/mp4">
                </video>
            </div>
        ` : ""}
    `;

    currentImages = decryptedImages;
    setupAlbum();
    setupGiftEnvelope();
}

// ============================================================
// 📖 كتاب الذكريات
// ============================================================
async function renderMemoryBook(card, typeInfo) {
    bookPages = [];
    const rawEvents = card.events || [];

    for (const evt of rawEvents) {
        let message = "";
        if (evt.message) {
            if (typeof evt.message === "string") {
                message = evt.message;
            } else if (evt.message.ciphertext && state.currentEncryptionKey) {
                try {
                    message = await decryptText(evt.message.ciphertext, evt.message.iv, state.currentEncryptionKey);
                } catch (e) {
                    message = "⚠️ تعذّر فك التشفير";
                }
            }
        }

        const decryptedImages = [];
        for (const img of (evt.images || [])) {
            const url = await loadEncryptedImage(img);
            if (url) decryptedImages.push(url);
        }

        let videoUrl = null;
        if (evt.video) {
            if (typeof evt.video === "string") {
                videoUrl = evt.video;
            } else if (evt.video.encrypted && state.currentEncryptionKey) {
                videoUrl = await loadEncryptedVideo(evt.video);
            }
        }

        bookPages.push({
            id: evt.id, emoji: evt.emoji, title: evt.title, date: evt.date,
            message: message, images: decryptedImages, videoUrl: videoUrl
        });
    }

    currentBookPage = 0;

    if (bookPages.length === 0) {
        dom.viewContainer.innerHTML = `
            <div class="error-screen">
                <i class="fa-solid fa-book" style="color: var(--accent);"></i>
                <h2>الكتاب فارغ</h2>
            </div>
        `;
        return;
    }

    dom.viewContainer.innerHTML = `
        <div class="book-container">
            <div class="book-cover">
                <h1>📖 ${escapeHtml(card.title) || "كتاب الذكريات"}</h1>
                <p class="book-subtitle">${bookPages.length} صفحة</p>
            </div>
            <div class="book-pages" id="bookPages">
                ${bookPages.map((evt, i) => renderBookPage(evt, i)).join("")}
            </div>
            <div class="book-controls">
                <button class="book-nav-btn" id="bookPrev" disabled><i class="fa-solid fa-chevron-right"></i> السابق</button>
                <div class="book-page-indicator">صفحة <strong id="currentPageNum">1</strong> من ${bookPages.length}</div>
                <button class="book-nav-btn" id="bookNext" ${bookPages.length <= 1 ? "disabled" : ""}>التالي <i class="fa-solid fa-chevron-left"></i></button>
            </div>
            <div class="book-dots" id="bookDots">
                ${bookPages.map((_, i) => `<button class="book-dot ${i === 0 ? "active" : ""}" data-page="${i}"></button>`).join("")}
            </div>
        </div>
    `;

    setupBookNavigation();
    showBookPage(0);
}

function renderBookPage(evt, index) {
    const images = evt.images || [];
    return `
        <div class="book-page ${index === 0 ? "active" : ""}" data-page="${index}">
            <div class="page-header">
                <div class="page-emoji">${evt.emoji || "📌"}</div>
                <h2 class="page-title">${escapeHtml(evt.title) || "ذكرى"}</h2>
                ${evt.date ? `<p class="page-date"><i class="fa-solid fa-calendar"></i> ${formatDate(evt.date)}</p>` : ""}
            </div>
            ${evt.message ? `<p class="page-message">${escapeHtml(evt.message)}</p>` : ""}
            ${images.length > 0 ? `<div class="page-gallery">${images.map(url => `<img src="${url}" loading="lazy">`).join("")}</div>` : ""}
            ${evt.videoUrl ? `<div class="page-video"><video controls playsinline preload="metadata"><source src="${evt.videoUrl}" type="video/mp4"></video></div>` : ""}
        </div>
    `;
}

function setupBookNavigation() {
    const prevBtn = document.getElementById("bookPrev");
    const nextBtn = document.getElementById("bookNext");
    prevBtn?.addEventListener("click", () => showBookPage(currentBookPage - 1));
    nextBtn?.addEventListener("click", () => showBookPage(currentBookPage + 1));
    document.querySelectorAll(".book-dot").forEach(dot => {
        dot.addEventListener("click", () => showBookPage(parseInt(dot.dataset.page, 10)));
    });
}

function showBookPage(pageNum) {
    if (pageNum < 0 || pageNum >= bookPages.length) return;
    currentBookPage = pageNum;

    document.querySelectorAll(".book-page").forEach(p => p.classList.remove("active"));
    const activePage = document.querySelector(`.book-page[data-page="${pageNum}"]`);
    if (activePage) activePage.classList.add("active");

    const pageNumEl = document.getElementById("currentPageNum");
    if (pageNumEl) pageNumEl.textContent = pageNum + 1;

    document.querySelectorAll(".book-dot").forEach((d, i) => {
        d.classList.toggle("active", i === pageNum);
    });

    const prevBtn = document.getElementById("bookPrev");
    const nextBtn = document.getElementById("bookNext");
    if (prevBtn) prevBtn.disabled = pageNum === 0;
    if (nextBtn) nextBtn.disabled = pageNum === bookPages.length - 1;

    const pageImages = bookPages[pageNum].images || [];
    currentImages = pageImages;
    setupGallery();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// 💼 بطاقة العمل
// ============================================================
async function renderBusinessCard(card, typeInfo) {
    const avatarUrl = await loadEncryptedImage(card.avatar);

    const phones = toArray(card.phones || card.phone);
    const emails = toArray(card.emails || card.email);
    const websites = toArray(card.websites || card.website);
    const addresses = toArray(card.addresses || card.address);

    const socials = card.socials || {};

    dom.viewContainer.innerHTML = `
        <div class="business-card-container">
            <header class="bc-header">
                ${avatarUrl ? `
                    <div class="bc-avatar">
                        <img src="${avatarUrl}" alt="${escapeHtml(card.name || '')}">
                    </div>
                ` : `
                    <div class="bc-avatar-placeholder">
                        <i class="fa-solid fa-user"></i>
                    </div>
                `}
                <h1 class="bc-name">${escapeHtml(card.name) || "بطاقة أعمال"}</h1>
                ${card.jobTitle ? `<p class="bc-title">${escapeHtml(card.jobTitle)}</p>` : ""}
                ${card.company ? `<p class="bc-company"><i class="fa-solid fa-building"></i> ${escapeHtml(card.company)}</p>` : ""}
            </header>

            ${card.bio ? `
                <div class="bc-section">
                    <p class="bc-bio">${escapeHtml(card.bio)}</p>
                </div>
            ` : ""}

            <div class="bc-contact-grid">
                ${phones.map(p => `
                    <a href="tel:${cleanPhone(p)}" class="bc-contact-item">
                        <i class="fa-solid fa-phone"></i>
                        <span>${escapeHtml(p)}</span>
                    </a>
                `).join("")}

                ${emails.map(e => `
                    <a href="mailto:${escapeHtml(e)}" class="bc-contact-item">
                        <i class="fa-solid fa-envelope"></i>
                        <span>${escapeHtml(e)}</span>
                    </a>
                `).join("")}

                ${websites.map(w => `
                    <a href="${cleanWebsite(w)}" target="_blank" rel="noopener noreferrer" class="bc-contact-item">
                        <i class="fa-solid fa-globe"></i>
                        <span>${escapeHtml(displayWebsite(w))}</span>
                    </a>
                `).join("")}

                ${addresses.map(a => `
                    <div class="bc-contact-item">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${escapeHtml(getAddressLabel(a))}</span>
                    </div>
                `).join("")}
            </div>

            ${formatServices(card.services)}

            ${Object.keys(socials).length > 0 ? `
                <div class="bc-socials">
                    ${Object.entries(socials).map(([platform, handle]) => {
                        if (!handle) return "";
                        return `
                            <a href="${formatSocialUrl(platform, handle)}" target="_blank" rel="noopener noreferrer" class="bc-social-btn ${platform}">
                                <i class="fa-brands fa-${platform}"></i>
                            </a>
                        `;
                    }).join("")}
                </div>
            ` : ""}
        </div>
    `;
}

// ============================================================
// 🐾 بطاقة الحيوانات الأليفة
// ============================================================
async function renderPetCard(card, typeInfo) {
    const petPhotoUrl = await loadEncryptedImage(card.photo || card.image);

    dom.viewContainer.innerHTML = `
        <div class="pet-card-container">
            <header class="pet-header">
                ${petPhotoUrl ? `
                    <div class="pet-photo">
                        <img src="${petPhotoUrl}" alt="${escapeHtml(card.petName || '')}">
                    </div>
                ` : `
                    <div class="pet-photo-placeholder">
                        <i class="fa-solid fa-paw"></i>
                    </div>
                `}
                <h1 class="pet-name">${escapeHtml(card.petName) || "أليفي"}</h1>
                ${card.breed ? `<p class="pet-breed">${escapeHtml(card.breed)}</p>` : ""}
            </header>

            <div class="pet-info-grid">
                ${card.gender ? `<div class="pet-info-item"><strong>الجنس:</strong> ${escapeHtml(card.gender)}</div>` : ""}
                ${card.age ? `<div class="pet-info-item"><strong>العمر:</strong> ${escapeHtml(card.age)}</div>` : ""}
                ${card.microchip ? `<div class="pet-info-item"><strong>الميكروشيب:</strong> ${escapeHtml(card.microchip)}</div>` : ""}
            </div>

            ${card.notes ? `
                <div class="pet-notes">
                    <h3><i class="fa-solid fa-clipboard-list"></i> ملاحظات</h3>
                    <p>${escapeHtml(card.notes)}</p>
                </div>
            ` : ""}

            ${card.ownerPhone ? `
                <div class="pet-owner-contact">
                    <a href="tel:${cleanPhone(card.ownerPhone)}" class="btn-call-owner">
                        <i class="fa-solid fa-phone"></i> الاتصال بالمالك (${escapeHtml(card.ownerPhone)})
                    </a>
                </div>
            ` : ""}
        </div>
    `;
}

// ============================================================
// ✅ نقطة الدخول الموحّدة
// ============================================================
export async function render(card, cardId, key) {
    state.currentCard = card;
    if (key) state.currentEncryptionKey = key;

    hideLoading();

    const typeInfo = CARD_TYPES[card.type] || CARD_TYPES.gift;
    document.documentElement.style.setProperty("--accent", typeInfo.color);

    if (card.bgMusicUrl) startMusic(card.bgMusicUrl);
    if (typeInfo.effect) startEffect(typeInfo.effect, typeInfo.color);

    if (card.type === "memory_book") {
        await renderMemoryBook(card, typeInfo);
    } else if (card.type === "business_card") {
        await renderBusinessCard(card, typeInfo);
    } else if (card.type === "pet_card") {
        await renderPetCard(card, typeInfo);
    } else {
        await renderGiftCard(card, typeInfo);
    }

    document.title = card.title || "ذِكـرى";
}
