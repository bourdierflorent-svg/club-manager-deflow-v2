import { supabase } from '../../supabaseConfig';
import { HubApporteurSnapshot } from '../types';

interface CreateHubApporteurParams {
  name: string;
}

interface CreateHubApporteurResult {
  apporteurId: string;
  snapshot: HubApporteurSnapshot;
}

const normName = (s: string) => s.trim().toUpperCase().replace(/\.+$/, '').trim();

/**
 * Auto-create a Hub apporteur. **Dedup-before-insert**: si un apporteur existe
 * déjà avec le même nom (normalisé), on le renvoie au lieu d'en créer un nouveau.
 */
export async function createHubApporteurAuto(
  params: CreateHubApporteurParams
): Promise<CreateHubApporteurResult> {
  const name = params.name.trim().toUpperCase();
  const nameNorm = normName(name);

  // Dedup
  if (nameNorm) {
    try {
      const { data: candidates } = await supabase
        .from('apporteurs')
        .select('id, name')
        .ilike('name', name)
        .limit(10);
      const existing = (candidates ?? []).find(a => normName(a.name || '') === nameNorm);
      if (existing) {
        return { apporteurId: existing.id, snapshot: { apporteurId: existing.id, name } };
      }
    } catch (err) {
      console.warn('[createHubApporteurAuto] Dedup lookup failed:', err);
    }
  }

  const { data: inserted, error } = await supabase
    .from('apporteurs')
    .insert({ name, phone: null, email: null })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(error?.message || 'Insert failed');

  return { apporteurId: inserted.id, snapshot: { apporteurId: inserted.id, name } };
}
