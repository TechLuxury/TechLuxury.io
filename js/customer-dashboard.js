// import { initializeApp } from ... (احتفظ بالاستيرادات كما هي)

// ============================================================
// 🎴 أنواع الكروت
// ============================================================
const CARD_TYPES = [
    { id: "gift", label: "كرت هدية", icon: "fa-gift", desc: "صور + فيديو + موسيقى + رسالة", protected: true },
    { id: "memory_book", label: "كتاب ذكريات", icon: "fa-book-open", desc: "صفحات متعددة لكل مناسبة", protected: true },
    { id: "business_card", label: "بطاقة عمل", icon: "fa-id-card", desc: "بياناتك المهنية ووسائل التواصل", protected: false },
    { id: "pet_card", label: "بطاقة حيوانات", icon: "fa-paw", desc: "بطاقة لحيوانك الأليف — عامة", protected: false }
];

// ===== الحالة العامة =====
let currentUser = null;
let currentCard = null;
let selectedType = null;
let eventsState = [];

// ===== كرت الهدية =====
let giftNewImages = [];
let giftCurrentImages = [];
let giftImagesToDelete = [];
let giftNewVideo = null;

// ===== بطاقة العمل =====
let bizNewLogo = null;
let bizCurrentLogo = "";
let bizInstagramList = [];
let bizPhoneList = [];
let bizWebsiteList = [];
let bizWhatsappList = [];
let bizFacebookList = [];
let bizLinkedinList = [];

// ===== أخرى =====
let newBgMusicFile = null;
let petNewPhoto = null;
let petCurrentPhoto = "";

// 🔐 المفتاح الحالي
let currentEncryptionKey = null;

// ===== دوال مساعدة =====
function show(el) { if (!el) return; el.classList.remove("hidden"); el.style.display = ""; }
function hide(el) { if (!el) return; el.classList.add("hidden"); el.style.display = ""; }
function generateId() { return "evt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9); }

function toArray(value) {
    if (Array.isArray(value)) return value.filter(v => v && String(v).trim() !== "");
    if (value && typeof value === "string" && value.trim() !== "") return [value];
    return [];
}

function focusLastInput(containerId) {
    const inputs = document.querySelectorAll(`#${containerId} input`);
    if (inputs.length) inputs[inputs.length - 1].focus();
}

// ===== ✅ دالة escapeHtml =====
function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

// ============================================================
// 🆕 دالة عرض القوائم الاجتماعية (Render Social List)
// ============================================================
function renderSocialList(containerId, list, placeholder, iconClass, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    list.forEach((value, index) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;margin-bottom:8px;align-items:center;";
        row.innerHTML = `
            <i class="${iconClass}" style="color:${color};font-size:1.1rem;min-width:24px;text-align:center;"></i>
            <input type="text"
                value="${escapeHtml(value)}"
                placeholder="${placeholder}"
                style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.3);color:#fff;">
            <button type="button"
                style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;border-radius:8px;padding:8px 12px;cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        const input = row.querySelector("input");
        const removeBtn = row.querySelector("button");

        input.addEventListener("input", (e) => { list[index] = e.target.value; });

        removeBtn.addEventListener("click", () => {
            list.splice(index, 1);
            renderSocialList(containerId, list, placeholder, iconClass, color);
        });

        container.appendChild(row);
    });
}

// ============================================================
// 🆕 دوال Render للقوائم الاجتماعية
// ============================================================
function renderInstagramList() {
    renderSocialList("instagramList", bizInstagramList, "@username", "fa-brands fa-instagram", "#e1306c");
}
function renderPhoneList() {
    renderSocialList("phoneList", bizPhoneList, "+962 7XXXXXXXX", "fa-solid fa-phone", "#22c55e");
}
function renderWhatsappList() {
    renderSocialList("whatsappList", bizWhatsappList, "+962 7XXXXXXXX", "fa-brands fa-whatsapp", "#25D366");
}
function renderWebsiteList() {
    renderSocialList("websiteList", bizWebsiteList, "https://example.com", "fa-solid fa-globe", "#3b82f6");
}
function renderFacebookList() {
    renderSocialList("facebookList", bizFacebookList, "facebook.com/page", "fa-brands fa-facebook", "#1877f2");
}
function renderLinkedinList() {
    renderSocialList("linkedinList", bizLinkedinList, "linkedin.com/in/...", "fa-brands fa-linkedin", "#0a66c2");
}

// ============================================================
// 🆕 مستمعات الأزرار الجديدة
// ============================================================
document.getElementById("btnAddWhatsapp")?.addEventListener("click", () => {
    bizWhatsappList.push("");
    renderWhatsappList();
    focusLastInput("whatsappList");
});

document.getElementById("btnAddFacebook")?.addEventListener("click", () => {
    bizFacebookList.push("");
    renderFacebookList();
    focusLastInput("facebookList");
});

document.getElementById("btnAddLinkedin")?.addEventListener("click", () => {
    bizLinkedinList.push("");
    renderLinkedinList();
    focusLastInput("linkedinList");
});

// ============================================================
// 🔄 إعادة تعيين الحالة (مُحدَّثة)
// ============================================================
function resetFormState() {
    // ===== المصفوفات =====
    giftNewImages = [];
    giftCurrentImages = [];
    giftImagesToDelete = [];
    giftNewVideo = null;

    bizNewLogo = null;
    bizCurrentLogo = "";
    bizInstagramList = [];
    bizPhoneList = [];
    bizWebsiteList = [];
    bizWhatsappList = [];
    bizFacebookList = [];
    bizLinkedinList = [];

    newBgMusicFile = null;
    petNewPhoto = null;
    petCurrentPhoto = "";
    eventsState = [];

    // ===== الحقول النصية =====
    const ids = [
        "giftTitle", "giftMessage", "bookTitle",
        "bizName", "bizJobTitle", "bizCompany", "bizBio", "bizServices",
        "bizEmail", "bizAddress", "bizGoogleReview",   // ✅ أُضيف
        "petName", "petType", "petBreed", "petAge", "petWeight",
        "petColor", "petNotes", "petVaccinations",
        "petOwnerName", "petOwnerPhone", "petAddress",
        "securityQuestionInput", "securityAnswerInput", "securityAnswerConfirm"
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // ===== حقول الملفات =====
    const fileIds = ["giftImages", "giftVideo", "bizLogo", "editBgMusic", "petPhoto"];
    fileIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // ===== رسائل الحالة =====
    const statusIds = ["giftImagesStatus", "giftVideoStatus", "bizLogoStatus", "bgMusicStatus", "petPhotoStatus"];
    statusIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
    });

    // ===== حاويات DOM =====
    const giftCurrentImagesEl = document.getElementById("giftCurrentImages");
    if (giftCurrentImagesEl) giftCurrentImagesEl.innerHTML = "";

    const giftImagesCountEl = document.getElementById("giftImagesCount");
    if (giftImagesCountEl) giftImagesCountEl.textContent = "0";

    const bizLogoContainerEl = document.getElementById("bizLogoContainer");
    if (bizLogoContainerEl) bizLogoContainerEl.innerHTML = "";

    const petPhotoContainerEl = document.getElementById("petPhotoContainer");
    if (petPhotoContainerEl) petPhotoContainerEl.innerHTML = "";

    const eventsListEl = document.getElementById("eventsList");
    if (eventsListEl) eventsListEl.innerHTML = "";

    // ✅ تفريغ قوائم بطاقة العمل الجديدة
    ["instagramList", "phoneList", "websiteList", "whatsappList", "facebookList", "linkedinList"]
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
}

// ============================================================
// 📋 عرض الحقول حسب النوع (مُحدَّثة لبطاقة العمل)
// ============================================================
async function showCardFields(card) {
    if (!selectedType) return;

    hide(document.getElementById("stepTypeSelect"));
    show(document.getElementById("stepCardFields"));

    const modalTitle = document.getElementById("modalTitle");
    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid ${selectedType.icon}"></i> ${selectedType.label}`;

    hide(document.getElementById("giftFields"));
    hide(document.getElementById("bookFields"));
    hide(document.getElementById("businessFields"));
    hide(document.getElementById("petFields"));

    const protectionSection = document.getElementById("protectionSection");
    if (selectedType.protected) {
        show(protectionSection);
        if (card.securityQuestion) {
            document.getElementById("securityQuestionInput").value = card.securityQuestion;
        }
    } else {
        hide(protectionSection);
    }

    // ========== كرت هدية ==========
    if (selectedType.id === "gift") {
        show(document.getElementById("giftFields"));
        document.getElementById("giftTitle").value = card.title || "";

        if (card.message && typeof card.message === "object" && card.message.ciphertext) {
            try {
                if (currentEncryptionKey) {
                    const decrypted = await decryptText(card.message.ciphertext, card.message.iv, currentEncryptionKey);
                    document.getElementById("giftMessage").value = decrypted;
                } else {
                    document.getElementById("giftMessage").value = "";
                    document.getElementById("giftMessage").placeholder = "🔒 الرسالة مشفرة";
                }
            } catch (e) {
                document.getElementById("giftMessage").value = "";
                document.getElementById("giftMessage").placeholder = "⚠️ الإجابة خاطئة";
            }
        } else {
            document.getElementById("giftMessage").value = card.message || "";
        }

        giftCurrentImages = card.images || [];
        giftImagesToDelete = [];
        renderGiftImages();

        if (card.video) {
            document.getElementById("giftVideoStatus").textContent = "✅ يوجد فيديو محفوظ";
        }
    }

    // ========== كتاب ذكريات ==========
    if (selectedType.id === "memory_book") {
        show(document.getElementById("bookFields"));
        document.getElementById("bookTitle").value = card.title || "";
        eventsState = JSON.parse(JSON.stringify(card.events || []));

        if (currentEncryptionKey) {
            for (let i = 0; i < eventsState.length; i++) {
                const evt = eventsState[i];
                if (evt.message && typeof evt.message === "object" && evt.message.ciphertext) {
                    try {
                        const decrypted = await decryptText(evt.message.ciphertext, evt.message.iv, currentEncryptionKey);
                        eventsState[i].message = decrypted;
                    } catch (e) { eventsState[i].message = ""; }
                }
            }
        } else {
            for (let i = 0; i < eventsState.length; i++) {
                if (eventsState[i].message && typeof eventsState[i].message === "object") {
                    eventsState[i].message = "";
                }
            }
        }

        if (eventsState.length === 0) eventsState.push(createEmptyEvent());
        renderEvents();
    }

    // ========== بطاقة عمل (✅ محدَّثة بالكامل) ==========
    if (selectedType.id === "business_card") {
        show(document.getElementById("businessFields"));

        // الحقول النصية
        document.getElementById("bizName").value = card.name || "";
        document.getElementById("bizJobTitle").value = card.jobTitle || "";
        document.getElementById("bizCompany").value = card.company || "";
        document.getElementById("bizBio").value = card.bio || "";
        document.getElementById("bizServices").value = card.services || "";
        document.getElementById("bizEmail").value = card.email || "";
        document.getElementById("bizAddress").value = card.address || "";

        // ✅ Google Review
        const bizGoogleReviewEl = document.getElementById("bizGoogleReview");
        if (bizGoogleReviewEl) bizGoogleReviewEl.value = card.googleReview || "";

        // ✅ القوائم الاجتماعية (Instagram / Phone / Website / WhatsApp / Facebook / LinkedIn)
        bizInstagramList = toArray(card.instagram);
        renderInstagramList();

        bizPhoneList = toArray(card.phone);
        renderPhoneList();

        bizWebsiteList = toArray(card.website);
        renderWebsiteList();

        bizWhatsappList = toArray(card.whatsapp);
        renderWhatsappList();

        bizFacebookList = toArray(card.facebook);
        renderFacebookList();

        bizLinkedinList = toArray(card.linkedin);
        renderLinkedinList();

        // الشعار
        bizCurrentLogo = card.logoUrl || "";
        renderBizLogo();
    }

    // ========== بطاقة حيوانات ==========
    if (selectedType.id === "pet_card") {
        show(document.getElementById("petFields"));
        document.getElementById("petName").value = card.petName || "";
        document.getElementById("petType").value = card.petType || "";
        document.getElementById("petBreed").value = card.petBreed || "";
        document.getElementById("petAge").value = card.petAge || "";
        document.getElementById("petWeight").value = card.petWeight || "";
        document.getElementById("petColor").value = card.petColor || "";
        document.getElementById("petNotes").value = card.petNotes || "";
        document.getElementById("petVaccinations").value = card.petVaccinations || "";
        document.getElementById("petOwnerName").value = card.petOwnerName || "";
        document.getElementById("petOwnerPhone").value = card.petOwnerPhone || "";
        document.getElementById("petAddress").value = card.petAddress || "";

        petCurrentPhoto = card.petPhoto || "";
        renderPetPhoto();
    }

    if (card.bgMusicUrl) {
        document.getElementById("bgMusicStatus").textContent = "✅ توجد موسيقى محفوظة";
    }
}

// ============================================================
// 💾 حفظ الكرت — قسم بطاقة العمل (✅ محدَّث بالكامل)
// ============================================================
// ضعه داخل مستمع editCardForm عند submit

if (selectedType.id === "business_card") {
    updatePayload.name = document.getElementById("bizName").value.trim();
    updatePayload.jobTitle = document.getElementById("bizJobTitle").value.trim();
    updatePayload.company = document.getElementById("bizCompany").value.trim();
    updatePayload.bio = document.getElementById("bizBio").value.trim();
    updatePayload.services = document.getElementById("bizServices").value.trim();
    updatePayload.email = document.getElementById("bizEmail").value.trim();
    updatePayload.address = document.getElementById("bizAddress").value.trim();

    // ✅ Google Review
    const bizGoogleReviewEl = document.getElementById("bizGoogleReview");
    updatePayload.googleReview = bizGoogleReviewEl ? bizGoogleReviewEl.value.trim() : "";

    // ✅ حفظ كل القوائم الاجتماعية كمصفوفات
    updatePayload.instagram = bizInstagramList.map(v => v.trim()).filter(v => v !== "");
    updatePayload.phone     = bizPhoneList.map(v => v.trim()).filter(v => v !== "");
    updatePayload.website   = bizWebsiteList.map(v => v.trim()).filter(v => v !== "");
    updatePayload.whatsapp  = bizWhatsappList.map(v => v.trim()).filter(v => v !== "");
    updatePayload.facebook  = bizFacebookList.map(v => v.trim()).filter(v => v !== "");
    updatePayload.linkedin  = bizLinkedinList.map(v => v.trim()).filter(v => v !== "");

    updatePayload.title = updatePayload.name || updatePayload.company || "بطاقة عمل";

    let logoUrl = oldData.logoUrl || "";
    if (bizNewLogo) {
        btnSave.innerHTML = "📤 رفع الشعار...";
        const compressed = await compressImage(bizNewLogo);
        logoUrl = await uploadToCloudinary(compressed, "image", (p) => {
            btnSave.innerHTML = `🖼️ رفع الشعار — ${p}%`;
        });
    }
    updatePayload.logoUrl = logoUrl;
    updatePayload.logo = "";
}
