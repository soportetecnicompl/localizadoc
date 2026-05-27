import { deleteSponsor, deleteReport, approveHonesty, deleteHonesty, getSponsor, getReport } from './api.js';

const fmt = (d) => d ? new Date(d).toLocaleString('es-HN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'N/A';
const statusColor = { lost:'bg-red-900 text-red-300', match:'bg-orange-900 text-orange-300', found:'bg-yellow-900 text-yellow-300', recovered:'bg-green-900 text-green-300' };

export const renderMetrics = (reports, pendingHonesty) => {
    document.getElementById('metric-total').textContent = reports.length;
    document.getElementById('metric-lost').textContent = reports.filter(r => r.status === 'lost' || r.status === 'match').length;
    document.getElementById('metric-found').textContent = reports.filter(r => r.status === 'found').length;
    document.getElementById('metric-recovered').textContent = reports.filter(r => r.status === 'recovered').length;
    document.getElementById('metric-honesty-pending').textContent = pendingHonesty;
    const total = reports.length;
    const recovered = reports.filter(r => r.status === 'recovered').length;
    const rate = total > 0 ? Math.round((recovered / total) * 100) : 0;
    const rateEl = document.getElementById('metric-recovery-rate');
    if (rateEl) rateEl.textContent = `${rate}%`;
};

export const renderSponsors = (sponsors) => {
    const list = document.getElementById('sponsors-list');
    list.innerHTML = sponsors.length ? '' : '<p class="text-gray-400">No hay empresas.</p>';
    sponsors.forEach(s => {
        const el = document.createElement('div');
        el.className = 'glass-container p-3 flex justify-between items-center';
        el.innerHTML = `<div class="flex items-center gap-4"><img src="${s.logo_url}" alt="${s.name}" class="w-16 h-10 object-contain bg-white/10 rounded" onerror="this.src='https://placehold.co/64x40/1a1a1a/fff?text=Error'"><span class="font-bold">${s.name}</span></div><div class="flex gap-4"><button onclick="window.openEditSponsorModal('${s.id}')" class="text-yellow-400 hover:text-yellow-200">Editar</button><button onclick="window.deleteSponsorHandler('${s.id}')" class="text-red-400 hover:text-red-200">Eliminar</button></div>`;
        list.appendChild(el);
    });
};

export const renderHonestyPending = (submissions) => {
    const list = document.getElementById('honesty-submissions-list');
    list.innerHTML = submissions.length ? '' : '<p class="text-gray-400">No hay solicitudes pendientes.</p>';
    submissions.forEach(sub => {
        const el = document.createElement('div');
        el.className = 'glass-container p-3';
        el.innerHTML = `<p class="italic">"${sub.owner_message}"</p><p class="text-xs text-gray-400 mt-2">Por: ${sub.owner_id} | Samaritano: ${sub.finder_name || 'N/A'}</p><div class="flex justify-end gap-4 mt-2"><button onclick="window.deleteHonestyHandler('${sub.id}')" class="text-red-400 hover:text-red-200 text-sm font-bold">Eliminar</button><button onclick="window.approveHonestyHandler('${sub.id}')" class="text-green-400 hover:text-green-200 text-sm font-bold">Aprobar</button></div>`;
        list.appendChild(el);
    });
};

export const renderReportsTable = (reports, searchFilter, dateFilter, countryFilter) => {
    const tableBody = document.getElementById('reports-table-body');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = reports.filter(doc => {
        const docDate = new Date(doc.updated_at || doc.created_at);
        const dateMatch = dateFilter === 'all' || (dateFilter === 'today' && docDate >= today) || (dateFilter === 'week' && docDate >= startOfWeek) || (dateFilter === 'month' && docDate >= startOfMonth);
        const terms = [doc.doc_type, doc.doc_number, doc.owner_name, doc.owner_id, doc.status, doc.country, doc.finder_name].filter(Boolean).join(' ').toLowerCase();
        const searchMatch = !searchFilter || terms.includes(searchFilter);
        const countryMatch = !countryFilter || countryFilter === 'all' || doc.country === countryFilter;
        return dateMatch && searchMatch && countryMatch;
    });

    tableBody.innerHTML = '';
    filtered.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `<td><span class="px-2 py-1 text-xs font-bold rounded-full ${statusColor[doc.status]||'bg-gray-700'}">${doc.status}</span></td><td>${doc.doc_type||'N/A'}</td><td>${doc.doc_number||'N/A'}</td><td>${fmt(doc.updated_at||doc.created_at)}</td><td>${doc.owner_name||'N/A'}</td><td>${doc.owner_id||'N/A'}</td><td class="flex gap-4"><button onclick="window.openEditReportModal('${doc.id}')" class="text-yellow-400 hover:text-yellow-200">Editar</button><button onclick="window.deleteReportHandler('${doc.id}')" class="text-red-400 hover:text-red-200">Eliminar</button></td>`;
        tableBody.appendChild(row);
    });
    return filtered;
};

export const renderActivityChart = (reports) => {
    const canvas = document.getElementById('activityChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const days = 30;
    const labels = [], lostData = [], foundData = [], recoveredData = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit' });
        labels.push(label);
        const dayStr = d.toISOString().split('T')[0];
        lostData.push(reports.filter(r => (r.created_at||'').startsWith(dayStr) && r.status === 'lost').length);
        foundData.push(reports.filter(r => (r.created_at||'').startsWith(dayStr) && r.status === 'found').length);
        recoveredData.push(reports.filter(r => (r.updated_at||'').startsWith(dayStr) && r.status === 'recovered').length);
    }
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Perdidos', data: lostData, backgroundColor: '#ef4444' },
            { label: 'Encontrados', data: foundData, backgroundColor: '#facc15' },
            { label: 'Recuperados', data: recoveredData, backgroundColor: '#22c55e' },
        ]},
        options: { responsive: true, plugins: { legend: { labels: { color: '#d1d5db' } } }, scales: { x: { ticks: { color: '#6b7280' } }, y: { ticks: { color: '#6b7280' }, beginAtZero: true } } }
    });
};
