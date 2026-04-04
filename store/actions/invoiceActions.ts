import type { StoreGet, StoreSet } from '../types';
import type { Invoice } from '../../src/types';
import { generateShortId, secureLog, secureError } from '../../src/utils';
import { supabase } from '../../supabaseConfig';

function mapInvoiceFromDb(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    numero: (row.numero as string) || '',
    dateEvenement: (row.date_evenement as string) || '',
    dateFacture: (row.date_facture as string) || '',
    entity: (row.entity as Invoice['entity']) || { id: '', nom: '', logo: '', siege: '', tva: '', siren: '', contact: '', bgColor: '' },
    client: (row.client as Invoice['client']) || { nom: '', adresse: '', ville: '', cp: '', tel: '', email: '' },
    rows: (row.rows as Invoice['rows']) || [],
    totalTTC: Number(row.total_ttc) || 0,
    tva: Number(row.tva) || 0,
    netAPayer: Number(row.net_a_payer) || 0,
    status: (row.status as string) || 'draft',
    createdAt: (row.created_at as string) || '',
    createdById: (row.created_by_id as string) || '',
    createdByName: (row.created_by_name as string) || '',
    updatedAt: (row.updated_at as string) || undefined,
  } as Invoice;
}

function mapInvoiceToDb(data: Partial<Invoice>, clubId: string) {
  const payload: Record<string, unknown> = { club_id: clubId };
  if (data.numero !== undefined) payload.numero = data.numero;
  if (data.dateEvenement !== undefined) payload.date_evenement = data.dateEvenement;
  if (data.dateFacture !== undefined) payload.date_facture = data.dateFacture;
  if (data.entity !== undefined) payload.entity = data.entity;
  if (data.client !== undefined) payload.client = data.client;
  if (data.rows !== undefined) payload.rows = data.rows;
  if (data.totalTTC !== undefined) payload.total_ttc = data.totalTTC;
  if (data.tva !== undefined) payload.tva = data.tva;
  if (data.netAPayer !== undefined) payload.net_a_payer = data.netAPayer;
  if (data.status !== undefined) payload.status = data.status;
  if (data.createdById !== undefined) payload.created_by_id = data.createdById;
  if (data.createdByName !== undefined) payload.created_by_name = data.createdByName;
  payload.updated_at = new Date().toISOString();
  return payload;
}

export const createInvoiceActions = (set: StoreSet, get: StoreGet) => ({

  createInvoice: async (data: Omit<Invoice, 'id' | 'createdAt' | 'createdById' | 'createdByName'>): Promise<string> => {
    const clubId = get().clubId;
    const user = get().currentUser;
    if (!clubId) { secureError('[createInvoice] No clubId'); return ''; }

    const invoiceId = generateShortId('inv');
    const payload = {
      ...mapInvoiceToDb(data as Partial<Invoice>, clubId),
      id: invoiceId,
      created_at: new Date().toISOString(),
      created_by_id: user?.id || '',
      created_by_name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    };

    const { error } = await supabase.from('invoices').insert(payload);
    if (error) {
      secureError('[createInvoice] Error:', error);
      return '';
    }

    secureLog(`[createInvoice] Created invoice ${invoiceId}`);
    // Reload invoices
    await get().loadInvoices();
    return invoiceId;
  },

  updateInvoice: async (invoiceId: string, data: Partial<Invoice>): Promise<void> => {
    const clubId = get().clubId;
    if (!clubId) return;

    const payload = mapInvoiceToDb(data, clubId);
    const { error } = await supabase.from('invoices').update(payload).eq('id', invoiceId);
    if (error) {
      secureError('[updateInvoice] Error:', error);
      return;
    }

    secureLog(`[updateInvoice] Updated invoice ${invoiceId}`);
    await get().loadInvoices();
  },

  deleteInvoice: async (invoiceId: string): Promise<void> => {
    const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
    if (error) {
      secureError('[deleteInvoice] Error:', error);
      return;
    }

    secureLog(`[deleteInvoice] Deleted invoice ${invoiceId}`);
    set({ invoices: get().invoices.filter(i => i.id !== invoiceId) });
  },

  loadInvoices: async (): Promise<void> => {
    const clubId = get().clubId;
    if (!clubId) return;

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (error) {
      secureError('[loadInvoices] Error:', error);
      return;
    }

    const invoices = (data || []).map(mapInvoiceFromDb);
    set({ invoices });
    secureLog(`[loadInvoices] Loaded ${invoices.length} invoices`);
  },
});
