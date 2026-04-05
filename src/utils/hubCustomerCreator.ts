import { supabase } from '../../supabaseConfig';
import { HubCustomerSnapshot } from '../types';

interface CreateHubCustomerParams {
  firstName: string;
  lastName: string;
  nickname?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdByName?: string | null;
}

interface CreateHubCustomerResult {
  customerId: string;
  snapshot: HubCustomerSnapshot;
}

// Normalise last_name: trim + retire un '.' de fin (placeholder import Firestore)
const normLastName = (s: string) => s.trim().replace(/\.+$/, '').trim();
const normName = (s: string) => s.trim().toUpperCase();

/**
 * Auto-create a Hub customer from basic info (name, optional nickname/phone).
 * **Dedup-before-insert**: cherche d'abord un customer existant avec le même
 * (first_name, last_name normalisé) pour éviter les doublons. Si trouvé, renvoie
 * l'existant sans insérer.
 */
export async function createHubCustomerAuto(
  params: CreateHubCustomerParams
): Promise<CreateHubCustomerResult> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const displayName = `${firstName} ${lastName}`.trim();
  const nickname = params.nickname?.trim() || null;
  const lastNameNorm = normLastName(lastName);
  const firstNameUpper = normName(firstName);

  // 1. Dedup: chercher un existant avec même first_name (ilike) — on filtre
  //    ensuite côté code sur last_name normalisé (ilike ne peut pas normaliser).
  if (firstNameUpper) {
    try {
      const { data: candidates } = await supabase
        .from('customers')
        .select('id, first_name, last_name, tags, vip_score')
        .ilike('first_name', firstNameUpper)
        .limit(20);

      const existing = (candidates ?? []).find(c => {
        const cfn = normName(c.first_name || '');
        const cln = normLastName(c.last_name || '');
        return cfn === firstNameUpper && cln === lastNameNorm;
      });

      if (existing) {
        return {
          customerId: existing.id,
          snapshot: {
            customerId: existing.id,
            displayName,
            nickname,
            tags: existing.tags ?? [],
            vipScore: existing.vip_score ?? 0,
          },
        };
      }
    } catch (lookupErr) {
      // Non-blocking: on tente l'insert quand même
      console.warn('[createHubCustomerAuto] Dedup lookup failed:', lookupErr);
    }
  }

  // 2. Pas de match → insert
  const { data: inserted, error } = await supabase
    .from('customers')
    .insert({
      first_name: firstName,
      last_name: lastName,
      phone: params.phone?.trim() || null,
      email: null,
      tags: [],
      total_revenue: 0,
      vip_score: 0,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(error?.message || 'Insert failed');

  return {
    customerId: inserted.id,
    snapshot: {
      customerId: inserted.id,
      displayName,
      nickname,
      tags: [],
      vipScore: 0,
    },
  };
}
