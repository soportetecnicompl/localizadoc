import { state } from './state.js';
import { showNotification, showConfirmation, toggleButtonLoading, populateCountries, populateDocTypes, closeModal, openModal } from './utils.js';
import { checkDuplicate, insertLostReport, insertFoundReport, updateMatch, deleteReport, markAsRecovered as apiMarkAsRecovered, incrementFinderView, submitHonestyMessage, updateFoundReport } from './api.js';
import { loadUserData } from './auth.js';
import { renderMyReportsList } from './render.js';

export const setupFormHandlers = () => {
    setupLostForm();
    setupFoundForm();
    setupHonestyForm();
    setupEditFoundReportForm();
};

const setupLostForm = () => {
    document.getElementById('lostForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        const docNumber = document.getElementById('lostDocNumber').value.trim().replace(/[-\s]/g,'').toUpperCase();
        const country = document.getElementById('lostCountrySelect').value;
        const docType = document.getElementById('lostDocType').value;
        try {
            const existing = await checkDuplicate(country, docType, docNumber);
            if (existing.length > 0) { showNotification('Reporte Duplicado', 'Este documento ya ha sido reportado.'); return; }
            const hasReward = document.getElementById('hasReward').checked;
            const error = await insertLostReport({
                country, doc_type: docType, doc_number: docNumber,
                owner_name: document.getElementById('lostOwnerName').value.trim(),
                contact_phone: state.currentOwnerId,
                secondary_phone: document.getElementById('lostSecondaryPhone').value.trim() || null,
                has_reward: hasReward,
                reward_amount: hasReward ? (document.getElementById('rewardAmount')?.value.trim() || null) : null,
                status: 'lost', owner_id: state.currentOwnerId, owner_uid: state.currentUserUid
            });
            if (error) throw error;
            showNotification('¡Reporte Exitoso!', 'Tu reporte ha sido creado.');
            closeModal('lostModal'); e.target.reset();
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo crear el reporte.');
        } finally { toggleButtonLoading(button, false); }
    });

    document.getElementById('hasReward')?.addEventListener('change', (e) => {
        const rewardField = document.getElementById('rewardAmountField');
        if (rewardField) rewardField.classList.toggle('hidden', !e.target.checked);
    });
};

const setupFoundForm = () => {
    document.getElementById('foundForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        const docNumber = document.getElementById('foundDocNumber').value.trim().replace(/[-\s]/g,'').toUpperCase();
        const country = document.getElementById('foundCountrySelect').value;
        const docType = document.getElementById('foundDocType').value;
        try {
            const existing = await checkDuplicate(country, docType, docNumber);
            const finderPayload = {
                finder_name: document.getElementById('finderName').value.trim(),
                finder_contact: state.currentOwnerId,
                finder_uid: state.currentUserUid,
                hide_finder: document.getElementById('hideFinderContact').checked,
                location: document.getElementById('foundLocation').value.trim() || null,
            };
            if (existing.length > 0 && existing[0].status === 'lost') {
                const error = await updateMatch(existing[0].id, { status: 'match', ...finderPayload });
                if (error) throw error;
                showNotification('¡Coincidencia Encontrada!', 'Hemos notificado al dueño.');
            } else if (existing.length > 0) {
                showNotification('Reporte Duplicado', 'Este documento ya fue encontrado y reportado.');
            } else {
                const error = await insertFoundReport({
                    country, doc_type: docType, doc_number: docNumber,
                    owner_name: document.getElementById('foundOwnerName').value.trim(),
                    status: 'found', owner_id: state.currentOwnerId, owner_uid: state.currentUserUid,
                    ...finderPayload
                });
                if (error) throw error;
                showNotification('¡Hallazgo Registrado!', 'Guardaremos tu reporte.');
            }
            closeModal('foundModal'); e.target.reset();
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo crear el reporte.');
        } finally { toggleButtonLoading(button, false); }
    });
};

const setupHonestyForm = () => {
    document.getElementById('honestyForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        try {
            const error = await submitHonestyMessage({
                report_id: document.getElementById('honestyReportId').value,
                owner_id: state.currentOwnerId,
                finder_name: document.getElementById('honestyFinderName').value,
                finder_contact: document.getElementById('honestyFinderContact').value,
                owner_message: document.getElementById('honestyMessage').value.trim(),
                status: 'pending'
            });
            if (error) throw error;
            showNotification('¡Gracias!', 'Tu agradecimiento fue enviado para revisión.');
            closeModal('honestyModal'); e.target.reset();
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo enviar tu agradecimiento.');
        } finally { toggleButtonLoading(button, false); }
    });
};

const setupEditFoundReportForm = () => {
    document.getElementById('editFoundReportForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type=submit]');
        toggleButtonLoading(button, true);
        const reportId = document.getElementById('editFoundReportId').value;
        try {
            const error = await updateFoundReport(
                reportId,
                document.getElementById('editFinderName').value.trim(),
                document.getElementById('editFoundLocation').value.trim()
            );
            if (error) throw error;
            showNotification('Éxito', 'Reporte actualizado.');
            closeModal('editFoundReportModal');
        } catch (err) {
            console.error(err); showNotification('Error', 'No se pudo actualizar.');
        } finally { toggleButtonLoading(button, false); }
    });
};

export const handleClickActions = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const { action, modalId, id, finderName, finderContact, text, country, doctype, docnumber } = target.dataset;

    const openLostModal = () => {
        if (!state.currentOwnerId) { openModal('loginModal'); return; }
        const userCountry = localStorage.getItem('userCountry') || 'HN';
        populateCountries('lostCountrySelect', userCountry);
        populateDocTypes(document.getElementById('lostDocType'), userCountry);
        document.getElementById('lostContactPhone').value = state.currentOwnerId;
        openModal('lostModal');
    };
    const openFoundModal = () => {
        if (!state.currentOwnerId) { openModal('loginModal'); return; }
        const userCountry = localStorage.getItem('userCountry') || 'HN';
        populateCountries('foundCountrySelect', userCountry);
        populateDocTypes(document.getElementById('foundDocType'), userCountry);
        document.getElementById('finderContact').value = state.currentOwnerId;
        openModal('foundModal');
    };

    switch (action) {
        case 'open-modal': openModal(modalId); break;
        case 'close-modal': closeModal(target.closest('.modal-backdrop')); break;
        case 'open-lost-modal': openLostModal(); break;
        case 'open-found-modal': openFoundModal(); break;
        case 'copy': import('./utils.js').then(({ copyToClipboard }) => copyToClipboard(text, target)); break;
        case 'delete-report':
            showConfirmation('¿Eliminar este reporte?', async () => {
                const error = await deleteReport(id);
                if (error) showNotification('Error', 'No se pudo eliminar.'); else showNotification('Eliminado', 'Reporte eliminado.');
            }); break;
        case 'mark-as-recovered':
            showConfirmation('¿Confirmas que recuperaste tu documento?', async () => {
                const error = await apiMarkAsRecovered(id);
                if (error) showNotification('Error', 'No se pudo actualizar.'); else showNotification('¡Felicidades!', 'Nos alegra que lo recuperaras.');
            }); break;
        case 'open-honesty-modal':
            document.getElementById('honestyReportId').value = id;
            document.getElementById('honestyFinderName').value = finderName;
            document.getElementById('honestyFinderContact').value = finderContact;
            openModal('honestyModal'); break;
        case 'edit-found-report': {
            const report = state.myDocuments.find(r => r.id === id);
            if (report) {
                document.getElementById('editFoundReportId').value = id;
                document.getElementById('editFinderName').value = report.finder_name || '';
                document.getElementById('editFoundLocation').value = report.location || '';
                openModal('editFoundReportModal');
            } break;
        }
        case 'view-finder-info': {
            if (state.viewingFinderInfo.has(id)) return;
            state.viewingFinderInfo.add(id);
            const report = state.myDocuments.find(r => r.id === id);
            if (!report) { state.viewingFinderInfo.delete(id); return; }
            incrementFinderView(id, state.currentOwnerId, report.finder_views).then(err => {
                if (err) { showNotification('Error', 'No se pudo mostrar la información.'); state.viewingFinderInfo.delete(id); }
            }); break;
        }
        case 'claim-it': {
            openLostModal();
            setTimeout(() => {
                const sel = document.getElementById('lostCountrySelect');
                if (sel) sel.value = country;
                populateDocTypes(document.getElementById('lostDocType'), country);
                const t = document.getElementById('lostDocType'); if (t) t.value = doctype;
                const n = document.getElementById('lostDocNumber'); if (n) n.value = docnumber;
            }, 100); break;
        }
        case 'found-it': {
            openFoundModal();
            setTimeout(() => {
                const sel = document.getElementById('foundCountrySelect');
                if (sel) sel.value = country;
                populateDocTypes(document.getElementById('foundDocType'), country);
                const t = document.getElementById('foundDocType'); if (t) t.value = doctype;
                const n = document.getElementById('foundDocNumber'); if (n) n.value = docnumber;
            }, 100); break;
        }
    }
};
