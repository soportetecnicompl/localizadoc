import { supabase } from './supabase-config.js';
import { state } from './state.js';
import { COUNTRIES } from './constants.js';
import { populateCountries, populateDocTypes, showNotification, openModal } from './utils.js';
import { fetchAllDocuments, fetchHonestyWall, fetchSponsors } from './api.js';
import { renderSkeletons, renderStats, renderPublicLists, renderHonestyWall, renderSponsors } from './render.js';
import { handleLogin, handleLogout, loadUserData } from './auth.js';
import { setupFormHandlers, handleClickActions } from './handlers.js';

window.onCaptchaSuccess = () => { const btn = document.getElementById('loginButton'); if (btn) btn.disabled = false; };
window.onCaptchaExpired = () => { const btn = document.getElementById('loginButton'); if (btn) btn.disabled = true; };
window.showSponsorInfo = (sponsor) => {
    const details = [
        sponsor.phone ? `<p><i class="fas fa-phone mr-2 text-gray-400"></i>${sponsor.phone}</p>` : '',
        sponsor.email ? `<p><i class="fas fa-envelope mr-2 text-gray-400"></i>${sponsor.email}</p>` : '',
        sponsor.address ? `<p><i class="fas fa-map-marker-alt mr-2 text-gray-400"></i>${sponsor.address}</p>` : '',
    ].filter(Boolean).join('');
    showNotification(sponsor.name, details || '<p>Empresa colaboradora de LocalizaDoc.</p>');
};

const loadPublicData = async () => {
    const filter = document.getElementById('searchInput')?.value || '';
    state.allDocuments = await fetchAllDocuments();
    renderStats(state.allDocuments);
    renderPublicLists(state.allDocuments, filter);
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        renderSkeletons();

        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) console.error('Auth Error:', authError);
        state.currentUserUid = authData?.user?.id || null;

        await Promise.all([loadPublicData(), fetchHonestyWall().then(renderHonestyWall), fetchSponsors().then(renderSponsors)]);

        supabase.channel('global-documents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, async () => {
                await loadPublicData();
                if (state.currentOwnerId) loadUserData();
            }).subscribe();
        supabase.channel('global-honesty')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions' },
                () => fetchHonestyWall().then(renderHonestyWall)).subscribe();
        supabase.channel('global-sponsors')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' },
                () => fetchSponsors().then(renderSponsors)).subscribe();

        const savedPhone = localStorage.getItem('userPhone');
        const savedCountry = localStorage.getItem('userCountry');
        if (savedPhone && savedCountry && COUNTRIES[savedCountry]) {
            const prefix = COUNTRIES[savedCountry].prefix || '';
            const phone = prefix && savedPhone.startsWith(prefix) ? savedPhone.substring(prefix.length) : savedPhone;
            handleLogin(savedCountry, phone, true);
        } else {
            openModal('loginModal');
        }

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('loginPhone').value.trim();
            const country = document.getElementById('loginCountry').value;
            if (phone && country) handleLogin(country, phone, false);
        });
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.getElementById('searchInput')?.addEventListener('input', () =>
            renderPublicLists(state.allDocuments, document.getElementById('searchInput').value));

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

        setupFormHandlers();
        document.body.addEventListener('click', handleClickActions);

    } catch (err) {
        console.error('Error crítico:', err);
        document.body.innerHTML = '<div style="color:white;padding:2rem;text-align:center;">Error grave al cargar. Revisa la consola (F12).</div>';
    }
});
