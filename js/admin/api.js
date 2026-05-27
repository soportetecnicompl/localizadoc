import { supabase } from '../supabase-config.js';

export const fetchAllReports = async () => {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    return data || [];
};
export const fetchAllSponsors = async () => {
    const { data } = await supabase.from('sponsors').select('*').order('created_at', { ascending: false });
    return data || [];
};
export const fetchPendingHonesty = async () => {
    const { data } = await supabase.from('honesty_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
};
export const deleteSponsor = async (id) => { const { error } = await supabase.from('sponsors').delete().eq('id', id); return error; };
export const deleteReport = async (id) => { const { error } = await supabase.from('documents').delete().eq('id', id); return error; };
export const approveHonesty = async (id) => { const { error } = await supabase.from('honesty_submissions').update({ status: 'approved' }).eq('id', id); return error; };
export const deleteHonesty = async (id) => { const { error } = await supabase.from('honesty_submissions').delete().eq('id', id); return error; };
export const getSponsor = async (id) => { const { data } = await supabase.from('sponsors').select('*').eq('id', id).single(); return data; };
export const getReport = async (id) => { const { data } = await supabase.from('documents').select('*').eq('id', id).single(); return data; };
export const updateSponsor = async (id, payload) => { const { error } = await supabase.from('sponsors').update(payload).eq('id', id); return error; };
export const insertSponsor = async (payload) => { const { error } = await supabase.from('sponsors').insert(payload); return error; };
export const updateReport = async (id, payload) => { const { error } = await supabase.from('documents').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id); return error; };
