import { deleteSponsor, deleteReport, approveHonesty, deleteHonesty, getSponsor, getReport, updateSponsor, insertSponsor, updateReport } from './api.js';

export const setupAdminGlobals = () => {
    window.openModal = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
    window.closeModal = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

    window.deleteSponsorHandler = async (id) => {
        if (!confirm('¿Eliminar esta empresa?')) return;
        await deleteSponsor(id);
    };
    window.deleteReportHandler = async (id) => {
        if (!confirm('¿Eliminar este reporte?')) return;
        await deleteReport(id);
    };
    window.approveHonestyHandler = async (id) => await approveHonesty(id);
    window.deleteHonestyHandler = async (id) => {
        if (!confirm('¿Eliminar esta solicitud?')) return;
        await deleteHonesty(id);
    };
    window.openEditSponsorModal = async (id) => {
        const data = await getSponsor(id);
        if (!data) return;
        document.getElementById('editSponsorId').value = id;
        document.getElementById('editSponsorName').value = data.name || '';
        document.getElementById('editSponsorLogoUrl').value = data.logo_url || '';
        document.getElementById('editSponsorPhone').value = data.phone || '';
        document.getElementById('editSponsorEmail').value = data.email || '';
        document.getElementById('editSponsorAddress').value = data.address || '';
        window.openModal('editSponsorModal');
    };
    window.openEditReportModal = async (id) => {
        const data = await getReport(id);
        if (!data) return;
        document.getElementById('editReportId').value = id;
        document.getElementById('editReportStatus').value = data.status || 'lost';
        document.getElementById('editReportDocType').value = data.doc_type || '';
        document.getElementById('editReportDocNumber').value = data.doc_number || '';
        document.getElementById('editReportOwnerName').value = data.owner_name || '';
        document.getElementById('editReportOwnerId').value = data.owner_id || '';
        window.openModal('editReportModal');
    };
};

export const setupAdminForms = () => {
    document.getElementById('addSponsorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await insertSponsor({ name: f.sponsorName.value.trim(), logo_url: f.sponsorLogoUrl.value.trim(), phone: f.sponsorPhone.value.trim()||null, email: f.sponsorEmail.value.trim()||null, address: f.sponsorAddress.value.trim()||null });
        f.reset(); window.closeModal('addSponsorModal');
    });
    document.getElementById('editSponsorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editSponsorId').value;
        await updateSponsor(id, { name: document.getElementById('editSponsorName').value.trim(), logo_url: document.getElementById('editSponsorLogoUrl').value.trim(), phone: document.getElementById('editSponsorPhone').value.trim()||null, email: document.getElementById('editSponsorEmail').value.trim()||null, address: document.getElementById('editSponsorAddress').value.trim()||null });
        window.closeModal('editSponsorModal');
    });
    document.getElementById('editReportForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editReportId').value;
        await updateReport(id, { status: document.getElementById('editReportStatus').value, doc_type: document.getElementById('editReportDocType').value, doc_number: document.getElementById('editReportDocNumber').value, owner_name: document.getElementById('editReportOwnerName').value, owner_id: document.getElementById('editReportOwnerId').value });
        window.closeModal('editReportModal');
    });
};
