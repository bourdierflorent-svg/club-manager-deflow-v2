import type { StoreGet, StoreSet } from '../types';
import type { CaisseData } from '../../src/types';
import { secureLog, secureError } from '../../src/utils';
import { supabase } from '../../supabaseConfig';

/** Map a Supabase caisses row (snake_case) to the app CaisseData (camelCase). */
function mapCaisseFromDb(row: Record<string, unknown>): CaisseData {
  return {
    id: row.id as string,
    eventId: (row.event_id as string) || '',
    vestiaire: Number(row.vestiaire) || 0,
    caSalle: Number(row.ca_salle) || 0,
    bar: Number(row.bar) || 0,
    ttc: Number(row.ttc) || 0,
    ht: Number(row.ht) || 0,
    nbPax: row.nb_pax != null ? Number(row.nb_pax) : undefined,
    noteSoiree: (row.note_soiree as string) || '',
    creditClients: (row.credit_clients as CaisseData['creditClients']) || [],
    salleOverride: row.salle_override != null ? Number(row.salle_override) : null,
    updatedAt: (row.updated_at as string) || '',
    updatedBy: (row.updated_by as string) || '',
  };
}

/** Map app CaisseData (camelCase) to a Supabase-compatible payload (snake_case). */
function mapCaisseToDb(data: Partial<CaisseData>) {
  const payload: Record<string, unknown> = {};
  if (data.eventId !== undefined) payload.event_id = data.eventId;
  if (data.vestiaire !== undefined) payload.vestiaire = data.vestiaire;
  if (data.caSalle !== undefined) payload.ca_salle = data.caSalle;
  if (data.bar !== undefined) payload.bar = data.bar;
  if (data.ttc !== undefined) payload.ttc = data.ttc;
  if (data.ht !== undefined) payload.ht = data.ht;
  if (data.nbPax !== undefined) payload.nb_pax = data.nbPax;
  if (data.noteSoiree !== undefined) payload.note_soiree = data.noteSoiree;
  if (data.creditClients !== undefined) payload.credit_clients = data.creditClients;
  if (data.salleOverride !== undefined) payload.salle_override = data.salleOverride;
  if (data.updatedAt !== undefined) payload.updated_at = data.updatedAt;
  if (data.updatedBy !== undefined) payload.updated_by = data.updatedBy;
  return payload;
}

export const createCaisseActions = (set: StoreSet, get: StoreGet) => ({

  loadCaisse: async (eventId?: string): Promise<CaisseData | null> => {
    const eid = eventId || get().currentEvent?.id;
    if (!eid) {
      secureLog('[loadCaisse] No event ID available');
      return null;
    }

    const { data, error } = await supabase
      .from('caisses')
      .select('*')
      .eq('event_id', eid)
      .maybeSingle();

    if (error) {
      secureError('[loadCaisse] Error:', error);
      return null;
    }

    if (!data) return null;

    const caisse = mapCaisseFromDb(data);
    secureLog(`[loadCaisse] Loaded caisse for event ${eid}`);
    return caisse;
  },

  saveCaisse: async (partialData: Partial<CaisseData>, eventId?: string) => {
    const eid = eventId || partialData.eventId || get().currentEvent?.id;
    if (!eid) {
      secureError('[saveCaisse] No event ID available');
      return;
    }

    const clubId = get().clubId;
    const payload = {
      ...mapCaisseToDb(partialData),
      event_id: eid,
      club_id: clubId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('caisses')
      .upsert(payload, { onConflict: 'event_id' });

    if (error) {
      secureError('[saveCaisse] Error:', error);
      return;
    }

    secureLog(`[saveCaisse] Saved caisse for event ${eid}`);
  },
});
