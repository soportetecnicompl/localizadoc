import { supabase } from '../supabase-config.js';
import { fetchAllReports, fetchAllSponsors, fetchPendingHonesty } from './api.js';
import { renderMetrics, renderSponsors, renderHonestyPending, renderReportsTable, renderActivityChart } from './render.js';
import { setupAdminGlobals, setupAdminForms } from './handlers.js';

let allReports = [];
let searchFilter = '';
let dateFilter = 'all';
let countryFilter = 'all';

const refresh = async () => {
    const [reports, sponsors, honesty] = await Promise.all([fetchAllReports(), fetchAllSponsors(), fetchPendingHonesty()]);
    allReports = reports;
    renderMetrics(reports, honesty.length);
    renderSponsors(sponsors);
    renderHonestyPending(honesty);
    renderReportsTable(allReports, searchFilter, dateFilter, countryFilter);
    renderActivityChart(allReports);
};

const setupFilters = () => {
    document.getElementById('reportSearch')?.addEventListener('input', (e) => { searchFilter = e.target.value.toLowerCase().trim(); renderReportsTable(allReports, searchFilter, dateFilter, countryFilter); });
    document.getElementById('date-filters')?.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelectorAll('#date-filters .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        dateFilter = e.target.dataset.filter;
        renderReportsTable(allReports, searchFilter, dateFilter, countryFilter);
    });
    document.getElementById('countryFilter')?.addEventListener('change', (e) => { countryFilter = e.target.value; renderReportsTable(allReports, searchFilter, dateFilter, countryFilter); });
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
        const rows = renderReportsTable(allReports, searchFilter, dateFilter, countryFilter);
        const headers = ['id','status','doc_type','doc_number','country','owner_name','owner_id','created_at','updated_at'];
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `localizadoc-${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errorEl = document.getElementById('login-error');
        errorEl?.classList.add('hidden');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { errorEl?.classList.remove('hidden'); return; }
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel')?.classList.remove('hidden');
        setupAdminGlobals();
        setupAdminForms();
        setupFilters();
        await refresh();
        supabase.channel('admin-all').on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, refresh).subscribe();
        supabase.channel('admin-sponsors').on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, refresh).subscribe();
        supabase.channel('admin-honesty').on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions' }, refresh).subscribe();
    });
});
