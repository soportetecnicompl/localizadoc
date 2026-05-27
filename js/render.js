import { COUNTRIES, getDocIcon, DAYS_UNTIL_STALE } from './constants.js';
import { timeAgo, obfuscateDocNumber, getCountryNameFromPhone, isStaleReport } from './utils.js';

export const renderSkeletons = () => {
    const shimmer = `<div style="background:linear-gradient(90deg,#1a1a1a 25%,#2a2a2a 50%,#1a1a1a 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;border-radius:6px;height:14px;margin-bottom:8px;"></div>`;
    if (!document.getElementById('skeleton-style')) {
        const s = document.createElement('style');
        s.id = 'skeleton-style';
        s.textContent = '@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}';
        document.head.appendChild(s);
    }
    ['stats-lost','stats-found','stats-recovered','stats-users'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div style="width:40px;height:28px;background:#2a2a2a;border-radius:4px;animation:shimmer 1.4s infinite;margin:0 auto;"></div>';
    });
    ['public-lost-list','public-found-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = [1,2,3].map(() => `<div class="glass-container p-3">${shimmer}${shimmer}</div>`).join('');
    });
};

export const renderStats = (docs) => {
    document.getElementById('stats-lost').textContent = docs.filter(r => r.status === 'lost' || r.status === 'match').length;
    document.getElementById('stats-found').textContent = docs.filter(r => r.status === 'found').length;
    document.getElementById('stats-recovered').textContent = docs.filter(r => r.status === 'recovered').length;
    const phones = new Set();
    docs.forEach(d => { if (d.owner_id) phones.add(d.owner_id); if (d.finder_contact) phones.add(d.finder_contact); });
    document.getElementById('stats-users').textContent = phones.size;
};

const emptyState = (emoji, title, subtitle) => `
    <div class="text-center py-8">
        <div class="text-4xl mb-2">${emoji}</div>
        <p class="text-gray-300 font-semibold">${title}</p>
        <p class="text-gray-500 text-sm mt-1">${subtitle}</p>
    </div>`;

export const renderPublicLists = (docs, filter = '') => {
    const cleanedFilter = filter.replace(/[-\s]/g, '').toLowerCase();
    const lostDocs = docs.filter(r => r.status === 'lost');
    const foundDocs = docs.filter(r => r.status === 'found');

    const renderList = (listId, items, isLostList) => {
        const listEl = document.getElementById(listId);
        if (!listEl) return;
        const lowerFilter = filter.toLowerCase();
        const filtered = items.filter(r => !filter || [r.doc_type, r.country, COUNTRIES[r.country]?.name, r.owner_name]
            .some(v => v?.toLowerCase().includes(lowerFilter)) ||
            r.doc_number?.replace(/[-\s]/g,'').includes(cleanedFilter));

        if (filtered.length === 0) {
            listEl.innerHTML = filter
                ? emptyState('🔍', 'Sin resultados', `No hay documentos que coincidan con "${filter}"`)
                : isLostList
                    ? emptyState('✅', 'Sin reportes activos', '¡Buenas noticias! No hay pérdidas registradas.')
                    : emptyState('📭', 'Sin hallazgos', 'Nadie ha reportado documentos encontrados aún.');
            return;
        }
        listEl.innerHTML = '';
        filtered.forEach(r => {
            const icon = getDocIcon(r.doc_type);
            const flag = COUNTRIES[r.country]?.flag || '🌎';
            const stale = isStaleReport(r.created_at, DAYS_UNTIL_STALE);
            const waText = encodeURIComponent(`Encontré este documento en LocalizaDoc: ${r.doc_type} en ${COUNTRIES[r.country]?.name || r.country} — https://localizadoc.com`);
            const btn = isLostList
                ? `<button data-action="found-it" data-country="${r.country}" data-doctype="${r.doc_type}" data-docnumber="${r.doc_number}" class="btn-primary text-sm py-2 px-3 rounded-lg whitespace-nowrap">Yo lo encontré</button>`
                : `<button data-action="claim-it" data-country="${r.country}" data-doctype="${r.doc_type}" data-docnumber="${r.doc_number}" style="background-color:var(--brand-lime-green);" class="hover:opacity-90 text-white text-sm font-bold py-2 px-3 rounded-lg whitespace-nowrap">¡Es mío!</button>`;
            const el = document.createElement('div');
            el.className = 'glass-container p-3 flex justify-between items-center gap-2';
            el.innerHTML = `
                <div class="flex gap-3 items-start min-w-0">
                    <div class="text-2xl flex-shrink-0 mt-1">${icon}</div>
                    <div class="min-w-0">
                        <p class="font-bold text-sm truncate">${r.doc_type}</p>
                        <p class="text-gray-400 text-xs">${flag} ${COUNTRIES[r.country]?.name || r.country} · <span class="font-mono">${obfuscateDocNumber(r.doc_number)}</span></p>
                        ${r.has_reward ? `<p class="text-xs font-bold text-[var(--brand-glow-green)]">💰 ${r.reward_amount ? `Recompensa: ${r.reward_amount}` : 'Ofrece Recompensa'}</p>` : ''}
                        ${stale ? `<p class="text-xs text-yellow-600 mt-1">⚠️ Reporte de hace más de 6 meses</p>` : `<p class="text-gray-500 text-xs mt-1">${timeAgo(r.created_at)}</p>`}
                    </div>
                </div>
                <div class="flex flex-col gap-1 flex-shrink-0 items-end">
                    ${btn}
                    <a href="https://wa.me/?text=${waText}" target="_blank" class="text-green-400 hover:text-green-300 text-xs flex items-center gap-1"><i class="fab fa-whatsapp"></i> Compartir</a>
                </div>`;
            listEl.appendChild(el);
        });
    };
    renderList('public-lost-list', lostDocs, true);
    renderList('public-found-list', foundDocs, false);
};

export const renderHonestyWall = (entries) => {
    const list = document.getElementById('honesty-list');
    const countEl = document.getElementById('honesty-count');
    if (!list || !countEl) return;
    countEl.textContent = entries.length;
    list.innerHTML = entries.length === 0 ? emptyState('💝', 'Aún no hay agradecimientos', 'Cuando alguien recupere su documento, aparecerá aquí.') : '';
    entries.forEach(entry => {
        const countryName = getCountryNameFromPhone(entry.finder_contact);
        const el = document.createElement('div');
        el.className = 'glass-container p-4 border-l-4 border-cyan-400';
        el.innerHTML = `<p class="italic text-gray-200">"${entry.owner_message || ''}"</p><p class="text-right text-sm font-bold mt-2 text-cyan-300">— Agradecimiento a ${entry.finder_name}${countryName ? ` (${countryName})` : ''}</p>`;
        list.appendChild(el);
    });
};

export const renderSponsors = (sponsors) => {
    const logoTrack = document.querySelector('.logo-track');
    if (!logoTrack) return;
    logoTrack.innerHTML = '';
    if (sponsors.length === 0) { logoTrack.innerHTML = '<p class="text-gray-400 text-center w-full">Colaboradores aparecerán aquí.</p>'; return; }
    [...sponsors, ...sponsors].forEach(sponsor => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.innerHTML = `<img src="${sponsor.logo_url}" alt="${sponsor.name}" title="${sponsor.name}" onerror="this.onerror=null;this.src='https://placehold.co/150x80/1a1a1a/ffffff?text=Error';">`;
        slide.onclick = () => window.showSponsorInfo(sponsor);
        logoTrack.appendChild(slide);
    });
    const old = document.getElementById('dynamic-slider-style');
    if (old) old.remove();
    const s = document.createElement('style');
    s.id = 'dynamic-slider-style';
    s.textContent = `.logo-track{display:flex;width:calc(200px * ${sponsors.length * 2});animation:scroll ${sponsors.length * 5}s linear infinite}@keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(calc(-200px * ${sponsors.length}))}}`;
    document.head.appendChild(s);
};

export const renderMyReportsList = (myDocs, ownerId, thankedReportIds, notifiedMatches, viewingFinderInfo) => {
    const list = document.getElementById('reports-list');
    if (!list || !ownerId) return;
    const seen = new Set();
    const unique = myDocs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    list.innerHTML = unique.length === 0 ? emptyState('📋', 'Sin reportes', 'Aún no has reportado ningún documento.') : '';

    unique.forEach(report => {
        const reportId = report.id;
        const isOwner = report.owner_id === ownerId;
        const isFinder = report.finder_contact === ownerId;
        let statusHTML = '', actionsHTML = '';

        if (isOwner && (!isFinder || report.status === 'lost')) {
            switch (report.status) {
                case 'lost':
                    statusHTML = `<p class="text-sm text-red-400 font-semibold">Perdido</p>`;
                    actionsHTML = `<button data-action="delete-report" data-id="${reportId}" class="text-red-500 hover:text-red-400 font-semibold text-sm">Eliminar</button>`;
                    break;
                case 'match': {
                    if (!notifiedMatches.has(reportId)) {
                        if ('Notification' in window && Notification.permission === 'granted')
                            new Notification('¡Coincidencia!', { body: `Alguien encontró tu ${report.doc_type}.` });
                        notifiedMatches.add(reportId);
                    }
                    const viewCount = report.finder_views?.[ownerId] || 0;
                    let finderInfo = '';
                    if (viewCount >= 2) {
                        finderInfo = `<p class="text-xs text-yellow-400 mt-1">Límite de vistas excedido. <a href="mailto:soporte@localizadoc.com" class="underline">Contacta soporte</a>.</p>`;
                    } else if (viewCount > 0) {
                        finderInfo = report.hide_finder
                            ? `<p class="text-xs text-cyan-300 mt-1">El samaritano es anónimo.</p>`
                            : `<a href="https://wa.me/${report.finder_contact}?text=${encodeURIComponent(`Hola ${report.finder_name}, te escribo desde LocalizaDoc sobre mi ${report.doc_type}. ¡Gracias!`)}" target="_blank" class="inline-block mt-1 bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-lg"><i class="fab fa-whatsapp mr-1"></i>${report.finder_contact}</a>`;
                    } else {
                        finderInfo = `<button data-action="view-finder-info" data-id="${reportId}" class="mt-1 bg-cyan-600 text-white text-xs font-bold py-1 px-3 rounded-lg">Ver contacto del Samaritano</button>`;
                    }
                    statusHTML = `<p class="text-sm text-yellow-400 font-semibold">¡Coincidencia!</p><p class="text-xs text-gray-300">Encontrado por: <strong>${report.finder_name || 'Samaritano'}</strong></p>${report.location ? `<p class="text-xs text-gray-400">📍 ${report.location}</p>` : ''}${finderInfo}`;
                    actionsHTML = `<button data-action="mark-as-recovered" data-id="${reportId}" class="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1 px-3 rounded-lg">Ya lo recuperé</button>`;
                    break;
                }
                case 'recovered':
                    statusHTML = `<p class="text-sm text-gray-400 font-semibold">✅ Recuperado</p>`;
                    if (report.finder_name && !thankedReportIds.has(reportId))
                        actionsHTML = `<button data-action="open-honesty-modal" data-id="${reportId}" data-finder-name="${report.finder_name}" data-finder-contact="${report.finder_contact||''}" class="bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold py-1 px-3 rounded-lg">Agradecer</button>`;
                    else if (thankedReportIds.has(reportId))
                        actionsHTML = `<p class="text-xs text-cyan-400 font-semibold">¡Agradecido! 💝</p>`;
                    break;
            }
        } else if (isFinder) {
            switch (report.status) {
                case 'found':
                    statusHTML = `<p class="text-sm text-green-400 font-semibold">Tú lo encontraste</p><p class="text-xs text-gray-400">Esperando reporte del dueño.</p>`;
                    actionsHTML = `<div class="flex flex-col items-end gap-1"><button data-action="edit-found-report" data-id="${reportId}" class="text-yellow-400 text-xs font-semibold">Editar</button><button data-action="delete-report" data-id="${reportId}" class="text-red-500 text-xs font-semibold">Eliminar</button></div>`;
                    break;
                case 'match': {
                    const waMsg = encodeURIComponent(`Hola ${report.owner_name}, te escribo desde LocalizaDoc. ¡Encontré tu ${report.doc_type}!`);
                    statusHTML = `<p class="text-sm text-cyan-400 font-semibold">¡Hiciste una Coincidencia!</p><p class="text-xs text-gray-300">Dueño: <strong>${report.owner_name}</strong></p><a href="https://wa.me/${report.contact_phone}?text=${waMsg}" target="_blank" class="inline-block mt-1 bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-lg"><i class="fab fa-whatsapp mr-1"></i>${report.contact_phone}</a>${report.secondary_phone ? `<a href="https://wa.me/${report.secondary_phone}?text=${waMsg}" target="_blank" class="inline-block mt-1 ml-1 bg-green-700 text-white text-xs font-bold py-1 px-2 rounded-lg">Alt: ${report.secondary_phone}</a>` : ''}`;
                    break;
                }
                case 'recovered':
                    statusHTML = `<p class="text-sm text-gray-400 font-semibold">Devuelto ✅</p><p class="text-xs text-gray-400">¡Gracias por tu ayuda!</p>`;
                    break;
            }
        }
        if (!statusHTML) return;
        const el = document.createElement('div');
        el.className = 'glass-container p-4 flex justify-between items-start gap-2';
        el.innerHTML = `<div class="flex-grow"><p class="font-bold text-sm">${getDocIcon(report.doc_type)} ${report.doc_type} — <span class="font-mono">${report.doc_number}</span></p>${statusHTML}${report.has_reward && isOwner ? `<p class="text-xs font-bold text-[var(--brand-glow-green)] mt-1">💰 ${report.reward_amount || 'Ofrece Recompensa'}</p>` : ''}</div><div class="text-right flex-shrink-0">${actionsHTML}</div>`;
        list.appendChild(el);
    });
};
