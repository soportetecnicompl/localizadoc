import { supabase } from './supabase-config.js';
import { state } from './state.js';
import { COUNTRIES } from './constants.js';
import { populateCountries, populateDocTypes, closeModal } from './utils.js';
import { fetchMyDocuments, fetchThankedReports } from './api.js';
import { renderMyReportsList } from './render.js';

export const handleLogin = (countryCode, phoneNumber, isAutoLogin = false) => {
    if ('Notification' in window && Notification.permission !== 'denied') Notification.requestPermission();
    const prefix = COUNTRIES[countryCode]?.prefix || '';
    const fullPhone = `${prefix}${phoneNumber}`;
    localStorage.setItem('userPhone', fullPhone);
    localStorage.setItem('userCountry', countryCode);
    state.currentOwnerId = fullPhone;

    const userPhoneEl = document.getElementById('userPhone');
    if (userPhoneEl) userPhoneEl.textContent = `+${fullPhone}`;
    if (!isAutoLogin) {
        if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) grecaptcha.reset();
        const btn = document.getElementById('loginButton');
        if (btn) btn.disabled = true;
    }
    document.getElementById('user-info')?.classList.remove('hidden');
    document.getElementById('logged-in-content')?.classList.remove('hidden');
    closeModal('loginModal');

    loadUserData();
    startUserListeners();
};

export const handleLogout = () => {
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userCountry');
    window.location.reload();
};

export const loadUserData = async () => {
    const ownerId = state.currentOwnerId;
    state.myDocuments = await fetchMyDocuments(ownerId);
    state.thankedReportIds = await fetchThankedReports(ownerId);
    renderMyReportsList(state.myDocuments, ownerId, state.thankedReportIds, state.notifiedMatches, state.viewingFinderInfo);
};

export const startUserListeners = () => {
    const ownerId = state.currentOwnerId;
    supabase.channel(`user-owner-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `owner_id=eq.${ownerId}` }, loadUserData)
        .subscribe();
    supabase.channel(`user-finder-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `finder_contact=eq.${ownerId}` }, loadUserData)
        .subscribe();
    supabase.channel(`user-honesty-${ownerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions', filter: `owner_id=eq.${ownerId}` }, loadUserData)
        .subscribe();
};
