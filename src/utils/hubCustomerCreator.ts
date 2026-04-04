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

/**
 * Auto-create a Hub customer from basic info (name, optional nickname/phone).
 * Returns the new customer ID and a snapshot to store on the club-side document.
 */
export async function createHubCustomerAuto(
  params: CreateHubCustomerParams
): Promise<CreateHubCustomerResult> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const displayName = `${firstName} ${lastName}`;
  const nickname = params.nickname?.trim() || null;

  // Generate next SGP-CLI-XXXX id
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .like('id', 'SGP-CLI-%')
    .order('id', { ascending: false })
    .limit(100);

  const nums = (existing ?? [])
    .map(d => parseInt((d.id ?? '').replace('SGP-CLI-', ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const newId = `SGP-CLI-${String(max + 1).padStart(4, '0')}`;

  const { error } = await supabase.from('customers').insert({
    id: newId,
    first_name: firstName,
    last_name: lastName,
    phone: params.phone?.trim() || null,
    email: null,
    tags: [],
    total_revenue: 0,
    vip_score: 0,
  });

  if (error) throw new Error(error.message);

  return {
    customerId: newId,
    snapshot: {
      customerId: newId,
      displayName,
      nickname,
      tags: [],
      vipScore: 0,
    },
  };
}
