import { supabase } from './supabase-config.js';

export const fetchAllDocuments = async () => {
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (error) { console.error('fetchAllDocuments:', error); return []; }
    return data || [];
};
export const fetchMyDocuments = async (ownerId) => {
    const { data, error } = await supabase.from('documents').select('*')
        .or(`owner_id.eq.${ownerId},finder_contact.eq.${ownerId}`)
        .order('created_at', { ascending: false });
    if (error) { console.error('fetchMyDocuments:', error); return []; }
    return data || [];
};
export const fetchHonestyWall = async () => {
    const { data, error } = await supabase.from('honesty_submissions').select('*')
        .eq('status', 'approved').order('created_at', { ascending: false });
    if (error) { console.error('fetchHonestyWall:', error); return []; }
    return data || [];
};
export const fetchSponsors = async () => {
    const { data, error } = await supabase.from('sponsors').select('*').order('created_at', { ascending: false });
    if (error) { console.error('fetchSponsors:', error); return []; }
    return data || [];
};
export const fetchThankedReports = async (ownerId) => {
    const { data, error } = await supabase.from('honesty_submissions').select('report_id').eq('owner_id', ownerId);
    if (error) { console.error('fetchThankedReports:', error); return new Set(); }
    return new Set((data || []).map(d => d.report_id));
};
export const insertLostReport = async (payload) => {
    const { error } = await supabase.from('documents').insert(payload);
    return error;
};
export const checkDuplicate = async (country, docType, docNumber) => {
    const { data } = await supabase.from('documents').select('id, status').eq('country', country)
        .eq('doc_type', docType).eq('doc_number', docNumber).in('status', ['lost', 'found', 'match']);
    return data || [];
};
export const updateMatch = async (reportId, payload) => {
    const { error } = await supabase.from('documents').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', reportId);
    return error;
};
export const insertFoundReport = async (payload) => {
    const { error } = await supabase.from('documents').insert(payload);
    return error;
};
export const deleteReport = async (reportId) => {
    const { error } = await supabase.from('documents').delete().eq('id', reportId);
    return error;
};
export const markAsRecovered = async (reportId) => {
    const { error } = await supabase.from('documents').update({ status: 'recovered', updated_at: new Date().toISOString() }).eq('id', reportId);
    return error;
};
export const incrementFinderView = async (reportId, ownerId, currentViews) => {
    const newViews = { ...currentViews, [ownerId]: (currentViews?.[ownerId] || 0) + 1 };
    const { error } = await supabase.from('documents').update({ finder_views: newViews }).eq('id', reportId);
    return error;
};
export const submitHonestyMessage = async (payload) => {
    const { error } = await supabase.from('honesty_submissions').insert(payload);
    return error;
};
export const updateFoundReport = async (reportId, finderName, location) => {
    const { error } = await supabase.from('documents').update({
        finder_name: finderName, location: location || null, updated_at: new Date().toISOString()
    }).eq('id', reportId);
    return error;
};
