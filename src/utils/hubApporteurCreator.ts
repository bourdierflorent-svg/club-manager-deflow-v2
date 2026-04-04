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

  // Generate next SGP-APP-XXXX id
  const { data: existing } = await supabase
    .from('apporteurs')
    .select('id')
    .like('id', 'SGP-APP-%')
    .order('id', { ascending: false })
    .limit(100);

  const nums = (existing ?? [])
    .map(d => parseInt((d.id ?? '').replace('SGP-APP-', ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const newId = `SGP-APP-${String(max + 1).padStart(4, '0')}`;

  const { error } = await supabase.from('apporteurs').insert({
    id: newId,
    name,
    phone: null,
    email: null,
  });

  if (error) throw new Error(error.message);

  return {
    apporteurId: newId,
    snapshot: { apporteurId: newId, name },
  };
}
