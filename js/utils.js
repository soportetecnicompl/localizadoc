import { COUNTRIES } from './constants.js';

export const openModal = (id) => { const m = document.getElementById(id); if (m) m.style.display = 'flex'; };
export const closeModal = (el) => {
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.style.display = 'none';
};
export const copyToClipboard = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
    });
};
export const showNotification = (title, messageHTML) => {
    const el = document.getElementById('notificationTitle');
    if (el) el.textContent = title;
    const msgEl = document.getElementById('notificationMessage');
    if (msgEl) msgEl.innerHTML = messageHTML;
    openModal('notificationModal');
};
export const showConfirmation = (message, onConfirm) => {
    const confirmMsg = document.getElementById('confirmationMessage');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');
    if (!confirmMsg || !confirmOk || !confirmCancel) return;
    confirmMsg.innerHTML = message;
    confirmOk.addEventListener('click', () => { onConfirm(); closeModal('confirmationModal'); }, { once: true });
    confirmCancel.addEventListener('click', () => closeModal('confirmationModal'), { once: true });
    openModal('confirmationModal');
};
export const toggleButtonLoading = (formOrBtn, isLoading) => {
    const btn = formOrBtn.tagName === 'BUTTON' ? formOrBtn : formOrBtn.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.querySelector('.button-text')?.classList.toggle('hidden', isLoading);
    btn.querySelector('.button-loader')?.classList.toggle('hidden', !isLoading);
};
export const getCountryNameFromPhone = (phone) => {
    if (!phone) return '';
    for (const code in COUNTRIES) {
        if (COUNTRIES[code].prefix && phone.startsWith(COUNTRIES[code].prefix)) return COUNTRIES[code].name;
    }
    return '';
};
export const populateCountries = (selectId, defaultCountry) => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    Object.keys(COUNTRIES).forEach(code => {
        const opt = document.createElement('option');
        opt.value = code; opt.textContent = COUNTRIES[code].name;
        select.appendChild(opt);
    });
    select.value = defaultCountry;
};
export const populateDocTypes = (selectEl, country) => {
    if (!selectEl || !COUNTRIES[country]) return;
    selectEl.innerHTML = '';
    (COUNTRIES[country].docTypes || []).forEach(type => {
        const opt = document.createElement('option');
        opt.value = type; opt.textContent = type;
        selectEl.appendChild(opt);
    });
};
export const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
    return new Date(dateStr).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
export const obfuscateDocNumber = (num) => {
    if (!num) return '';
    return num.length > 7 ? `${num.substring(0,4)}...${num.substring(num.length-3)}` : `${num.substring(0,2)}...`;
};
export const isStaleReport = (dateStr, days = 180) => {
    if (!dateStr) return false;
    return (Date.now() - new Date(dateStr)) > days * 86400 * 1000;
};
