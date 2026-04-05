import { supabase } from '../../supabaseConfig';
import { HubApporteurSnapshot } from '../types';

interface CreateHubApporteurParams {
  name: string;
}

interface CreateHubApporteurResult {
  apporteurId: string;
  snapshot: HubApporteurSnapshot;
}

export async function createHubApporteurAuto(
  params: CreateHubApporteurParams
): Promise<CreateHubApporteurResult> {
  const name = params.name.trim().toUpperCase();

  const { data: inserted, error } = await supabase
    .from('apporteurs')
    .insert({
      name,
      phone: null,
      email: null,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(error?.message || 'Insert failed');

  return {
    apporteurId: inserted.id,
    snapshot: { apporteurId: inserted.id, name },
  };
}
