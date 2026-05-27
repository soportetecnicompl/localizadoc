import { supabase } from './supabase-config.js';

// --- CONSTANTES ---
const COUNTRIES = {
    'HN': { name: 'Honduras', prefix: '504', docTypes: ['Tarjeta de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Carnet Residencia', 'Otro'] },
    'SV': { name: 'El Salvador', prefix: '503', docTypes: ['DUI', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'GT': { name: 'Guatemala', prefix: '502', docTypes: ['DPI', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'NI': { name: 'Nicaragua', prefix: '505', docTypes: ['Cédula de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'CR': { name: 'Costa Rica', prefix: '506', docTypes: ['Cédula de Identidad', 'Licencia de Conducir', 'Pasaporte', 'Otro'] },
    'Otro': { name: 'Otro', prefix: '', docTypes: ['ID Nacional', 'Cédula de Ciudadanía', 'Licencia de Conducir', 'Pasaporte', 'Visa', 'Otro'] }
};

// --- ESTADO ---
let currentOwnerId = null;
let allDocuments = [];
let myDocuments = [];
let thankedReportIds = new Set();
let notifiedMatches = new Set();
let viewingFinderInfo = new Set(); // evita doble clic en "Ver contacto"

// --- UTILIDADES ---
const openModal = (id) => { const m = document.getElementById(id); if (m) m.style.display = 'flex'; };
const closeModal = (el) => {
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.style.display = 'none';
};
const copyToClipboard = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
    });
};
const showNotification = (title, messageHTML) => {
    const el = document.getElementById('notificationTitle');
    if (el) el.textContent = title;
    const msgEl = document.getElementById('notificationMessage');
    if (msgEl) msgEl.innerHTML = messageHTML;
    openModal('notificationModal');
};
const showConfirmation = (message, onConfirm) => {
    const confirmMsg = document.getElementById('confirmationMessage');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');
    if (!confirmMsg || !confirmOk || !confirmCancel) return;
    confirmMsg.innerHTML = message;
    confirmOk.addEventListener('click', () => { onConfirm(); closeModal('confirmationModal'); }, { once: true });
    confirmCancel.addEventListener('click', () => closeModal('confirmationModal'), { once: true });
    openModal('confirmationModal');
};
const toggleButtonLoading = (formOrBtn, isLoading) => {
    const btn = formOrBtn.tagName === 'BUTTON' ? formOrBtn : formOrBtn.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.querySelector('.button-text')?.classList.toggle('hidden', isLoading);
    btn.querySelector('.button-loader')?.classList.toggle('hidden', !isLoading);
};
const getCountryNameFromPhone = (phone) => {
    if (!phone) return '';
    for (const code in COUNTRIES) {
        if (COUNTRIES[code].prefix && phone.startsWith(COUNTRIES[code].prefix)) return COUNTRIES[code].name;
    }
    return '';
};
const populateCountries = (selectId, defaultCountry) => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    Object.keys(COUNTRIES).forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = COUNTRIES[code].name;
        select.appendChild(opt);
    });
    select.value = defaultCountry;
};
const populateDocTypes = (selectEl, country) => {
    if (!selectEl || !COUNTRIES[country]) return;
    selectEl.innerHTML = '';
    (COUNTRIES[country].docTypes || []).forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        selectEl.appendChild(opt);
    });
};
const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
    return new Date(dateStr).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const obfuscateDocNumber = (num) => {
    if (!num) return '';
    return num.length > 7
        ? `${num.substring(0, 4)}...${num.substring(num.length - 3)}`
        : `${num.substring(0, 2)}...`;
};

window.onCaptchaSuccess = () => { const btn = document.getElementById('loginButton'); if (btn) btn.disabled = false; };
window.onCaptchaExpired = () => { const btn = document.getElementById('loginButton'); if (btn) btn.disabled = true; };

// BUG FIX: showSponsorInfo estaba indefinida, causaba TypeError al clicar logos
window.showSponsorInfo = (sponsor) => {
    const details = [
        sponsor.phone ? `<p><i class="fas fa-phone mr-2 text-gray-400"></i>${sponsor.phone}</p>` : '',
        sponsor.email ? `<p><i class="fas fa-envelope mr-2 text-gray-400"></i>${sponsor.email}</p>` : '',
        sponsor.address ? `<p><i class="fas fa-map-marker-alt mr-2 text-gray-400"></i>${sponsor.address}</p>` : '',
    ].filter(Boolean).join('');
    showNotification(sponsor.name, details || '<p>Empresa colaboradora de LocalizaDoc.</p>');
};

// --- FETCH DE DATOS ---
async function fetchAllDocuments() {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching documents:', error); return; }
    allDocuments = data || [];
    renderPublicLists();
    renderStats();
}

async function fetchMyDocuments() {
    if (!currentOwnerId) return;
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .or(`owner_id.eq.${currentOwnerId},finder_contact.eq.${currentOwnerId}`)
        .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching my documents:', error); return; }
    myDocuments = data || [];
    renderMyReportsList();
}

async function fetchHonestyWall() {
    const { data, error } = await supabase
        .from('honesty_submissions')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching honesty wall:', error); return; }
    renderHonestyWall(data || []);
}

async function fetchSponsors() {
    const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching sponsors:', error); return; }
    renderSponsors(data || []);
}

async function fetchThankedReports() {
    if (!currentOwnerId) return;
    const { data, error } = await supabase
        .from('honesty_submissions')
        .select('report_id')
        .eq('owner_id', currentOwnerId);
    if (error) { console.error('Error fetching thanked reports:', error); return; }
    thankedReportIds = new Set((data || []).map(d => d.report_id));
    renderMyReportsList();
}

// --- RENDER ---
function renderStats() {
    const lost = allDocuments.filter(r => r.status === 'lost' || r.status === 'match').length;
    const found = allDocuments.filter(r => r.status === 'found').length;
    const recovered = allDocuments.filter(r => r.status === 'recovered').length;
    const phones = new Set();
    allDocuments.forEach(d => {
        if (d.owner_id) phones.add(d.owner_id);
        if (d.finder_contact) phones.add(d.finder_contact);
    });
    document.getElementById('stats-lost').textContent = lost;
    document.getElementById('stats-found').textContent = found;
    document.getElementById('stats-recovered').textContent = recovered;
    document.getElementById('stats-users').textContent = phones.size;
}

function renderPublicLists() {
    const searchInput = document.getElementById('searchInput');
    const filter = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const cleanedFilter = filter.replace(/[-\s]/g, '');

    // BUG FIX: 'match' ya tiene finder asignado, no debe aparecer en lista pública como disponible
    const lostDocs = allDocuments.filter(r => r.status === 'lost');
    const foundDocs = allDocuments.filter(r => r.status === 'found');

    const renderList = (listId, docs, isLostList) => {
        const listEl = document.getElementById(listId);
        if (!listEl) return;
        const filtered = docs.filter(r => {
            if (!filter) return true;
            return (
                r.doc_type?.toLowerCase().includes(filter) ||
                r.country?.toLowerCase().includes(filter) ||
                (COUNTRIES[r.country]?.name || '').toLowerCase().includes(filter) ||
                r.doc_number?.replace(/[-\s]/g, '').includes(cleanedFilter) ||
                r.owner_name?.toLowerCase().includes(filter)
            );
        });
        listEl.innerHTML = filtered.length === 0 ? '<p class="text-gray-400">Sin resultados.</p>' : '';
        filtered.forEach(r => {
            const el = document.createElement('div');
            el.className = 'glass-container p-3 flex justify-between items-center gap-2';
            const btn = isLostList
                ? `<button data-action="found-it" data-country="${r.country}" data-doctype="${r.doc_type}" data-docnumber="${r.doc_number}" class="btn-primary text-sm py-2 px-4 rounded-lg">Yo lo encontré</button>`
                : `<button data-action="claim-it" data-country="${r.country}" data-doctype="${r.doc_type}" data-docnumber="${r.doc_number}" style="background-color: var(--brand-lime-green);" class="hover:opacity-90 text-white text-sm font-bold py-2 px-4 rounded-lg">¡Es mío!</button>`;
            el.innerHTML = `
                <div>
                    <p class="font-bold">${r.doc_type} <span class="text-sm font-normal text-gray-400">(${COUNTRIES[r.country]?.name || r.country})</span></p>
                    <p class="font-mono text-sm text-gray-300">${obfuscateDocNumber(r.doc_number)}</p>
                    ${r.has_reward ? `<p class="text-xs font-bold text-[var(--brand-glow-green)]">Ofrece Recompensa</p>` : ''}
                    <p class="text-xs text-gray-500 mt-1">${timeAgo(r.created_at)}</p>
                </div>
                ${btn}
            `;
            listEl.appendChild(el);
        });
    };

    renderList('public-lost-list', lostDocs, true);
    renderList('public-found-list', foundDocs, false);
}

function renderHonestyWall(entries) {
    const list = document.getElementById('honesty-list');
    const countEl = document.getElementById('honesty-count');
    if (!list || !countEl) return;
    countEl.textContent = entries.length;
    list.innerHTML = entries.length === 0 ? '<p class="text-gray-400 text-center">Aún no hay agradecimientos.</p>' : '';
    entries.forEach(entry => {
        const countryName = getCountryNameFromPhone(entry.finder_contact);
        const el = document.createElement('div');
        el.className = 'glass-container p-4 border-l-4 border-cyan-400';
        el.innerHTML = `
            <p class="italic text-gray-200">"${entry.owner_message}"</p>
            <p class="text-right text-sm font-bold mt-2 text-cyan-300">- Agradecimiento a ${entry.finder_name}${countryName ? ` (${countryName})` : ''}</p>
        `;
        list.appendChild(el);
    });
}

function renderSponsors(sponsors) {
    const logoTrack = document.querySelector('.logo-track');
    if (!logoTrack) return;
    logoTrack.innerHTML = '';
    if (sponsors.length === 0) {
        logoTrack.innerHTML = '<p class="text-gray-400 text-center w-full">Colaboradores aparecerán aquí.</p>';
        return;
    }
    [...sponsors, ...sponsors].forEach(sponsor => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.innerHTML = `<img src="${sponsor.logo_url}" alt="${sponsor.name}" title="${sponsor.name}" onerror="this.onerror=null;this.src='https://placehold.co/150x80/1a1a1a/ffffff?text=Error';">`;
        slide.onclick = () => window.showSponsorInfo(sponsor);
        logoTrack.appendChild(slide);
    });
    const oldStyle = document.getElementById('dynamic-slider-style');
    if (oldStyle) oldStyle.remove();
    const newStyle = document.createElement('style');
    newStyle.id = 'dynamic-slider-style';
    newStyle.innerHTML = `.logo-track { display: flex; width: calc(200px * ${sponsors.length * 2}); animation: scroll ${sponsors.length * 5}s linear infinite; } @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(calc(-200px * ${sponsors.length})); } }`;
    document.head.appendChild(newStyle);
}

function renderMyReportsList() {
    const list = document.getElementById('reports-list');
    if (!list || !currentOwnerId) return;

    const seen = new Set();
    const unique = myDocuments.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    list.innerHTML = unique.length === 0 ? '<p class="text-gray-400">No tienes reportes en tu historial.</p>' : '';

    unique.forEach(report => {
        const reportId = report.id;
        const isOwner = report.owner_id === currentOwnerId;
        const isFinder = report.finder_contact === currentOwnerId;
        let statusHTML = '', actionsHTML = '';

        if (isOwner && (!isFinder || report.status === 'lost')) {
            switch (report.status) {
                case 'lost':
                    statusHTML = `<p class="text-sm text-red-400 font-semibold">Perdido</p>`;
                    actionsHTML = `<button data-action="delete-report" data-id="${reportId}" class="text-red-500 hover:text-red-400 font-semibold text-sm">Eliminar</button>`;
                    break;
                case 'match': {
                    if (!notifiedMatches.has(reportId)) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('¡Coincidencia Encontrada!', { body: `Alguien ha encontrado tu ${report.doc_type}.` });
                        }
                        notifiedMatches.add(reportId);
                    }
                    const viewCount = report.finder_views?.[currentOwnerId] || 0;
                    let finderInfo = '';
                    if (viewCount >= 2) {
                        finderInfo = `<p class="text-xs text-yellow-400 mt-1">Límite de vistas excedido. <a href="mailto:soporte@localizadoc.com" class="underline">Contacta a soporte</a>.</p>`;
                    } else if (viewCount > 0) {
                        if (report.hide_finder) {
                            finderInfo = `<p class="text-xs text-cyan-300 mt-1">El samaritano prefirió ser anónimo.</p>`;
                        } else {
                            const waMsg = encodeURIComponent(`Hola ${report.finder_name}, te escribo desde LocalizaDoc sobre mi ${report.doc_type} que encontraste. ¡Muchas gracias!`);
                            finderInfo = `
                                <p class="text-xs text-gray-300 mt-1">Contacto del Samaritano:</p>
                                <a href="https://wa.me/${report.finder_contact}?text=${waMsg}" target="_blank" class="inline-block mt-1 bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-lg hover:bg-green-600">
                                    <i class="fab fa-whatsapp mr-1"></i> ${report.finder_contact}
                                </a>
                            `;
                        }
                    } else {
                        // BUG FIX: protegido contra doble clic con viewingFinderInfo Set
                        finderInfo = `<button data-action="view-finder-info" data-id="${reportId}" class="mt-1 bg-cyan-600 text-white text-xs font-bold py-1 px-3 rounded-lg hover:bg-cyan-700">Ver Información de Contacto</button>`;
                    }
                    statusHTML = `
                        <p class="text-sm text-yellow-400 font-semibold">¡Coincidencia!</p>
                        <p class="text-xs text-gray-300">Encontrado por: <strong>${report.finder_name || 'Samaritano'}</strong></p>
                        ${report.location ? `<p class="text-xs text-gray-300 mt-1">Lugar: <strong>${report.location}</strong></p>` : ''}
                        ${finderInfo}
                    `;
                    actionsHTML = `<button data-action="mark-as-recovered" data-id="${reportId}" class="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1 px-3 rounded-lg">Ya lo recuperé</button>`;
                    break;
                }
                case 'recovered':
                    statusHTML = `<p class="text-sm text-gray-400 font-semibold">Recuperado</p>`;
                    if (report.finder_name && !thankedReportIds.has(reportId)) {
                        actionsHTML = `<button data-action="open-honesty-modal" data-id="${reportId}" data-finder-name="${report.finder_name}" data-finder-contact="${report.finder_contact || ''}" class="bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold py-1 px-3 rounded-lg">Agradecer</button>`;
                    } else if (thankedReportIds.has(reportId)) {
                        actionsHTML = `<p class="text-xs text-cyan-400 font-semibold">¡Agradecido!</p>`;
                    }
                    break;
            }
        } else if (isFinder) {
            switch (report.status) {
                case 'found':
                    statusHTML = `<p class="text-sm text-green-400 font-semibold">Tú lo encontraste</p><p class="text-xs text-gray-400">Esperando reporte del dueño.</p>`;
                    actionsHTML = `
                        <div class="flex flex-col items-end gap-2 mt-2">
                            <button data-action="edit-found-report" data-id="${reportId}" class="text-yellow-400 hover:text-yellow-300 font-semibold text-xs">Editar</button>
                            <button data-action="delete-report" data-id="${reportId}" class="text-red-500 hover:text-red-400 font-semibold text-xs">Eliminar</button>
                        </div>`;
                    break;
                case 'match': {
                    const waMsg = encodeURIComponent(`Hola ${report.owner_name}, te escribo desde LocalizaDoc. ¡Encontré tu ${report.doc_type}!`);
                    // BUG FIX: muestra teléfono secundario si está disponible
                    statusHTML = `
                        <p class="text-sm text-cyan-400 font-semibold">¡Hiciste una Coincidencia!</p>
                        <p class="text-xs text-gray-300">Contacta al dueño: <strong>${report.owner_name}</strong></p>
                        <a href="https://wa.me/${report.contact_phone}?text=${waMsg}" target="_blank" class="inline-block mt-1 bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-lg hover:bg-green-600">
                            <i class="fab fa-whatsapp mr-1"></i> ${report.contact_phone}
                        </a>
                        ${report.secondary_phone ? `
                        <a href="https://wa.me/${report.secondary_phone}?text=${waMsg}" target="_blank" class="inline-block mt-1 ml-2 bg-green-700 text-white text-xs font-bold py-1 px-3 rounded-lg hover:bg-green-800">
                            <i class="fab fa-whatsapp mr-1"></i> Alternativo: ${report.secondary_phone}
                        </a>` : ''}
                    `;
                    break;
                }
                case 'recovered':
                    statusHTML = `<p class="text-sm text-gray-400 font-semibold">Documento Devuelto</p><p class="text-xs text-gray-400">¡Gracias por tu ayuda!</p>`;
                    break;
            }
        }

        if (!statusHTML) return;
        const el = document.createElement('div');
        el.className = 'glass-container p-4 flex justify-between items-start gap-2';
        el.innerHTML = `
            <div class="flex-grow">
                <p class="font-bold">${report.doc_type} - <span class="font-mono">${report.doc_number}</span></p>
                ${statusHTML}
                ${report.has_reward && isOwner ? `<p class="text-xs font-bold text-[var(--brand-glow-green)] mt-1">Ofrece Recompensa</p>` : ''}
            </div>
            <div class="text-right flex-shrink-0">${actionsHTML}</div>
        `;
        list.appendChild(el);
    });
}

// --- ACCIONES ---
const deleteUserReport = (reportId) => {
    showConfirmation('¿Estás seguro de que quieres eliminar este reporte?', async () => {
        const { error } = await supabase.from('documents').delete().eq('id', reportId);
        if (error) showNotification('Error', 'No se pudo eliminar el reporte.');
        else showNotification('Reporte Eliminado', 'Tu reporte ha sido eliminado.');
    });
};

const markAsRecovered = (reportId) => {
    showConfirmation('¿Confirmas que has recuperado tu documento?', async () => {
        // BUG FIX: faltaba updated_at, causaba que filtro de fecha en admin no funcionara
        const { error } = await supabase.from('documents').update({
            status: 'recovered',
            updated_at: new Date().toISOString()
        }).eq('id', reportId);
        if (error) showNotification('Error', 'No se pudo actualizar.');
        else showNotification('¡Felicidades!', 'Nos alegra que lo hayas recuperado.');
    });
};

const openHonestyModal = (reportId, finderName, finderContact) => {
    document.getElementById('honestyReportId').value = reportId;
    document.getElementById('honestyFinderName').value = finderName;
    document.getElementById('honestyFinderContact').value = finderContact;
    openModal('honestyModal');
};

const openLostModal = () => {
    if (!currentOwnerId) { openModal('loginModal'); return; }
    const userCountry = localStorage.getItem('userCountry') || 'HN';
    populateCountries('lostCountrySelect', userCountry);
    populateDocTypes(document.getElementById('lostDocType'), userCountry);
    document.getElementById('lostContactPhone').value = currentOwnerId;
    openModal('lostModal');
};

const openFoundModal = () => {
    if (!currentOwnerId) { openModal('loginModal'); return; }
    const userCountry = localStorage.getItem('userCountry') || 'HN';
    populateCountries('foundCountrySelect', userCountry);
    populateDocTypes(document.getElementById('foundDocType'), userCountry);
    document.getElementById('finderContact').value = currentOwnerId;
    openModal('foundModal');
};

const claimIt = (country, docType, docNumber) => {
    openLostModal();
    setTimeout(() => {
        const sel = document.getElementById('lostCountrySelect');
        if (sel) sel.value = country;
        populateDocTypes(document.getElementById('lostDocType'), country);
        const typeEl = document.getElementById('lostDocType');
        if (typeEl) typeEl.value = docType;
        const numEl = document.getElementById('lostDocNumber');
        if (numEl) numEl.value = docNumber;
    }, 100);
};

const foundIt = (country, docType, docNumber) => {
    openFoundModal();
    setTimeout(() => {
        const sel = document.getElementById('foundCountrySelect');
        if (sel) sel.value = country;
        populateDocTypes(document.getElementById('foundDocType'), country);
        const typeEl = document.getElementById('foundDocType');
        if (typeEl) typeEl.value = docType;
        const numEl = document.getElementById('foundDocNumber');
        if (numEl) numEl.value = docNumber;
    }, 100);
};

// BUG FIX: protección contra doble clic — viewingFinderInfo bloquea llamadas simultáneas
const viewFinderInfo = async (reportId) => {
    if (viewingFinderInfo.has(reportId)) return;
    viewingFinderInfo.add(reportId);
    const report = myDocuments.find(r => r.id === reportId);
    if (!report) { viewingFinderInfo.delete(reportId); return; }
    const currentViews = { ...(report.finder_views || {}), [currentOwnerId]: (report.finder_views?.[currentOwnerId] || 0) + 1 };
    const { error } = await supabase.from('documents').update({ finder_views: currentViews }).eq('id', reportId);
    if (error) {
        showNotification('Error', 'No se pudo mostrar la información. Inténtalo de nuevo.');
        viewingFinderInfo.delete(reportId);
    }
};

const openEditFoundReportModal = (reportId) => {
    const report = myDocuments.find(r => r.id === reportId);
    if (!report) { showNotification('Error', 'No se encontró el reporte para editar.'); return; }
    document.getElementById('editFoundReportId').value = reportId;
    document.getElementById('editFinderName').value = report.finder_name || '';
    document.getElementById('editFoundLocation').value = report.location || '';
    openModal('editFoundReportModal');
};

// --- AUTH ---
function handleLogin(countryCode, phoneNumber, isAutoLogin = false) {
    if ('Notification' in window && Notification.permission !== 'denied') Notification.requestPermission();
    const prefix = COUNTRIES[countryCode]?.prefix || '';
    const fullPhone = `${prefix}${phoneNumber}`;
    localStorage.setItem('userPhone', fullPhone);
    localStorage.setItem('userCountry', countryCode);
    currentOwnerId = fullPhone;

    const userPhoneEl = document.getElementById('userPhone');
    if (userPhoneEl) userPhoneEl.textContent = `+${fullPhone}`;
    if (!isAutoLogin) {
        if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) grecaptcha.reset();
        const loginBtn = document.getElementById('loginButton');
        if (loginBtn) loginBtn.disabled = true;
    }
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('logged-in-content').classList.remove('hidden');
    closeModal('loginModal');

    fetchMyDocuments();
    fetchThankedReports();
    startUserListeners();
}

function handleLogout() {
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userCountry');
    window.location.reload();
}

function startUserListeners() {
    // Canal para documentos del usuario como dueño
    supabase.channel(`user-owner-${currentOwnerId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'documents',
            filter: `owner_id=eq.${currentOwnerId}`
        }, fetchMyDocuments)
        .subscribe();

    // Canal para documentos donde el usuario es finder
    supabase.channel(`user-finder-${currentOwnerId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'documents',
            filter: `finder_contact=eq.${currentOwnerId}`
        }, fetchMyDocuments)
        .subscribe();

    // Canal para ver si le agradecieron
    supabase.channel(`user-honesty-${currentOwnerId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'honesty_submissions',
            filter: `owner_id=eq.${currentOwnerId}`
        }, fetchThankedReports)
        .subscribe();
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Auth anónima con Supabase
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) console.error('Supabase Auth Error:', authError);

        // Carga inicial en paralelo
        await Promise.all([fetchAllDocuments(), fetchHonestyWall(), fetchSponsors()]);

        // Suscripciones globales en tiempo real
        supabase.channel('global-documents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
                fetchAllDocuments();
                if (currentOwnerId) fetchMyDocuments();
            })
            .subscribe();

        supabase.channel('global-honesty')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions' }, fetchHonestyWall)
            .subscribe();

        supabase.channel('global-sponsors')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, fetchSponsors)
            .subscribe();

        // Auto-login
        const savedPhone = localStorage.getItem('userPhone');
        const savedCountry = localStorage.getItem('userCountry');
        if (savedPhone && savedCountry && COUNTRIES[savedCountry]) {
            const prefix = COUNTRIES[savedCountry].prefix || '';
            const phoneWithoutPrefix = prefix && savedPhone.startsWith(prefix)
                ? savedPhone.substring(prefix.length)
                : savedPhone;
            handleLogin(savedCountry, phoneWithoutPrefix, true);
        } else {
            openModal('loginModal');
        }

        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('loginPhone').value.trim();
            const country = document.getElementById('loginCountry').value;
            if (phone && country) handleLogin(country, phone, false);
        });

        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

        // BUG FIX: búsqueda en tiempo real — faltaba este listener completamente
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.addEventListener('input', renderPublicLists);

        // Selects de país/tipo
        const loginCountrySelect = document.getElementById('loginCountry');
        if (loginCountrySelect) {
            populateCountries('loginCountry', 'HN');
            const phonePrefix = document.getElementById('phonePrefix');
            if (phonePrefix) phonePrefix.textContent = `+${COUNTRIES['HN'].prefix}`;
            loginCountrySelect.addEventListener('change', (e) => {
                if (phonePrefix) phonePrefix.textContent = `+${COUNTRIES[e.target.value]?.prefix || ''}`;
            });
        }
        document.getElementById('lostCountrySelect')?.addEventListener('change', (e) => populateDocTypes(document.getElementById('lostDocType'), e.target.value));
        document.getElementById('foundCountrySelect')?.addEventListener('change', (e) => populateDocTypes(document.getElementById('foundDocType'), e.target.value));

        // Formulario: Reportar Pérdida
        document.getElementById('lostForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type=submit]');
            toggleButtonLoading(button, true);
            const docNumber = document.getElementById('lostDocNumber').value.trim().replace(/[-\s]/g, '').toUpperCase();
            const country = document.getElementById('lostCountrySelect').value;
            const docType = document.getElementById('lostDocType').value;
            try {
                const { data: existing } = await supabase.from('documents').select('id').eq('country', country).eq('doc_type', docType).eq('doc_number', docNumber).in('status', ['lost', 'found', 'match']);
                if (existing && existing.length > 0) {
                    showNotification('Reporte Duplicado', 'Este documento ya ha sido reportado.');
                    return;
                }
                const { error } = await supabase.from('documents').insert({
                    country, doc_type: docType, doc_number: docNumber,
                    owner_name: document.getElementById('lostOwnerName').value.trim(),
                    contact_phone: currentOwnerId,
                    secondary_phone: document.getElementById('lostSecondaryPhone').value.trim() || null,
                    has_reward: document.getElementById('hasReward').checked,
                    status: 'lost', owner_id: currentOwnerId
                });
                if (error) throw error;
                showNotification('¡Reporte Exitoso!', 'Tu reporte ha sido creado.');
                closeModal('lostModal');
                e.target.reset();
            } catch (err) {
                console.error('Error al reportar pérdida:', err);
                showNotification('Error', 'No se pudo crear el reporte.');
            } finally { toggleButtonLoading(button, false); }
        });

        // Formulario: Reportar Hallazgo
        document.getElementById('foundForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type=submit]');
            toggleButtonLoading(button, true);
            const docNumber = document.getElementById('foundDocNumber').value.trim().replace(/[-\s]/g, '').toUpperCase();
            const country = document.getElementById('foundCountrySelect').value;
            const docType = document.getElementById('foundDocType').value;
            try {
                const { data: existing } = await supabase.from('documents').select('*').eq('country', country).eq('doc_type', docType).eq('doc_number', docNumber).in('status', ['lost', 'found', 'match']);
                if (existing && existing.length > 0) {
                    const report = existing[0];
                    if (report.status === 'lost') {
                        const { error } = await supabase.from('documents').update({
                            status: 'match',
                            finder_name: document.getElementById('finderName').value.trim(),
                            finder_contact: currentOwnerId,
                            hide_finder: document.getElementById('hideFinderContact').checked,
                            location: document.getElementById('foundLocation').value.trim() || null,
                            updated_at: new Date().toISOString()
                        }).eq('id', report.id);
                        if (error) throw error;
                        showNotification('¡Coincidencia Encontrada!', 'Hemos notificado al dueño.');
                    } else {
                        showNotification('Reporte Duplicado', 'Este documento ya fue encontrado y reportado.');
                    }
                } else {
                    const { error } = await supabase.from('documents').insert({
                        country, doc_type: docType, doc_number: docNumber,
                        owner_name: document.getElementById('foundOwnerName').value.trim(),
                        status: 'found', owner_id: currentOwnerId,
                        finder_name: document.getElementById('finderName').value.trim(),
                        finder_contact: currentOwnerId,
                        hide_finder: document.getElementById('hideFinderContact').checked,
                        location: document.getElementById('foundLocation').value.trim() || null
                    });
                    if (error) throw error;
                    showNotification('¡Hallazgo Registrado!', 'Guardaremos tu reporte.');
                }
                closeModal('foundModal');
                e.target.reset();
            } catch (err) {
                console.error('Error al reportar hallazgo:', err);
                showNotification('Error', 'No se pudo crear el reporte.');
            } finally { toggleButtonLoading(button, false); }
        });

        // Formulario: Agradecimiento
        document.getElementById('honestyForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type=submit]');
            toggleButtonLoading(button, true);
            try {
                const { error } = await supabase.from('honesty_submissions').insert({
                    report_id: document.getElementById('honestyReportId').value,
                    owner_id: currentOwnerId,
                    finder_name: document.getElementById('honestyFinderName').value,
                    finder_contact: document.getElementById('honestyFinderContact').value,
                    owner_message: document.getElementById('honestyMessage').value.trim(),
                    status: 'pending'
                });
                if (error) throw error;
                showNotification('¡Gracias!', 'Tu agradecimiento ha sido enviado para revisión.');
                closeModal('honestyModal');
                e.target.reset();
            } catch (err) {
                console.error('Error al enviar agradecimiento:', err);
                showNotification('Error', 'No se pudo enviar tu agradecimiento.');
            } finally { toggleButtonLoading(button, false); }
        });

        // Formulario: Editar reporte de hallazgo
        document.getElementById('editFoundReportForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type=submit]');
            toggleButtonLoading(button, true);
            const reportId = document.getElementById('editFoundReportId').value;
            try {
                const { error } = await supabase.from('documents').update({
                    finder_name: document.getElementById('editFinderName').value.trim(),
                    location: document.getElementById('editFoundLocation').value.trim() || null,
                    updated_at: new Date().toISOString()
                }).eq('id', reportId);
                if (error) throw error;
                showNotification('Éxito', 'La información ha sido actualizada.');
                closeModal('editFoundReportModal');
            } catch (err) {
                console.error('Error al actualizar reporte:', err);
                showNotification('Error', 'No se pudo actualizar el reporte.');
            } finally { toggleButtonLoading(button, false); }
        });

        // Handler global de clicks por data-action
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const { action, modalId, id, finderName, finderContact, text, country, doctype, docnumber } = target.dataset;
            switch (action) {
                case 'open-modal': openModal(modalId); break;
                case 'close-modal': closeModal(target.closest('.modal-backdrop')); break;
                case 'open-lost-modal': openLostModal(); break;
                case 'open-found-modal': openFoundModal(); break;
                case 'copy': copyToClipboard(text, target); break;
                case 'delete-report': deleteUserReport(id); break;
                case 'mark-as-recovered': markAsRecovered(id); break;
                case 'open-honesty-modal': openHonestyModal(id, finderName, finderContact); break;
                case 'edit-found-report': openEditFoundReportModal(id); break;
                case 'view-finder-info': viewFinderInfo(id); break;
                case 'claim-it': claimIt(country, doctype, docnumber); break;
                case 'found-it': foundIt(country, doctype, docnumber); break;
            }
        });

    } catch (error) {
        console.error('Error crítico:', error);
        document.body.innerHTML = '<div style="color:white;padding:2rem;text-align:center;">Ha ocurrido un error grave al cargar la aplicación.<br>Por favor revisa la consola (F12) para más detalles.</div>';
    }
});
