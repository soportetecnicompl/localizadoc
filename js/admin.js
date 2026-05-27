import { supabase } from './supabase-config.js';

let allReports = [];

const fmt = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

window.openModal = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
window.closeModal = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

window.deleteSponsor = async (id) => {
    if (!confirm('¿Eliminar esta empresa?')) return;
    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) alert('Error al eliminar sponsor: ' + error.message);
};

window.deleteReport = async (id) => {
    if (!confirm('¿Eliminar este reporte?')) return;
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) alert('Error al eliminar reporte: ' + error.message);
};

window.approveHonesty = async (id) => {
    const { error } = await supabase.from('honesty_submissions').update({ status: 'approved' }).eq('id', id);
    if (error) alert('Error al aprobar: ' + error.message);
};

window.deleteHonesty = async (id) => {
    if (!confirm('¿Eliminar esta solicitud?')) return;
    const { error } = await supabase.from('honesty_submissions').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
};

window.openEditSponsorModal = async (id) => {
    const { data, error } = await supabase.from('sponsors').select('*').eq('id', id).single();
    if (error || !data) return;
    document.getElementById('editSponsorId').value = id;
    document.getElementById('editSponsorName').value = data.name || '';
    document.getElementById('editSponsorLogoUrl').value = data.logo_url || '';
    document.getElementById('editSponsorPhone').value = data.phone || '';
    document.getElementById('editSponsorEmail').value = data.email || '';
    document.getElementById('editSponsorAddress').value = data.address || '';
    window.openModal('editSponsorModal');
};

window.openEditReportModal = async (id) => {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    if (error || !data) return;
    document.getElementById('editReportId').value = id;
    document.getElementById('editReportStatus').value = data.status || 'lost';
    document.getElementById('editReportDocType').value = data.doc_type || '';
    document.getElementById('editReportDocNumber').value = data.doc_number || '';
    document.getElementById('editReportOwnerName').value = data.owner_name || '';
    document.getElementById('editReportOwnerId').value = data.owner_id || '';
    window.openModal('editReportModal');
};

function renderReportsTable() {
    const tableBody = document.getElementById('reports-table-body');
    // BUG FIX: búsqueda solo en campos relevantes, no en JSON.stringify completo
    const searchFilter = document.getElementById('reportSearch').value.toLowerCase().trim();
    const activeFilter = document.querySelector('#date-filters .active')?.dataset.filter || 'all';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = allReports.filter(doc => {
        const docDate = new Date(doc.updated_at || doc.created_at);
        const dateMatch =
            activeFilter === 'all' ||
            (activeFilter === 'today' && docDate >= today) ||
            (activeFilter === 'week' && docDate >= startOfWeek) ||
            (activeFilter === 'month' && docDate >= startOfMonth);

        const terms = [doc.doc_type, doc.doc_number, doc.owner_name, doc.owner_id, doc.status, doc.country, doc.finder_name, doc.finder_contact]
            .filter(Boolean).join(' ').toLowerCase();
        return dateMatch && (!searchFilter || terms.includes(searchFilter));
    });

    const statusColor = {
        lost: 'bg-red-900 text-red-300',
        match: 'bg-orange-900 text-orange-300',
        found: 'bg-yellow-900 text-yellow-300',
        recovered: 'bg-green-900 text-green-300'
    };

    tableBody.innerHTML = '';
    filtered.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="px-2 py-1 text-xs font-bold rounded-full ${statusColor[doc.status] || 'bg-gray-700'}">${doc.status}</span></td>
            <td>${doc.doc_type || 'N/A'}</td>
            <td>${doc.doc_number || 'N/A'}</td>
            <td>${fmt(doc.updated_at || doc.created_at)}</td>
            <td>${doc.owner_name || 'N/A'}</td>
            <td>${doc.owner_id || 'N/A'}</td>
            <td class="flex gap-4">
                <button onclick="window.openEditReportModal('${doc.id}')" class="text-yellow-400 hover:text-yellow-200">Editar</button>
                <button onclick="window.deleteReport('${doc.id}')" class="text-red-400 hover:text-red-200">Eliminar</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function fetchAndRenderReports() {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    allReports = data || [];
    document.getElementById('metric-total').textContent = allReports.length;
    document.getElementById('metric-lost').textContent = allReports.filter(r => r.status === 'lost' || r.status === 'match').length;
    document.getElementById('metric-found').textContent = allReports.filter(r => r.status === 'found').length;
    document.getElementById('metric-recovered').textContent = allReports.filter(r => r.status === 'recovered').length;
    renderReportsTable();
}

async function fetchAndRenderSponsors() {
    const { data } = await supabase.from('sponsors').select('*').order('created_at', { ascending: false });
    const list = document.getElementById('sponsors-list');
    list.innerHTML = data?.length ? '' : '<p class="text-gray-400">No hay empresas.</p>';
    (data || []).forEach(s => {
        const el = document.createElement('div');
        el.className = 'glass-container p-3 flex justify-between items-center';
        el.innerHTML = `
            <div class="flex items-center gap-4">
                <img src="${s.logo_url}" alt="${s.name}" class="w-16 h-10 object-contain bg-white/10 rounded" onerror="this.src='https://placehold.co/64x40/1a1a1a/fff?text=Error'">
                <span class="font-bold">${s.name}</span>
            </div>
            <div class="flex gap-4">
                <button onclick="window.openEditSponsorModal('${s.id}')" class="text-yellow-400 hover:text-yellow-200">Editar</button>
                <button onclick="window.deleteSponsor('${s.id}')" class="text-red-400 hover:text-red-200">Eliminar</button>
            </div>
        `;
        list.appendChild(el);
    });
}

async function fetchAndRenderHonestyPending() {
    const { data } = await supabase.from('honesty_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    document.getElementById('metric-honesty-pending').textContent = data?.length || 0;
    const list = document.getElementById('honesty-submissions-list');
    list.innerHTML = data?.length ? '' : '<p class="text-gray-400">No hay solicitudes pendientes.</p>';
    (data || []).forEach(sub => {
        const el = document.createElement('div');
        el.className = 'glass-container p-3';
        el.innerHTML = `
            <p class="italic">"${sub.owner_message}"</p>
            <p class="text-xs text-gray-400 mt-2">Por: ${sub.owner_id} | Samaritano: ${sub.finder_name || 'N/A'}</p>
            <div class="flex justify-end gap-4 mt-2">
                <button onclick="window.deleteHonesty('${sub.id}')" class="text-red-400 hover:text-red-200 text-sm font-bold">Eliminar</button>
                <button onclick="window.approveHonesty('${sub.id}')" class="text-green-400 hover:text-green-200 text-sm font-bold">Aprobar</button>
            </div>
        `;
        list.appendChild(el);
    });
}

function startAdminListeners() {
    fetchAndRenderReports();
    fetchAndRenderSponsors();
    fetchAndRenderHonestyPending();

    supabase.channel('admin-docs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchAndRenderReports)
        .subscribe();
    supabase.channel('admin-sponsors')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, fetchAndRenderSponsors)
        .subscribe();
    supabase.channel('admin-honesty')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'honesty_submissions' }, fetchAndRenderHonestyPending)
        .subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errorEl = document.getElementById('login-error');
        errorEl.classList.add('hidden');

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            errorEl.classList.remove('hidden');
            console.error('Admin login error:', error.message);
        } else {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-panel').classList.remove('hidden');
            startAdminListeners();
        }
    });

    document.getElementById('reportSearch').addEventListener('input', renderReportsTable);
    document.getElementById('date-filters').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#date-filters .filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderReportsTable();
        }
    });

    document.getElementById('addSponsorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const { error } = await supabase.from('sponsors').insert({
            name: f.sponsorName.value.trim(),
            logo_url: f.sponsorLogoUrl.value.trim(),
            phone: f.sponsorPhone.value.trim() || null,
            email: f.sponsorEmail.value.trim() || null,
            address: f.sponsorAddress.value.trim() || null
        });
        if (!error) { f.reset(); window.closeModal('addSponsorModal'); }
        else alert('Error al agregar sponsor: ' + error.message);
    });

    document.getElementById('editSponsorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editSponsorId').value;
        const { error } = await supabase.from('sponsors').update({
            name: document.getElementById('editSponsorName').value.trim(),
            logo_url: document.getElementById('editSponsorLogoUrl').value.trim(),
            phone: document.getElementById('editSponsorPhone').value.trim() || null,
            email: document.getElementById('editSponsorEmail').value.trim() || null,
            address: document.getElementById('editSponsorAddress').value.trim() || null
        }).eq('id', id);
        if (!error) window.closeModal('editSponsorModal');
        else alert('Error al editar sponsor: ' + error.message);
    });

    document.getElementById('editReportForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editReportId').value;
        const { error } = await supabase.from('documents').update({
            status: document.getElementById('editReportStatus').value,
            doc_type: document.getElementById('editReportDocType').value,
            doc_number: document.getElementById('editReportDocNumber').value,
            owner_name: document.getElementById('editReportOwnerName').value,
            owner_id: document.getElementById('editReportOwnerId').value,
            updated_at: new Date().toISOString()
        }).eq('id', id);
        if (!error) window.closeModal('editReportModal');
        else alert('Error al editar reporte: ' + error.message);
    });
});
